import { readFile, writeFile } from 'node:fs/promises';
import { ShopifyClient, exchangeClientCredentials } from '../src/shopify.js';
import { activateReviewed, readSnapshot, reviewTemplate, validateActivation, validateDraftInput, type Review } from '../src/jewelryGate.js';

function arg(name: string): string {
  const value = process.argv.slice(3).find(x => x.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (!value) throw new Error(`Required --${name}=...`);
  return value;
}
async function main(): Promise<void> {
  const mode = process.argv[2];
  if (!['draft', 'plan', 'check', 'activate'].includes(mode ?? '')) throw new Error('Usage: jewelry:gate draft --input=/private/product-set.json | plan --id=gid://shopify/Product/123 --out=/private/review.json | check/activate --review=/private/review.json');
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN required');
  let token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!token && process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET) token = (await exchangeClientCredentials(domain, process.env.SHOPIFY_CLIENT_ID, process.env.SHOPIFY_CLIENT_SECRET)).token;
  if (!token) throw new Error('Shopify credentials required in environment, never in review files');
  const client = new ShopifyClient(domain, token);
  if (mode === 'draft') {
    const input = JSON.parse(await readFile(arg('input'), 'utf8')) as Record<string, unknown>;
    const issues = validateDraftInput(input);
    if (issues.length) throw new Error(issues.join('\n'));
    // No identifier is supplied: this is create-only, never an upsert of an existing draft.
    const created = await client.productSet(input);
    if (created.errors.length || !created.id) throw new Error('Draft creation failed; inspect Shopify before retrying');
    const saved = await readSnapshot(client, created.id);
    if (saved.product.status !== 'DRAFT' || saved.product.handle !== input.handle) throw new Error(`Draft readback mismatch for ${created.id}; inspect before retrying`);
    console.log(`DRAFT verified: ${created.id}. Finish media and source review, then run plan. Not approved for activation.`);
    return;
  }
  if (mode === 'plan') {
    const snapshot = await readSnapshot(client, arg('id'));
    const out = arg('out');
    // Both files contain private operational data. Never commit or publish them.
    await writeFile(`${out}.snapshot.json`, JSON.stringify(snapshot, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    const review = reviewTemplate(snapshot);
    await writeFile(out, JSON.stringify(review, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    console.log(`Review template saved. Unreviewed: activation is blocked. Complete the checklist against the private snapshot, then run check.`);
    return;
  }
  const review = JSON.parse(await readFile(arg('review'), 'utf8')) as Review;
  if (mode === 'check') {
    const issues = validateActivation(await readSnapshot(client, review.productId), review);
    if (issues.length) throw new Error(issues.join('\n'));
    console.log('PASS: fresh snapshot and review match. No writes performed; activation still requires merchant authorization.');
  } else {
    await activateReviewed(client, review);
    console.log('ACTIVE verified by independent readback. No sales-channel publication or marketplace tagging performed. Verify public presentation after separately authorized publication.');
  }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
