/**
 * Reprice live Shopify feed watches with the cost-tier formula.
 *
 * Default is dry-run counts only (no writes). Pass --apply only after the
 * dry-run counts have been reviewed.
 *
 *   npx tsx scripts/backfill-watch-pricing.ts
 *   npx tsx scripts/backfill-watch-pricing.ts --apply
 *   npx tsx scripts/backfill-watch-pricing.ts --limit=25
 *
 * Selects product_type:Watch + tag:lmny-feed (~620). Reads InventoryItem.cost.
 * Retail is cost × chart multiplier — Hours mid is not used. no_cost → tag
 * pricing-review, leave existing price.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FEED_TAG, PRICING_REVIEW_TAG, PRODUCT_TYPES } from '../src/product.js';
import { ShopifyClient, downloadJsonl, exchangeClientCredentials } from '../src/shopify.js';
import { priceWatchFromCost } from '../src/watchPricing.js';

const OUT_DIR = 'out';
const REVIEW_CSV = 'needs_review.csv';

interface Flags {
  apply: boolean;
  limit: number | null;
}

interface WatchRow {
  id: string;
  handle: string;
  title: string;
  tags: string[];
  variantId: string | null;
  price: number | null;
  costUsd: number | null;
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

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

async function fetchWatchRows(shopify: ShopifyClient): Promise<WatchRow[]> {
  // Bulk query flattens nested connections; variants follow their product.
  // Cost comes from InventoryItem.unitCost (written by sync).
  const query = `{
    products(query: "product_type:'${PRODUCT_TYPES.watch}' AND tag:'${FEED_TAG}'") {
      edges {
        node {
          id
          handle
          title
          tags
          variants(first: 1) {
            edges {
              node {
                id
                price
                inventoryItem { unitCost { amount } }
              }
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

  const byId = new Map<string, WatchRow>();
  const order: string[] = [];
  for (const row of lines) {
    const r = row as Record<string, unknown>;
    if (typeof r.handle === 'string' && typeof r.id === 'string') {
      byId.set(r.id, {
        id: r.id,
        handle: r.handle,
        title: String(r.title ?? ''),
        tags: (r.tags as string[]) ?? [],
        variantId: null,
        price: null,
        costUsd: null,
      });
      order.push(r.id);
    } else if (typeof r.__parentId === 'string' && typeof r.id === 'string' && r.price != null) {
      const parent = byId.get(r.__parentId);
      if (!parent) continue;
      parent.variantId = r.id;
      parent.price = numOrNull(r.price);
      const unitCost = (r.inventoryItem as { unitCost?: { amount?: string } | null } | null)?.unitCost?.amount;
      parent.costUsd = numOrNull(unitCost);
    }
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
    }>(`{ currentBulkOperation { status errorCode url objectCount } }`);
    const op = data.currentBulkOperation;
    if (!op) return null;
    if (op.status === 'COMPLETED') return op.url;
    if (op.status === 'FAILED' || op.status === 'CANCELED') {
      throw new Error(`Bulk operation ${op.status}: ${op.errorCode ?? 'unknown'}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const domain = requireEnv('SHOPIFY_STORE_DOMAIN');
  const shopify = new ShopifyClient(domain, await resolveToken(domain));
  const { shop } = await shopify.verifyAuth();
  console.log(`Shopify auth OK: ${shop}`);
  console.log(flags.apply ? 'MODE: APPLY (will write prices / tags)' : 'MODE: dry-run (counts only — zero writes)');

  let rows = await fetchWatchRows(shopify);
  console.log(`Fetched ${rows.length} Watch + ${FEED_TAG} products`);
  if (flags.limit) rows = rows.slice(0, flags.limit);

  const counts = { priced: 0, no_cost: 0, excluded: 0, unchanged: 0 };
  const reviewRows: string[] = [];
  const pricedUpdates: Array<{ row: WatchRow; retailUsd: number }> = [];
  const tagOnly: WatchRow[] = [];

  for (const row of rows) {
    const outcome = priceWatchFromCost({
      costUsd: row.costUsd,
    });
    if (outcome.status === 'priced') {
      counts.priced += 1;
      if (row.price != null && Math.abs(row.price - outcome.retailUsd) < 0.005) {
        counts.unchanged += 1;
      } else {
        pricedUpdates.push({ row, retailUsd: outcome.retailUsd });
      }
    } else if (outcome.status === 'no_cost') {
      counts.no_cost += 1;
      tagOnly.push(row);
      reviewRows.push(
        [row.handle, row.title, outcome.status, '', row.costUsd ?? '', '', row.price ?? '']
          .map((c) => csvEscape(String(c)))
          .join(','),
      );
    } else {
      counts.excluded += 1;
    }
  }

  console.log('=== Watch pricing dry-run counts ===');
  console.log(`total          ${rows.length}`);
  console.log(`priced         ${counts.priced}  (${pricedUpdates.length} would change; ${counts.unchanged} already match)`);
  console.log(`no_cost        ${counts.no_cost}`);
  console.log(`excluded       ${counts.excluded}`);

  await mkdir(OUT_DIR, { recursive: true });
  if (reviewRows.length > 0) {
    const header = 'handle,title,status,reason,cost_usd,computed_retail,current_price\n';
    await writeFile(path.join(OUT_DIR, REVIEW_CSV), header + reviewRows.join('\n') + '\n');
    console.log(`Wrote ${reviewRows.length} review row(s) → ${path.join(OUT_DIR, REVIEW_CSV)}`);
  }

  if (!flags.apply) {
    console.log('Dry-run complete. Re-run with --apply after reviewing counts to push prices live.');
    return;
  }

  let pricesWritten = 0;
  let tagsWritten = 0;
  const errors: string[] = [];

  for (const { row, retailUsd } of pricedUpdates) {
    if (!row.variantId) {
      errors.push(`${row.handle}: no variant id`);
      continue;
    }
    try {
      const data = await shopify.gql<{
        productVariantsBulkUpdate: { userErrors: Array<{ message: string }> };
      }>(
        `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            userErrors { message }
          }
        }`,
        {
          productId: row.id,
          variants: [{ id: row.variantId, price: retailUsd.toFixed(2) }],
        },
      );
      const errs = data.productVariantsBulkUpdate.userErrors;
      if (errs.length) errors.push(`${row.handle}: ${errs.map((e) => e.message).join('; ')}`);
      else {
        pricesWritten += 1;
        // Clear stale pricing-review tag when price goes live cleanly.
        if (row.tags.includes(PRICING_REVIEW_TAG)) {
          const tagErrs = await shopify.setProductTags(
            row.id,
            row.tags.filter((t) => t !== PRICING_REVIEW_TAG),
          );
          if (tagErrs.length) errors.push(`${row.handle} clear-tag: ${tagErrs.join('; ')}`);
        }
      }
    } catch (err) {
      errors.push(`${row.handle}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const row of tagOnly) {
    if (row.tags.includes(PRICING_REVIEW_TAG)) continue;
    const tagErrs = await shopify.setProductTags(row.id, [...row.tags, PRICING_REVIEW_TAG]);
    if (tagErrs.length) errors.push(`${row.handle} tag: ${tagErrs.join('; ')}`);
    else tagsWritten += 1;
  }

  console.log(`APPLY done: prices written ${pricesWritten}, pricing-review tags added ${tagsWritten}, errors ${errors.length}`);
  if (errors.length) {
    await writeFile(path.join(OUT_DIR, 'watch_pricing_errors.txt'), errors.join('\n') + '\n');
    console.error(errors.slice(0, 20).join('\n'));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
