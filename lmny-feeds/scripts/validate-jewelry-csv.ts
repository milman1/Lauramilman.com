/**
 * Usage: npx tsx scripts/validate-jewelry-csv.ts path/to/products.csv
 *
 * Draft-import structural preflight. Exit 0 does not authorize activation.
 * Exit 1 otherwise. Run this before Shopify Admin → Products → Import.
 */
import { readFileSync } from 'node:fs';
import { formatJewelryCsvReport, validateJewelryCsv } from '../src/jewelryCsv.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npx tsx scripts/validate-jewelry-csv.ts path/to/products.csv');
  process.exit(2);
}
const issues = validateJewelryCsv(readFileSync(file, 'utf8'));
process.stdout.write(formatJewelryCsvReport(issues));
process.exit(issues.length === 0 ? 0 : 1);
