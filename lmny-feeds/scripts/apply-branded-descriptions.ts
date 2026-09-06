/**
 * Apply the Laura Milman branded description template to live Watch / eBay
 * listings. Marketplace Connect copies Shopify descriptionHtml onto eBay.
 *
 * Future ingest uses the same template via watchListingBuilder /
 * backvault/listing. This job backfills the catalog that is already live.
 *
 *   npx tsx scripts/apply-branded-descriptions.ts
 *   npx tsx scripts/apply-branded-descriptions.ts --apply
 *   npx tsx scripts/apply-branded-descriptions.ts --limit=25
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  applyBrandedTemplate,
  listingKindFromProduct,
} from '../src/brandedDescription.js';
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
  query BrandedDescriptionCatalog($cursor: String, $q: String!) {
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
      }
    }
  }
`;

async function fetchRows(shopify: ShopifyClient): Promise<CatalogRow[]> {
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
      });
    }
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return rows;
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

  let rows = await fetchRows(shopify);
  console.log(`Fetched ${rows.length} Watch / ebay-tagged products`);
  if (flags.apply && rows.length === 0) {
    throw new Error('Fetched 0 Watch products — refusing to no-op APPLY (likely a catalog query failure).');
  }
  if (flags.limit) rows = rows.slice(0, flags.limit);

  const preview: string[] = [['handle', 'title', 'status', 'kind', 'changed'].join(',')];
  const descriptions: Array<{ id: string; handle: string; html: string }> = [];

  for (const row of rows) {
    const kind = listingKindFromProduct({ productType: row.productType, tags: row.tags });
    const { html, changed } = applyBrandedTemplate(row.descriptionHtml, kind);
    if (!changed) continue;
    descriptions.push({ id: row.id, handle: row.handle, html });
    preview.push(
      [csvEscape(row.handle), csvEscape(row.title), csvEscape(row.status), kind, 'yes'].join(','),
    );
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, 'branded-descriptions.csv'), `${preview.join('\n')}\n`);

  const report = [
    '# Laura Milman branded listing descriptions',
    '',
    `- Catalog rows: ${rows.length}`,
    `- Descriptions to write: ${descriptions.length}`,
    `- Mode: ${flags.apply ? 'APPLY' : 'dry-run'}`,
    '',
    'Shopify `descriptionHtml` is what Marketplace Connect sends to eBay.',
    'Unique estate copy is kept; missing authentication / house / guarantee paragraphs are appended.',
    '',
  ].join('\n');
  await writeFile(path.join(OUT_DIR, 'branded-descriptions.md'), report);
  console.log(report);

  if (!flags.apply) {
    console.log('Dry-run complete. Re-run with --apply to write Shopify.');
    return;
  }

  const descErrors: string[] = [];
  for (const d of descriptions) {
    const errs = await updateDescription(shopify, d.id, d.html);
    if (errs.length) descErrors.push(`${d.handle}: ${errs.join('; ')}`);
  }
  if (descErrors.length) {
    await writeFile(path.join(OUT_DIR, 'branded-descriptions-errors.txt'), `${descErrors.join('\n')}\n`);
    throw new Error(`Shopify description writes had errors: ${descErrors.length}`);
  }
  console.log(`Rewrote ${descriptions.length} descriptions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
