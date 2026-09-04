/**
 * Fill custom.* eBay item specifics on every Shopify Watch product.
 *
 * Default is dry-run (counts + CSVs, no writes). Pass --apply after review.
 *
 *   npx tsx scripts/backfill-ebay-watch-specifics.ts
 *   npx tsx scripts/backfill-ebay-watch-specifics.ts --apply
 *   npx tsx scripts/backfill-ebay-watch-specifics.ts --limit=25
 *
 * Selects product_type:Watch (estate + lmny-feed + backvault-feed). Existing
 * custom.model / custom.case_size are kept. Duplicate SKUs (e.g. Chopardissimo
 * original + bv- reimport) are reported, not deleted.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  EBAY_WATCH_KEYS,
  ebayMetafieldInputs,
  extractEbayWatchSpecifics,
  findDuplicateWatchGroups,
  type EbayWatchKey,
} from '../src/ebayWatchSpecifics.js';
import { PRODUCT_TYPES } from '../src/product.js';
import { ShopifyClient, downloadJsonl, exchangeClientCredentials } from '../src/shopify.js';

const OUT_DIR = 'out';

interface Flags {
  apply: boolean;
  limit: number | null;
}

interface WatchRow {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  status: string;
  tags: string[];
  descriptionHtml: string;
  sku: string | null;
  existing: Partial<Record<EbayWatchKey, string>>;
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

async function fetchWatchRows(shopify: ShopifyClient): Promise<WatchRow[]> {
  const query = `{
    products(query: "product_type:'${PRODUCT_TYPES.watch}'") {
      edges {
        node {
          id
          handle
          title
          vendor
          status
          tags
          descriptionHtml
          variants {
            edges {
              node { sku }
            }
          }
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

  const byId = new Map<string, WatchRow>();
  const order: string[] = [];
  for (const row of lines) {
    const r = row as Record<string, unknown>;
    if (typeof r.handle === 'string' && typeof r.id === 'string' && typeof r.title === 'string') {
      byId.set(r.id, {
        id: r.id,
        handle: r.handle,
        title: r.title,
        vendor: String(r.vendor ?? ''),
        status: String(r.status ?? ''),
        tags: (r.tags as string[]) ?? [],
        descriptionHtml: String(r.descriptionHtml ?? ''),
        sku: null,
        existing: {},
      });
      order.push(r.id);
      continue;
    }
    if (typeof r.__parentId !== 'string') continue;
    const parent = byId.get(r.__parentId);
    if (!parent) continue;
    if (typeof r.sku === 'string' || r.sku === null) {
      if (typeof r.sku === 'string' && r.sku.trim()) parent.sku = r.sku.trim();
      continue;
    }
    if (r.namespace === 'custom' && typeof r.key === 'string' && typeof r.value === 'string') {
      if ((EBAY_WATCH_KEYS as readonly string[]).includes(r.key)) {
        parent.existing[r.key as EbayWatchKey] = r.value;
      }
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

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const domain = requireEnv('SHOPIFY_STORE_DOMAIN');
  const shopify = new ShopifyClient(domain, await resolveToken(domain));
  const { shop } = await shopify.verifyAuth();
  console.log(`Shopify auth OK: ${shop}`);
  console.log(flags.apply ? 'MODE: APPLY (will write custom.* metafields)' : 'MODE: dry-run (counts + CSVs — zero writes)');

  if (flags.apply) {
    await shopify.ensureMetafieldDefinitions();
  }

  let rows = await fetchWatchRows(shopify);
  console.log(`Fetched ${rows.length} product_type:Watch products`);
  if (flags.limit) rows = rows.slice(0, flags.limit);

  const filled: Record<EbayWatchKey, number> = {
    band_material: 0,
    case_size: 0,
    department: 0,
    handedness: 0,
    model: 0,
    style: 0,
    type: 0,
  };
  const missing: Record<EbayWatchKey, number> = { ...filled };
  const flagRows: string[] = [];
  const previewRows: string[] = [];
  const toWrite: Array<{ ownerId: string; namespace: string; key: string; type: string; value: string }> = [];

  for (const row of rows) {
    const extracted = extractEbayWatchSpecifics({
      title: row.title,
      descriptionHtml: row.descriptionHtml,
      sku: row.sku,
    });
    const inputs = ebayMetafieldInputs(row.id, extracted.values, row.existing);
    toWrite.push(...inputs);
    const merged: Record<string, string> = { ...row.existing };
    for (const mf of inputs) merged[mf.key] = mf.value;
    for (const key of EBAY_WATCH_KEYS) {
      const value = (merged[key] ?? extracted.values[key] ?? row.existing[key] ?? '').trim();
      if (value) filled[key] += 1;
      else missing[key] += 1;
    }
    previewRows.push(
      [
        row.handle,
        row.id,
        row.status,
        row.sku ?? '',
        row.title,
        merged.band_material ?? '',
        merged.case_size ?? '',
        merged.department ?? '',
        merged.handedness ?? '',
        merged.model ?? '',
        merged.style ?? '',
        merged.type ?? '',
        inputs.length,
      ]
        .map((c) => csvEscape(String(c)))
        .join(','),
    );
    for (const flag of extracted.flags) {
      flagRows.push(
        [row.handle, row.id, row.title, flag.field, flag.reason, flag.excerpt ?? '']
          .map((c) => csvEscape(String(c)))
          .join(','),
      );
    }
    if (!merged.case_size) {
      flagRows.push(
        [row.handle, row.id, row.title, 'case_size', 'not stated with enough confidence', '']
          .map((c) => csvEscape(String(c)))
          .join(','),
      );
    }
    if (!merged.band_material) {
      flagRows.push(
        [row.handle, row.id, row.title, 'band_material', 'not stated with enough confidence', '']
          .map((c) => csvEscape(String(c)))
          .join(','),
      );
    }
  }

  const dupes = findDuplicateWatchGroups(
    rows.map((r) => ({
      id: r.id,
      handle: r.handle,
      title: r.title,
      sku: r.sku,
      tags: r.tags,
      status: r.status,
    })),
  );
  const dupeRows: string[] = [];
  for (const g of dupes) {
    for (const p of g.products) {
      const isBv = p.handle.startsWith('bv-') || (p.tags ?? []).includes('backvault-feed');
      const groupHasBv = g.products.some(
        (x) => x.handle.startsWith('bv-') || (x.tags ?? []).includes('backvault-feed'),
      );
      const keep = isBv ? 'skip-on-ebay (backvault copy)' : groupHasBv ? 'keep' : 'review — same SKU, no bv- pair';
      dupeRows.push(
        [g.key, g.reason, p.id, p.handle, p.sku ?? '', p.title, keep]
          .map((c) => csvEscape(String(c)))
          .join(','),
      );
    }
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUT_DIR, 'ebay-watch-specifics.csv'),
    'handle,id,status,sku,title,band_material,case_size,department,handedness,model,style,type,writes\n' +
      previewRows.join('\n') +
      '\n',
  );
  await writeFile(
    path.join(OUT_DIR, 'ebay-watch-flags.csv'),
    'handle,id,title,field,reason,excerpt\n' + flagRows.join('\n') + (flagRows.length ? '\n' : ''),
  );
  await writeFile(
    path.join(OUT_DIR, 'ebay-watch-duplicates.csv'),
    'group,reason,id,handle,sku,title,recommendation\n' + dupeRows.join('\n') + (dupeRows.length ? '\n' : ''),
  );

  const summary = [
    '## eBay watch item specifics',
    '',
    `Products: ${rows.length}`,
    `Metafield writes queued: ${toWrite.length}`,
    `Duplicate groups: ${dupes.length} (${dupeRows.length} product rows)`,
    '',
    '| Field | Filled | Blank |',
    '|---|---|---|',
    ...EBAY_WATCH_KEYS.map((k) => `| ${k} | ${filled[k]} | ${missing[k]} |`),
    '',
    'CSVs: `out/ebay-watch-specifics.csv`, `out/ebay-watch-flags.csv`, `out/ebay-watch-duplicates.csv`.',
    '',
    'After a live run: Marketplace Connect → Mapping → Item specifics → set each of the seven keys from Inactive to **Use [key] from custom**. List Timepieces / `ebay` only — do not list both halves of a duplicate pair.',
  ].join('\n');
  await writeFile(path.join(OUT_DIR, 'ebay-watch-report.md'), `${summary}\n`);
  console.log(summary);

  if (!flags.apply) {
    console.log('Dry-run complete. Re-run with --apply after reviewing CSVs to write metafields.');
    return;
  }

  const errors = await shopify.setMetafields(toWrite);
  console.log(`APPLY done: metafields sent ${toWrite.length}, errors ${errors.length}`);
  if (errors.length) {
    await writeFile(path.join(OUT_DIR, 'ebay-watch-errors.txt'), errors.join('\n') + '\n');
    console.error(errors.slice(0, 20).join('\n'));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
