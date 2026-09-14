/**
 * Align Shopify watch listings with eBay condition rules.
 *
 * eBay hid Pre-Owned titles whose Condition/Features said "New with box and
 * papers". This writes custom.ebay_condition + custom.features, rewrites
 * "as a full set with box and papers" copy, and flips Google condition to
 * used when the title is pre-owned.
 *
 *   npx tsx scripts/fix-ebay-preowned-features.ts
 *   npx tsx scripts/fix-ebay-preowned-features.ts --apply
 *   npx tsx scripts/fix-ebay-preowned-features.ts --limit=25
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  EBAY_CONDITION_KEY,
  EBAY_CONDITION_NAMESPACE,
  EBAY_FEATURES_KEY,
  planEbayConditionFix,
  type EbayConditionPlan,
} from '../src/ebayCondition.js';
import { EBAY_TAG, PRODUCT_TYPES } from '../src/product.js';
import { ShopifyClient, exchangeClientCredentials } from '../src/shopify.js';

const OUT_DIR = 'out';

interface Flags {
  apply: boolean;
  limit: number | null;
}

interface CatalogRow {
  id: string;
  handle: string;
  title: string;
  productType: string;
  status: string;
  tags: string[];
  descriptionHtml: string;
  box: string | null;
  papers: string | null;
  ebayCondition: string | null;
  features: string | null;
  googleCondition: string | null;
}

function parseFlags(argv: string[]): Flags {
  const apply = argv.includes('--apply');
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  return { apply, limit: limitArg ? Number(limitArg.split('=')[1]) : null };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function resolveToken(domain: string): Promise<string> {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  if (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET) {
    const { token, scope } = await exchangeClientCredentials(
      domain,
      process.env.SHOPIFY_CLIENT_ID,
      process.env.SHOPIFY_CLIENT_SECRET,
    );
    console.log(`Obtained Shopify token via client-credentials (scopes: ${scope || 'unknown'})`);
    return token;
  }
  throw new Error('Set SHOPIFY_ADMIN_TOKEN or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET');
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

const CATALOG_QUERY = `#graphql
  query EbayPreownedCatalog($cursor: String, $q: String!) {
    products(first: 100, after: $cursor, query: $q) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        handle
        title
        productType
        status
        tags
        descriptionHtml
        box: metafield(namespace: "custom", key: "box") { value }
        papers: metafield(namespace: "custom", key: "papers") { value }
        ebayCondition: metafield(namespace: "custom", key: "ebay_condition") { value }
        features: metafield(namespace: "custom", key: "features") { value }
        googleCondition: metafield(namespace: "mm-google-shopping", key: "condition") { value }
      }
    }
  }
`;

function mfValue(field: { value?: string | null } | null | undefined): string | null {
  const v = field?.value;
  return typeof v === 'string' && v.trim() ? v : null;
}

async function fetchRows(shopify: ShopifyClient): Promise<CatalogRow[]> {
  // Paginated Admin GraphQL — not bulkOperationRunQuery. A bulk op races the
  // hourly feed sync on currentBulkOperation; this job already parsed that
  // JSONL (no title field) as zero watches.
  const q = `product_type:${PRODUCT_TYPES.watch} OR tag:${EBAY_TAG}`;
  const rows: CatalogRow[] = [];
  let cursor: string | null = null;
  for (;;) {
    const data = await shopify.gql<{
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: Array<{
          id: string;
          handle: string;
          title: string;
          productType: string | null;
          status: string;
          tags: string[];
          descriptionHtml: string | null;
          box: { value?: string | null } | null;
          papers: { value?: string | null } | null;
          ebayCondition: { value?: string | null } | null;
          features: { value?: string | null } | null;
          googleCondition: { value?: string | null } | null;
        }>;
      };
    }>(CATALOG_QUERY, { cursor, q });
    for (const node of data.products.nodes) {
      rows.push({
        id: node.id,
        handle: node.handle,
        title: node.title,
        productType: node.productType ?? '',
        status: node.status,
        tags: node.tags ?? [],
        descriptionHtml: node.descriptionHtml ?? '',
        box: mfValue(node.box),
        papers: mfValue(node.papers),
        ebayCondition: mfValue(node.ebayCondition),
        features: mfValue(node.features),
        googleCondition: mfValue(node.googleCondition),
      });
    }
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return rows;
}

function planFor(row: CatalogRow): EbayConditionPlan | null {
  return planEbayConditionFix({
    title: row.title,
    descriptionHtml: row.descriptionHtml,
    productType: row.productType,
    box: row.box,
    papers: row.papers,
    // Shopify catalog fields, including custom.condition, are mutable and do
    // not prove supplier state. This repair therefore never upgrades a watch
    // to new; the normal API sync is the only authoritative new-state path.
    state: null,
    ebayCondition: row.ebayCondition,
    features: row.features,
    googleCondition: row.googleCondition,
  });
}

async function updateDescription(shopify: ShopifyClient, id: string, descriptionHtml: string): Promise<string[]> {
  const data = await shopify.gql<{
    productUpdate: { userErrors: Array<{ message: string }> };
  }>(
    `mutation($product: ProductUpdateInput!) {
      productUpdate(product: $product) { userErrors { field message } }
    }`,
    { product: { id, descriptionHtml } },
  );
  return data.productUpdate.userErrors.map((e) => e.message);
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const domain = requireEnv('SHOPIFY_STORE_DOMAIN');
  const shopify = new ShopifyClient(domain, await resolveToken(domain));
  const { shop } = await shopify.verifyAuth();
  console.log(`Shopify auth OK: ${shop}`);
  console.log(flags.apply ? 'MODE: APPLY (will write Shopify)' : 'MODE: dry-run (counts + CSVs — zero writes)');

  if (flags.apply) {
    await shopify.ensureMetafieldDefinitions();
  }

  let rows = await fetchRows(shopify);
  console.log(`Fetched ${rows.length} Watch / ebay-tagged products`);
  if (flags.apply && rows.length === 0) {
    throw new Error('Fetched 0 Watch products — refusing to no-op APPLY (likely a catalog query failure).');
  }
  if (flags.limit) rows = rows.slice(0, flags.limit);

  const preview: string[] = [
    [
      'handle',
      'title',
      'status',
      'reasons',
      'ebay_condition',
      'features',
      'google_condition',
      'rewrite_description',
    ].join(','),
  ];
  const toWrite: Array<{ ownerId: string; namespace: string; key: string; type: string; value: string }> = [];
  const toDelete: Array<{ ownerId: string; namespace: string; key: string }> = [];
  const descriptions: Array<{ id: string; handle: string; html: string }> = [];
  let mismatchCount = 0;

  for (const row of rows) {
    const plan = planFor(row);
    if (!plan) continue;
    mismatchCount += 1;
    preview.push(
      [
        csvEscape(row.handle),
        csvEscape(row.title),
        csvEscape(row.status),
        csvEscape(plan.reasons.join('; ')),
        csvEscape(plan.ebayCondition ?? ''),
        csvEscape(plan.features ?? ''),
        csvEscape(plan.googleCondition ?? ''),
        plan.descriptionHtml ? 'yes' : '',
      ].join(','),
    );
    if (plan.ebayCondition) {
      toWrite.push({
        ownerId: row.id,
        namespace: EBAY_CONDITION_NAMESPACE,
        key: EBAY_CONDITION_KEY,
        type: 'single_line_text_field',
        value: plan.ebayCondition,
      });
    }
    if (plan.features) {
      toWrite.push({
        ownerId: row.id,
        namespace: EBAY_CONDITION_NAMESPACE,
        key: EBAY_FEATURES_KEY,
        type: 'single_line_text_field',
        value: plan.features,
      });
    }
    if (plan.clearFeatures) {
      toDelete.push({
        ownerId: row.id,
        namespace: EBAY_CONDITION_NAMESPACE,
        key: EBAY_FEATURES_KEY,
      });
    }
    if (plan.googleCondition) {
      toWrite.push({
        ownerId: row.id,
        namespace: 'mm-google-shopping',
        key: 'condition',
        type: 'single_line_text_field',
        value: plan.googleCondition,
      });
    }
    if (plan.descriptionHtml) {
      descriptions.push({ id: row.id, handle: row.handle, html: plan.descriptionHtml });
    }
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, 'ebay-preowned-features.csv'), `${preview.join('\n')}\n`);

  const report = [
    '# eBay Pre-Owned / New-with-box fix',
    '',
    `- Catalog rows: ${rows.length}`,
    `- Products that need a write: ${mismatchCount}`,
    `- Metafield upserts: ${toWrite.length}`,
    `- Feature metafield deletes: ${toDelete.length}`,
    `- Description rewrites: ${descriptions.length}`,
    `- Mode: ${flags.apply ? 'APPLY' : 'dry-run'}`,
    '',
    'Marketplace Connect should map **Condition** to `custom.ebay_condition` and **Features** to `custom.features`. Do not map box/papers onto eBay Condition.',
    '',
  ].join('\n');
  await writeFile(path.join(OUT_DIR, 'ebay-preowned-features.md'), report);
  console.log(report);

  if (!flags.apply) {
    console.log('Dry-run complete. Re-run with --apply to write Shopify.');
    return;
  }

  const mfErrors = await shopify.setMetafields(toWrite);
  if (toDelete.length) {
    const delErrors = await shopify.deleteMetafields(toDelete);
    mfErrors.push(...delErrors);
  }
  const descErrors: string[] = [];
  for (const d of descriptions) {
    const errs = await updateDescription(shopify, d.id, d.html);
    if (errs.length) descErrors.push(`${d.handle}: ${errs.join('; ')}`);
  }

  const errText = [...mfErrors, ...descErrors].join('\n');
  if (errText) await writeFile(path.join(OUT_DIR, 'ebay-preowned-features-errors.txt'), `${errText}\n`);
  if (mfErrors.length || descErrors.length) {
    throw new Error(`Shopify writes had errors: metafields=${mfErrors.length} descriptions=${descErrors.length}`);
  }
  console.log(`Wrote ${toWrite.length} metafields, deleted ${toDelete.length}, rewrote ${descriptions.length} descriptions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
