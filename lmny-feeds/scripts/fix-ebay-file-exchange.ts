/**
 * Fix a Seller Hub File Exchange CSV that failed with error 21917328
 * (invalid payment business policy identifier).
 *
 *   npx tsx scripts/fix-ebay-file-exchange.ts \
 *     --in failed.csv \
 *     --out ebay_upload_ready_to_import.csv
 *
 * Optional: --payment-profile "Exact name from Seller Hub → Business policies"
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fixEbayFileExchange, serializeEbayFileExchange } from '../src/ebay-file-exchange.js';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

function main() {
  const inPath = arg('--in');
  const outPath = arg('--out');
  if (!inPath || !outPath) {
    console.error(
      'Usage: npx tsx scripts/fix-ebay-file-exchange.ts --in <file.csv> --out <file.csv> [--payment-profile "Name"]',
    );
    process.exit(2);
  }

  const paymentProfileName = arg('--payment-profile');
  const input = readFileSync(resolve(inPath), 'utf8');
  const result = fixEbayFileExchange(input, paymentProfileName ? { paymentProfileName } : {});
  const csv = serializeEbayFileExchange(result.infoLine, result.headers, result.rows);

  const dest = resolve(outPath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, csv, 'utf8');

  const byField = new Map<string, number>();
  for (const c of result.changes) {
    byField.set(c.field, (byField.get(c.field) ?? 0) + 1);
  }

  console.log(`Wrote ${result.rows.length} listings to ${dest}`);
  if (result.changes.length === 0) {
    console.log('No changes.');
    return;
  }
  for (const [field, n] of byField) {
    console.log(`  ${field}: ${n} row(s)`);
  }
  const titleFixes = result.changes.filter((c) => c.field === '*Title');
  for (const c of titleFixes) {
    console.log(`  ${c.customLabel}: ${c.from} → ${c.to}`);
  }
}

main();
