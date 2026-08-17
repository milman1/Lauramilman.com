/**
 * Build Seller Hub files that switch live watch listings to no returns.
 *
 *   npx tsx scripts/build-ebay-revise-returns.ts \
 *     --listings ebay/ebay_listings_ready_to_publish.csv \
 *     --live ebay/watch_item_ids.tsv \
 *     --out-dir ebay
 *
 * Optional: --results path/to/seller-hub-results.csv to add more ItemIDs.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  applyReturnProfile,
  buildClassicReviseNoReturns,
  isEbayListingsTemplate,
  LMNY_EBAY_RETURN_PROFILE,
  matchLiveWatchesToRows,
  parseEbayListingsTemplate,
  parseEbayResultsRows,
  serializeEbayListingsTemplate,
  toListingsReviseRows,
  type EbayWatchItemRef,
} from '../src/ebay-file-exchange.js';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

function parseLiveTsv(text: string): Array<{ itemId: string; title: string; sku?: string }> {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [itemId, title, sku] = line.split('\t');
      return { itemId: (itemId ?? '').trim(), title: (title ?? '').trim(), sku: sku?.trim() };
    })
    .filter((row) => /^\d{10,14}$/.test(row.itemId));
}

function main() {
  const listingsPath = arg('--listings') ?? 'ebay/ebay_listings_ready_to_publish.csv';
  const livePath = arg('--live') ?? 'ebay/watch_item_ids.tsv';
  const resultsPath = arg('--results');
  const outDir = resolve(arg('--out-dir') ?? 'ebay');

  const listingsText = readFileSync(resolve(listingsPath), 'utf8');
  if (!isEbayListingsTemplate(listingsText)) {
    throw new Error(`Not a listings template: ${listingsPath}`);
  }
  const listings = parseEbayListingsTemplate(listingsText);
  const returnEdits = applyReturnProfile(listings.rows, listings.headers);
  const publishCsv = serializeEbayListingsTemplate(listings.infoLines, listings.headers, listings.rows);
  mkdirSync(outDir, { recursive: true });
  const publishOut = resolve(outDir, 'ebay_listings_ready_to_publish.csv');
  writeFileSync(publishOut, publishCsv, 'utf8');

  const live = parseLiveTsv(readFileSync(resolve(livePath), 'utf8'));
  const fromTitles = matchLiveWatchesToRows(
    listings.rows,
    live.map((row) => ({ itemId: row.itemId, title: row.title })),
  );

  const bySku = new Map<string, EbayWatchItemRef>();
  for (const item of fromTitles.matched) bySku.set(item.sku, item);
  for (const row of live) {
    if (row.sku && !bySku.has(row.sku)) {
      bySku.set(row.sku, { itemId: row.itemId, sku: row.sku, title: row.title });
    }
  }
  if (resultsPath) {
    for (const row of parseEbayResultsRows(readFileSync(resolve(resultsPath), 'utf8'))) {
      if (row.sku) bySku.set(row.sku, { itemId: row.itemId, sku: row.sku, title: row.title });
    }
  }

  const items = [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku, 'en'));
  const classic = buildClassicReviseNoReturns(items);
  const classicOut = resolve(outDir, 'ebay_file_exchange_revise_no_returns.csv');
  writeFileSync(classicOut, classic, 'utf8');

  const revise = toListingsReviseRows(listings.rows, listings.headers, items);
  const listingsRevise = serializeEbayListingsTemplate(listings.infoLines, revise.headers, revise.rows);
  const listingsOut = resolve(outDir, 'ebay_listings_revise_no_returns.csv');
  writeFileSync(listingsOut, listingsRevise, 'utf8');

  const mappingOut = resolve(outDir, 'watch_item_ids.tsv');
  if (resolve(livePath) !== mappingOut) {
    mkdirSync(dirname(mappingOut), { recursive: true });
  }
  writeFileSync(
    mappingOut,
    items.map((item) => `${item.itemId}\t${item.title}\t${item.sku}`).join('\n') + '\n',
    'utf8',
  );

  console.log(`Return profile: ${LMNY_EBAY_RETURN_PROFILE}`);
  console.log(`Updated ${returnEdits} publish row(s) → ${publishOut}`);
  console.log(`Revise ${items.length} live watch(es) → ${classicOut}`);
  console.log(`Revise listings template → ${listingsOut}`);
  console.log(`Unmatched live titles (not watches from this file): ${fromTitles.unmatchedLive.length}`);
}

main();
