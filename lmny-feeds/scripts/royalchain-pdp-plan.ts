/**
 * Rewrites the live Royal Chain chain drafts into the store's product-page shape:
 * one prose paragraph in the body and every spec in the theme's Specifications
 * grid (`product.metafields.custom.*`).
 *
 * Pure and offline. It reads a saved GraphQL catalog snapshot, recomputes the
 * public copy with the same helpers the listing builder uses, and writes one
 * JSONL line per product. It has no Shopify client and performs no network or
 * live catalog operation; applying the plan is a separate, reviewed step.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  assertRoyalChainPublicScrubbed,
  royalChainLengthValue,
  royalChainListingCopy,
  ROYALCHAIN_BRACELET_PRODUCT_TYPE,
  type RoyalChainListingFacts,
} from '../src/royalchain/listing.js';

export interface CatalogVariant {
  selectedOptions?: Array<{ name?: string; value?: string }>;
  title?: string;
}

export interface CatalogProduct {
  id?: string;
  handle?: string;
  descriptionHtml?: string;
  productType?: string;
  variants?: { nodes?: CatalogVariant[] };
}

export interface PdpPlanMetafield {
  namespace: 'custom';
  key: string;
  type: 'single_line_text_field';
  value: string;
}

export interface PdpPlanLine {
  productId: string;
  handle: string;
  descriptionHtml: string;
  seo: { title: string; description: string };
  metafields: PdpPlanMetafield[];
}

export interface PdpPlan {
  lines: PdpPlanLine[];
  /** Handles whose source copy did not state a required fact, with the missing keys. */
  anomalies: Array<{ handle: string; missing: string[] }>;
}

const REQUIRED_KEYS = ['metal', 'link', 'width', 'length'] as const;

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Reads the `<strong>Label:</strong> value` rows of the current Details list. */
export function parseDetailRows(descriptionHtml: string): Record<string, string> {
  const rows: Record<string, string> = {};
  for (const [, label, value] of descriptionHtml.matchAll(/<strong>([^<]+):<\/strong>\s*([^<]*)</g)) {
    rows[decodeEntities(label!)] = decodeEntities(value!);
  }
  return rows;
}

function normalizeLength(value: string): string {
  const match = /(\d+(?:\.\d+)?)/.exec(value);
  return match ? `${match[1]} in` : '';
}

/** Variant option values read `14K Yellow - 18 in`. */
function variantOptionValues(product: CatalogProduct): string[] {
  return (product.variants?.nodes ?? [])
    .map((variant) => variant.selectedOptions?.find((option) => /metal/i.test(option.name ?? ''))?.value ?? variant.title ?? '')
    .map((value) => decodeEntities(value))
    .filter(Boolean);
}

function metalFromOptions(options: string[]): string {
  const colors = [...new Set(options.map((value) => /^(\d+K)\s+(Yellow|Rose|White)/i.exec(value)).filter(Boolean).map((match) => `${match![1]!.toUpperCase()} ${match![2]![0]!.toUpperCase()}${match![2]!.slice(1).toLowerCase()} Gold`))];
  return colors.length === 1 ? colors[0]! : '';
}

/** Facts for one product, taken only from its own source copy and variants. */
export function factsFromCatalogProduct(product: CatalogProduct): RoyalChainListingFacts {
  const rows = parseDetailRows(product.descriptionHtml ?? '');
  const options = variantOptionValues(product);
  const detailLengths = (rows['Available lengths'] ?? '').split(',').map(normalizeLength).filter(Boolean);
  const optionLengths = options.map((value) => normalizeLength(value.split('-').slice(1).join('-'))).filter(Boolean);
  const lengths = [...new Set([...detailLengths, ...optionLengths])];
  const condition = (rows.Condition ?? '').toLowerCase() === 'new' ? { label: 'New', ebayCondition: '1500' } : null;
  return {
    style: rows.Style ?? '',
    widthMm: /(\d+(?:\.\d+)?)/.exec(rows.Width ?? '')?.[1] ?? '',
    metal: rows.Material || metalFromOptions(options),
    singularType: product.productType === ROYALCHAIN_BRACELET_PRODUCT_TYPE ? 'Bracelet' : 'Necklace',
    lengths,
    clasp: rows.Closure ?? '',
    finish: rows.Finish ?? '',
    condition,
  };
}

function missingFacts(facts: RoyalChainListingFacts): string[] {
  const present: Record<(typeof REQUIRED_KEYS)[number], string> = {
    metal: facts.metal,
    link: facts.style,
    width: facts.widthMm,
    length: royalChainLengthValue(facts.lengths),
  };
  return REQUIRED_KEYS.filter((key) => !present[key].trim());
}

export function royalChainPdpPlan(catalog: unknown): PdpPlan {
  const nodes = ((catalog as { data?: { products?: { nodes?: CatalogProduct[] } } }).data?.products?.nodes ?? []) as CatalogProduct[];
  const lines: PdpPlanLine[] = [];
  const anomalies: PdpPlan['anomalies'] = [];
  for (const product of nodes) {
    const handle = product.handle ?? '';
    const facts = factsFromCatalogProduct(product);
    const missing = missingFacts(facts);
    if (missing.length) anomalies.push({ handle, missing });
    const copy = royalChainListingCopy(facts);
    const line: PdpPlanLine = {
      productId: product.id ?? '',
      handle,
      descriptionHtml: copy.descriptionHtml,
      seo: copy.seo,
      metafields: copy.metafields,
    };
    assertRoyalChainPublicScrubbed(line, `plan line ${handle}`);
    lines.push(line);
  }
  return { lines, anomalies };
}

export function planToJsonl(plan: PdpPlan): string {
  return plan.lines.map((line) => JSON.stringify(line)).join('\n') + (plan.lines.length ? '\n' : '');
}

function arg(name: string): string {
  const value = process.argv.find((entry) => entry.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (!value) throw new Error(`missing required --${name}=...`);
  return value;
}

async function main(): Promise<void> {
  const plan = royalChainPdpPlan(JSON.parse(await readFile(arg('catalog'), 'utf8')));
  const output = arg('output');
  await writeFile(output, planToJsonl(plan));
  const counts = new Map<string, number>();
  for (const line of plan.lines) for (const metafield of line.metafields) counts.set(metafield.key, (counts.get(metafield.key) ?? 0) + 1);
  console.log(`Planned ${plan.lines.length} products -> ${output}; no Shopify writes.`);
  console.log(`Metafield fill: ${[...counts.entries()].map(([key, count]) => `${key}=${count}`).join(' ')}`);
  for (const anomaly of plan.anomalies) console.log(`Anomaly: ${anomaly.handle} missing ${anomaly.missing.join(', ')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
