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
import { ShopifyClient, downloadJsonl, exchangeClientCredentials } from '../src/shopify.js';

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

async function fetchRows(shopify: ShopifyClient): Promise<CatalogRow[]> {
  const query = `{
    products(query: "product_type:'${PRODUCT_TYPES.watch}' OR tag:${EBAY_TAG}") {
      edges {
        node {
          id
          handle
          title
          productType
          status
          tags
          descriptionHtml
          metafields {
            edges {
              node { namespace key value }
            }
          }
        }
      }
    }
  }`;

  const start = await shopify.gql<{
    bulkOperationRunQuery: { bulkOperation: { id: string } | null; userErrors: Array<{ message: string }> };
  }>(
    `mutation($query: String!) {
      bulkOperationRunQuery(query: $query) { bulkOperation { id } userErrors { message } }
    }`,
    { query },
  );
  if (start.bulkOperationRunQuery.userErrors.length) {
    throw new Error(start.bulkOperationRunQuery.userErrors.map((e) => e.message).join('; '));
  }

  const url = await pollBulk(shopify);
  if (!url) return [];
  const lines = await downloadJsonl(url);

  const byId = new Map<string, CatalogRow>();
  const order: string[] = [];
  for (const row of lines) {
    const r = row as Record<string, unknown>;
    if (typeof r.handle === 'string' && typeof r.id === 'string' && typeof r.title === 'string') {
      byId.set(r.id, {
        id: r.id,
        handle: r.handle,
        title: r.title,
        productType: String(r.productType ?? ''),
        status: String(r.status ?? ''),
        tags: (r.tags as string[]) ?? [],
        descriptionHtml: String(r.descriptionHtml ?? ''),
        box: null,
        papers: null,
        ebayCondition: null,
        features: null,
        googleCondition: null,
      });
      order.push(r.id);
      continue;
    }
    if (typeof r.__parentId !== 'string') continue;
    const parent = byId.get(r.__parentId);
    if (!parent) continue;
    if (typeof r.namespace !== 'string' || typeof r.key !== 'string') continue;
    const value = typeof r.value === 'string' ? r.value : null;
    if (r.namespace === 'custom' && r.key === 'box') parent.box = value;
    if (r.namespace === 'custom' && r.key === 'papers') parent.papers = value;
    if (r.namespace === 'custom' && r.key === EBAY_CONDITION_KEY) parent.ebayCondition = value;
    if (r.namespace === 'custom' && r.key === EBAY_FEATURES_KEY) parent.features = value;
    if (r.namespace === 'mm-google-shopping' && r.key === 'condition') parent.googleCondition = value;
  }
  return order.map((id) => byId.get(id)!);
}

async function pollBulk(shopify: ShopifyClient): Promise<string | null> {
  for (;;) {
    const data = await shopify.gql<{
      currentBulkOperation: {
        status: string;
        errorCode: string | null;
        url: string | null;
        objectCount: string;
      } | null;
    }>(`{ currentBulkOperation(type: QUERY) { status errorCode url objectCount } }`);
    const op = data.currentBulkOperation;
    if (!op) return null;
    if (op.status === 'COMPLETED') return op.url;
    if (op.status === 'FAILED' || op.status === 'CANCELED') {
      throw new Error(`Bulk operation ${op.status}: ${op.errorCode ?? 'unknown'}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

function planFor(row: CatalogRow): EbayConditionPlan | null {
  return planEbayConditionFix({
    title: row.title,
    descriptionHtml: row.descriptionHtml,
    productType: row.productType,
    box: row.box,
    papers: row.papers,
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
