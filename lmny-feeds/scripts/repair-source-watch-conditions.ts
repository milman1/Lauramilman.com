/** Source-backed, condition-only repair for active Shopify watches. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchBelgiumDiaFeed } from '../src/feeds/belgiumdia.js';
import { fetchAllowedWatchStocks } from '../src/feeds/watchPartners.js';
import { isExcludedWatchPartner } from '../src/normalize.js';
import { ShopifyClient, exchangeClientCredentials } from '../src/shopify.js';
import { buildWatchConditionPlan, catalogDrift, sourceWatchCondition, validatePlanSnapshot, type CatalogWatchCondition, type WatchConditionPlanRow, type WatchConditionPlanSnapshot } from '../src/watchConditionRepair.js';

const OUT_DIR = 'out';
const PLAN_PATH = path.join(OUT_DIR, 'source-watch-condition-plan.json');
const REPORT_PATH = path.join(OUT_DIR, 'source-watch-condition-report.md');
const MAX_PLAN_AGE_MS = 24 * 60 * 60 * 1000;

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
async function token(domain: string): Promise<string> {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  if (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET) {
    return (await exchangeClientCredentials(domain, process.env.SHOPIFY_CLIENT_ID, process.env.SHOPIFY_CLIENT_SECRET)).token;
  }
  throw new Error('Set SHOPIFY_ADMIN_TOKEN or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET');
}

const CATALOG_QUERY = `#graphql
  query SourceWatchConditionCatalog($cursor: String) {
    products(first: 100, after: $cursor, query: "product_type:Watch OR product_type:Watches") {
      pageInfo { hasNextPage endCursor }
      nodes {
        id handle productType status
        variants(first: 2) { nodes { sku } }
        ebayCondition: metafield(namespace: "custom", key: "ebay_condition") { value }
        googleCondition: metafield(namespace: "mm-google-shopping", key: "condition") { value }
      }
    }
  }
`;

async function fetchCatalog(shopify: ShopifyClient): Promise<CatalogWatchCondition[]> {
  const rows: CatalogWatchCondition[] = [];
  let cursor: string | null = null;
  for (;;) {
    const data = await shopify.gql<{ products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Array<{ id: string; handle: string; productType: string; status: string; variants: { nodes: Array<{ sku?: string | null }> }; ebayCondition?: { value?: string | null } | null; googleCondition?: { value?: string | null } | null }> } }>(CATALOG_QUERY, { cursor });
    for (const product of data.products.nodes) {
      if (product.status !== 'ACTIVE' || !/^watches?$/i.test(product.productType)) continue;
      if (product.variants.nodes.length !== 1) throw new Error(`watch ${product.id} does not have exactly one variant`);
      rows.push({ productId: product.id, handle: product.handle, sku: product.variants.nodes[0]?.sku?.trim() ?? '', ebayCondition: product.ebayCondition?.value?.trim() || null, googleCondition: product.googleCondition?.value?.trim() || null });
    }
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return rows;
}

const VERIFY_QUERY = `#graphql
  query VerifySourceWatchConditions($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id handle productType status
        variants(first: 2) { nodes { sku } }
        ebayCondition: metafield(namespace: "custom", key: "ebay_condition") { value }
        googleCondition: metafield(namespace: "mm-google-shopping", key: "condition") { value }
      }
    }
  }
`;

async function fetchPlanProducts(shopify: ShopifyClient, ids: string[]): Promise<CatalogWatchCondition[]> {
  const rows: CatalogWatchCondition[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const data = await shopify.gql<{ nodes: Array<null | { id: string; handle: string; productType: string; status: string; variants: { nodes: Array<{ sku?: string | null }> }; ebayCondition?: { value?: string | null } | null; googleCondition?: { value?: string | null } | null }> }>(VERIFY_QUERY, { ids: ids.slice(i, i + 100) });
    for (const product of data.nodes) {
      if (!product || product.status !== 'ACTIVE' || !/^watches?$/i.test(product.productType) || product.variants.nodes.length !== 1) continue;
      rows.push({ productId: product.id, handle: product.handle, sku: product.variants.nodes[0]?.sku?.trim() ?? '', ebayCondition: product.ebayCondition?.value?.trim() || null, googleCondition: product.googleCondition?.value?.trim() || null });
    }
  }
  return rows;
}

function sha256(bytes: string): string { return createHash('sha256').update(bytes).digest('hex'); }
async function writeReport(lines: string[]): Promise<void> { await writeFile(REPORT_PATH, `${lines.join('\n')}\n`); }

async function dryRun(shopify: ShopifyClient): Promise<void> {
  const [rawSource, allowedStocks, catalog] = await Promise.all([fetchBelgiumDiaFeed('watch'), fetchAllowedWatchStocks(), fetchCatalog(shopify)]);
  if (rawSource.length === 0) throw new Error('Belgium Dia watch feed returned 0 rows; refusing to create a plan');
  if (allowedStocks.size === 0) throw new Error('ROMAN allowlist returned 0 rows; refusing to create a plan');
  const source = rawSource.flatMap((raw) => {
    const parsed = sourceWatchCondition(raw);
    return parsed && !isExcludedWatchPartner(raw, parsed.stockRef) ? [parsed] : [];
  });
  if (source.length === 0) throw new Error('Belgium Dia watch feed had 0 usable source rows');
  const rows = buildWatchConditionPlan(source, catalog, allowedStocks);
  const snapshot: WatchConditionPlanSnapshot = { schemaVersion: 1, generatedAt: new Date().toISOString(), rows };
  const bytes = `${JSON.stringify(snapshot, null, 2)}\n`;
  await writeFile(PLAN_PATH, bytes);
  await writeReport(['# Source-backed watch condition repair', '', '- Mode: dry-run (no writes)', `- Source rows fetched: ${rawSource.length}`, `- Allowed ROMAN stocks: ${allowedStocks.size}`, `- Active watch catalog rows: ${catalog.length}`, `- Planned condition changes: ${rows.length}`, `- Plan SHA-256: \`${sha256(bytes)}\``, '- Maximum review age: 24 hours']);
}

async function applyReviewed(shopify: ShopifyClient): Promise<void> {
  const reviewedPath = arg('reviewed-plan');
  const expectedHash = arg('plan-sha256');
  if (!reviewedPath || !expectedHash || !/^[a-f0-9]{64}$/i.test(expectedHash)) throw new Error('apply requires --reviewed-plan and --plan-sha256');
  const bytes = await readFile(reviewedPath, 'utf8');
  if (sha256(bytes) !== expectedHash.toLowerCase()) throw new Error('reviewed plan SHA-256 mismatch');
  const snapshot = validatePlanSnapshot(JSON.parse(bytes), Date.now(), MAX_PLAN_AGE_MS);
  const before = await fetchPlanProducts(shopify, snapshot.rows.map((row) => row.productId));
  const drift = catalogDrift(snapshot.rows, before);
  if (drift.length) throw new Error(`reviewed plan drift; no writes made: ${drift.join('; ')}`);
  const writes = snapshot.rows.flatMap((row) => [
    { ownerId: row.productId, namespace: 'custom', key: 'ebay_condition', type: 'single_line_text_field', value: row.after.ebayCondition },
    { ownerId: row.productId, namespace: 'mm-google-shopping', key: 'condition', type: 'single_line_text_field', value: row.after.googleCondition },
  ]);
  const errors = await shopify.setMetafields(writes);
  if (errors.length) throw new Error(`metafieldsSet failed: ${errors.join('; ')}`);
  const after = await fetchPlanProducts(shopify, snapshot.rows.map((row) => row.productId));
  const expectedAfter = snapshot.rows.map((row) => ({ ...row, before: row.after }));
  const mismatches = catalogDrift(expectedAfter, after);
  await writeReport(['# Source-backed watch condition repair', '', '- Mode: apply reviewed plan', `- Reviewed plan SHA-256: \`${expectedHash.toLowerCase()}\``, `- Applied products: ${snapshot.rows.length}`, `- Fresh-read verification mismatches: ${mismatches.length}`]);
  if (mismatches.length) throw new Error(`post-write verification mismatches: ${mismatches.join('; ')}`);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const domain = requireEnv('SHOPIFY_STORE_DOMAIN');
  const shopify = new ShopifyClient(domain, await token(domain));
  await shopify.verifyAuth();
  if (process.argv.includes('--apply')) await applyReviewed(shopify);
  else await dryRun(shopify);
}

main().catch(async (error) => {
  await mkdir(OUT_DIR, { recursive: true });
  const message = error instanceof Error ? error.message : String(error);
  await writeFile(path.join(OUT_DIR, 'source-watch-condition-errors.txt'), `${message}\n`);
  console.error(message);
  process.exitCode = 1;
});
