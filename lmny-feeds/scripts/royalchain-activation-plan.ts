import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { exchangeClientCredentials, ShopifyClient } from '../src/shopify.js';
import {
  ROYALCHAIN_CATALOG_QUERY,
  activationChecklist,
  buildActivationSnapshot,
  finalVerificationExitCode,
  parseAvailabilityCsv,
  parsePlanJsonl,
  type ActivationSnapshot,
  type LiveProduct,
  validateReviewedSnapshot,
  verifyFinalState,
} from '../src/royalchain/activation.js';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function requiredArg(name: string): string {
  const value = arg(name);
  if (!value) throw new Error(`missing required --${name}=...`);
  return value;
}

async function shopifyClient(): Promise<ShopifyClient> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN is required for a fresh read');
  if (process.env.SHOPIFY_ADMIN_TOKEN) return new ShopifyClient(domain, process.env.SHOPIFY_ADMIN_TOKEN);
  if (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET) {
    const { token } = await exchangeClientCredentials(domain, process.env.SHOPIFY_CLIENT_ID, process.env.SHOPIFY_CLIENT_SECRET);
    return new ShopifyClient(domain, token);
  }
  throw new Error('set SHOPIFY_ADMIN_TOKEN or SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET for a fresh read');
}

async function readLive(): Promise<LiveProduct[]> {
  const data = await (await shopifyClient()).gql<{ products: { nodes: LiveProduct[] } }>(ROYALCHAIN_CATALOG_QUERY);
  return data.products.nodes;
}

async function writePlanOutputs(outputDir: string, snapshot: ActivationSnapshot, mode: string): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'royal-chain-activation-snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
  await writeFile(path.join(outputDir, 'royal-chain-activation-checklist.md'), activationChecklist(snapshot));
  await writeFile(path.join(outputDir, 'royal-chain-activation-report.md'), [
    '# Royal Chain activation plan report', '', `Mode: ${mode}`, `Snapshot SHA-256: ${snapshot.snapshotSha256}`,
    `Source plan SHA-256: ${snapshot.sourcePlanSha256}`, `Fresh Shopify read SHA-256: ${snapshot.liveReadSha256}`,
    `Scope: ${snapshot.targetProducts} products / ${snapshot.targetVariants} variants`, '',
    `Activation-ready: ${snapshot.activationReady ? 'yes' : 'no'}`, '',
    '## Blockers', '',
    ...(snapshot.blockers.length ? snapshot.blockers.map((blocker) => `- [${blocker.code}] ${blocker.handle ? `${blocker.handle}: ` : ''}${blocker.sku ? `${blocker.sku}: ` : ''}${blocker.message}`) : ['- none']),
    '', '## Activation-only person gaps', '',
    ...(snapshot.activationGaps.length ? snapshot.activationGaps.map((gap) => `- [${gap.code}] ${gap.handle ? `${gap.handle}: ` : ''}${gap.sku ? `${gap.sku}: ` : ''}${gap.message}`) : ['- none']),
    '', 'The worker performs no Shopify mutation. ACTIVE, Online Store publication, eBay tagging, and Marketplace Connect review remain person-run steps.', '',
  ].join('\n'));
}

async function build(): Promise<void> {
  const planPath = requiredArg('plan');
  const outputDir = requiredArg('output-dir');
  const availabilityPath = arg('availability');
  const planText = await readFile(planPath, 'utf8');
  const availabilityText = availabilityPath ? await readFile(availabilityPath, 'utf8') : undefined;
  const plan = parsePlanJsonl(planText);
  const availability = availabilityText == null ? undefined : parseAvailabilityCsv(availabilityText);
  const snapshot = buildActivationSnapshot({ plan, planText, availability, availabilityText, liveProducts: await readLive() });
  await writePlanOutputs(outputDir, snapshot, 'dry-run / plan-only');
  console.log(JSON.stringify({ mode: 'plan-only', snapshot: path.join(outputDir, 'royal-chain-activation-snapshot.json'), blockers: snapshot.blockers.length, activationGaps: snapshot.activationGaps.length, products: snapshot.targetProducts, variants: snapshot.targetVariants }, null, 2));
  // A plan is useful even when blocked, but CI must fail so no one mistakes it for approval.
  if (snapshot.blockers.length) process.exitCode = 2;
}

async function verify(): Promise<void> {
  const snapshotPath = requiredArg('verify');
  const outputDir = requiredArg('output-dir');
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as ActivationSnapshot;
  const snapshotBlockers = validateReviewedSnapshot(snapshot);
  if (snapshotBlockers.length) {
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, 'royal-chain-activation-verification.json'), `${JSON.stringify({ snapshotSha256: snapshot.snapshotSha256 ?? null, checkedProducts: 0, checkedVariants: 0, blockers: snapshotBlockers, activationGaps: [] }, null, 2)}\n`);
    await writeFile(path.join(outputDir, 'royal-chain-activation-verification.md'), ['# Royal Chain independent final verification', '', '## FAIL', '', ...snapshotBlockers.map((blocker) => `- [${blocker.code}] ${blocker.message}`), '', 'Shopify was not read because the reviewed snapshot failed its integrity gate.', ''].join('\n'));
    throw new Error(`reviewed snapshot rejected before Shopify read: ${snapshotBlockers.map((blocker) => `[${blocker.code}] ${blocker.message}`).join('; ')}`);
  }
  const live = await readLive();
  // The catalog query is intentionally broad enough to find scope drift. The
  // verifier compares only the exact reviewed handles; unrelated house-brand
  // products must not make a valid 32-product batch fail its count check.
  const targetHandles = new Set(snapshot.targets.map((target) => target.handle));
  const liveTargets = live.filter((product) => targetHandles.has(product.handle ?? ''));
  const result = verifyFinalState(snapshot, liveTargets);
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'royal-chain-activation-verification.json'), `${JSON.stringify({ snapshotSha256: snapshot.snapshotSha256, checkedProducts: result.checkedProducts, checkedVariants: result.checkedVariants, blockers: result.blockers, activationGaps: result.activationGaps }, null, 2)}\n`);
  await writeFile(path.join(outputDir, 'royal-chain-activation-verification.md'), [
    '# Royal Chain independent final verification', '', `Reviewed snapshot SHA-256: ${snapshot.snapshotSha256}`,
    `Checked: ${result.checkedProducts} products / ${result.checkedVariants} variants`, '',
    result.blockers.length || result.activationGaps.length ? '## FAIL' : '## PASS', '',
    ...(result.blockers.length ? result.blockers.map((blocker) => `- [${blocker.code}] ${blocker.handle ? `${blocker.handle}: ` : ''}${blocker.sku ? `${blocker.sku}: ` : ''}${blocker.message}`) : ['All final state checks passed.']), '',
    '## Activation-only person gaps', '',
    ...(result.activationGaps.length ? result.activationGaps.map((gap) => `- [${gap.code}] ${gap.handle ? `${gap.handle}: ` : ''}${gap.sku ? `${gap.sku}: ` : ''}${gap.message}`) : ['- none']), '',
  ].join('\n'));
  console.log(JSON.stringify({ mode: 'verify-final', blockers: result.blockers.length, activationGaps: result.activationGaps.length, products: result.checkedProducts, variants: result.checkedVariants }, null, 2));
  process.exitCode = finalVerificationExitCode(result.blockers, result.activationGaps);
}

async function main(): Promise<void> {
  if (arg('verify')) await verify();
  else await build();
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
