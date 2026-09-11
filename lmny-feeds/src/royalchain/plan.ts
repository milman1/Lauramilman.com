import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseCsv } from '../jewelryCsv.js';
import { supplierRetailFromCost } from '../../config/pricing.js';
import { buildRoyalChainProducts, type RoyalChainSource } from './listing.js';

function records(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  const header = rows[0] ?? [];
  return rows.slice(1).map((row) => Object.fromEntries(header.map((key, i) => [key, row[i] ?? ''])));
}
function money(raw: string): number {
  const n = Number(raw.replace(/[$,]/g, '').trim());
  if (!Number.isFinite(n) || n <= 0) throw new Error('invalid private cost');
  return n;
}
function privateVariants(raw: string): RoyalChainSource['variants'] {
  return raw.split(';').filter(Boolean).map((segment) => {
    const at = segment.lastIndexOf('=');
    if (at < 1) throw new Error('invalid private variant segment');
    const [cost, sku = '', grams = '', available = ''] = segment.slice(at + 1).split('|').map((value) => value.trim());
    const weightGrams = grams ? Number(grams) : undefined;
    if (grams && (!Number.isFinite(weightGrams) || weightGrams! <= 0)) throw new Error('invalid private variant gram weight');
    return { label: segment.slice(0, at).trim(), costUsd: money(cost ?? ''), sku, weightGrams, available: available === 'yes' ? true : available === 'no' ? false : undefined };
  });
}
function csv(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function collectedImageUrls(row: Record<string, string>): string[] {
  return (row.image_urls ?? '')
    .split(/[;|]/)
    .map((url) => url.trim())
    .filter(Boolean);
}
function sourceCondition(row: Record<string, string>): RoyalChainSource['condition'] {
  const state = (row.condition ?? '').trim().toLowerCase();
  if (!state) return undefined;
  if (state !== 'new' && state !== 'preowned') throw new Error(`${row.item_number ?? 'unknown'}: invalid condition state`);
  return { state, evidence: row.condition_evidence ?? '', originalPackagingEvidence: row.original_packaging_evidence ?? '' };
}

export async function generateRoyalChainPlan(opts: { shortlistPath: string; privatePath: string; outputDir: string; expectedProducts?: number; expectedVariants?: number }): Promise<{ products: number; variants: number }> {
  const shortlist = records(await readFile(opts.shortlistPath, 'utf8'));
  const privateRows = records(await readFile(opts.privatePath, 'utf8'));
  const privateByItem = new Map(privateRows.map((row) => [row.item_number, row]));
  if (privateByItem.size !== privateRows.length) throw new Error('duplicate private item number');
  const products: Record<string, unknown>[] = [];
  for (const row of shortlist) {
    const itemNumber = row.item_number ?? '';
    const url = row.url ?? '';
    const priv = privateByItem.get(itemNumber);
    if (!priv || priv.url !== url || priv.error) throw new Error(`${itemNumber}: private row missing, mismatched, or errored`);
    const variants = privateVariants(priv.lengths_karats ?? '');
    const first = variants[0];
    if (!first || money(priv.cost ?? '') !== first.costUsd) throw new Error(`${itemNumber}: top-level cost is not the first displayed variant`);
    if (money(priv.retail ?? '') !== supplierRetailFromCost(first.costUsd)) throw new Error(`${itemNumber}: top-level retail fails pricing rule`);
    const source: RoyalChainSource = {
      itemNumber,
      style: row.style ?? '',
      widthMm: row.width_mm ?? '',
      imageUrl: row.image_url ?? '',
      imageUrls: collectedImageUrls(row),
      condition: sourceCondition(row),
      variants,
    };
    products.push(...buildRoyalChainProducts(source));
  }
  const variantCount = products.reduce((n, p) => n + (p.variants as unknown[]).length, 0);
  if (products.length !== (opts.expectedProducts ?? 21) || variantCount !== (opts.expectedVariants ?? 93)) throw new Error(`unexpected plan size: ${products.length} products / ${variantCount} variants`);
  await mkdir(opts.outputDir, { recursive: true });
  await writeFile(path.join(opts.outputDir, 'royalchain-products.jsonl'), products.map((p) => JSON.stringify(p)).join('\n') + '\n');
  const lines = ['handle,status,vendor,product_type,category,title,image_url,tags,variant_label,sku,retail,cost'];
  for (const product of products) for (const variant of product.variants as Array<Record<string, unknown>>) {
    const label = ((variant.optionValues as Array<{ name: string }>)[0]?.name ?? '');
    const cost = (variant.inventoryItem as { cost: string }).cost;
    lines.push([product.handle, product.status, product.vendor, product.productType, product.category, product.title, ((product.files as Array<{ originalSource: string }>)[0]?.originalSource ?? ''), (product.tags as string[]).join(';'), label, variant.sku, variant.price, cost].map(csv).join(','));
  }
  await writeFile(path.join(opts.outputDir, 'royalchain-products.csv'), lines.join('\n') + '\n');
  return { products: products.length, variants: variantCount };
}
