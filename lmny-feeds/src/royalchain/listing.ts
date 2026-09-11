import { supplierRetailFromCost } from '../../config/pricing.js';
import { taxonomyGidForProductType } from '../taxonomy.js';

export const ROYALCHAIN_VENDOR = 'Laura Milman New York';
export const ROYALCHAIN_PRODUCT_TYPE = 'Necklaces';
export const ROYALCHAIN_CATEGORY = taxonomyGidForProductType(ROYALCHAIN_PRODUCT_TYPE);
export const ROYALCHAIN_MINIMUM_IMAGES = 3;
export const EBAY_TITLE_MAX = 80;

export interface RoyalChainVariant {
  label: string;
  costUsd: number;
}

/** A condition is usable only when the source record states it and preserves its evidence. */
export interface RoyalChainCondition {
  state: 'new' | 'preowned';
  evidence: string;
}

export interface RoyalChainSource {
  itemNumber: string;
  style: string;
  widthMm: string;
  /** @deprecated Use imageUrls so every collected source image is retained. */
  imageUrl?: string;
  imageUrls?: string[];
  condition?: RoyalChainCondition;
  variants: RoyalChainVariant[];
}

interface MetafieldValue {
  namespace: 'custom';
  key: string;
  type: 'single_line_text_field';
  value: string;
}

const FORBIDDEN_SUPPLIER_PATTERN = /royal[\s._-]*chain(?:\.com)?/i;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function fitWithSuffix(lead: string, suffix: string, max: number): string {
  if (`${lead} ${suffix}`.length <= max) return `${lead} ${suffix}`;
  const room = max - suffix.length - 1;
  const cut = lead.slice(0, room + 1);
  const boundary = cut.lastIndexOf(' ');
  return `${(boundary > 0 ? cut.slice(0, boundary) : cut).trim()} ${suffix}`.trim();
}

function truncateAtWord(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max + 1);
  const boundary = cut.lastIndexOf(' ');
  return (boundary > 0 ? cut.slice(0, boundary) : cut.slice(0, max)).trim();
}

/**
 * This is deliberately a final, fail-closed check rather than a cleanup step.
 * Supplier image source URLs are excluded because Shopify imports them and serves
 * the finished media from its CDN; every string that can be public is checked.
 */
export function assertRoyalChainPublicScrubbed(value: unknown, path = 'public copy'): void {
  if (typeof value === 'string') {
    if (FORBIDDEN_SUPPLIER_PATTERN.test(value)) throw new Error(`supplier name is forbidden in ${path}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertRoyalChainPublicScrubbed(entry, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      assertRoyalChainPublicScrubbed(entry, `${path}.${key}`);
    }
  }
}

/** Preserve every source image once; Shopify copies these source URLs onto its CDN after import. */
export function dedupeRoyalChainImageUrls(source: Pick<RoyalChainSource, 'imageUrl' | 'imageUrls'>): string[] {
  return [...new Set([...(source.imageUrls ?? []), source.imageUrl ?? ''].map(clean).filter(Boolean))];
}

/** Accept only ready Shopify CDN URLs when recording the post-import media result. */
export function shopifyCdnMediaUrlsAfterImport(urls: string[]): string[] {
  return [...new Set(urls.map(clean).filter((url) => /^https:\/\/cdn\.shopify\.com\//i.test(url)))];
}

function conditionFacts(condition: RoyalChainCondition | undefined): { label: string; ebayCondition: string } | null {
  if (!condition || !clean(condition.evidence)) return null;
  if (condition.state !== 'new' && condition.state !== 'preowned') throw new Error('invalid condition state');
  return condition.state === 'new'
    ? { label: 'New', ebayCondition: '1000' }
    : { label: 'Pre-owned', ebayCondition: '3000' };
}

function metalAndLengths(variants: RoyalChainVariant[], itemNumber: string): { metal: string; lengths: string[] } {
  const parsed = variants.map((variant) => {
    const label = clean(variant.label);
    const match = /^14K (Yellow|Rose|White):(\d+(?:\.\d+)?)in$/i.exec(label);
    const color = match?.[1];
    const length = match?.[2];
    if (!color || !length) throw new Error(`${itemNumber}: invalid variant label`);
    return { label, metal: `14K ${color[0]!.toUpperCase()}${color.slice(1).toLowerCase()} Gold`, length: `${length} in` };
  });
  const metals = [...new Set(parsed.map((variant) => variant.metal))];
  if (metals.length !== 1) throw new Error(`${itemNumber}: variants do not share one metal`);
  return { metal: metals[0]!, lengths: [...new Set(parsed.map((variant) => variant.length))] };
}

function detailsHtml(details: Array<[string, string]>): string {
  return `<h2>Details</h2><ul>${details.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join('')}</ul>`;
}

export function buildRoyalChainProduct(source: RoyalChainSource): Record<string, unknown> {
  const itemNumber = clean(source.itemNumber);
  const style = clean(source.style);
  const width = clean(source.widthMm);
  if (!itemNumber || !style || !width || source.variants.length === 0) throw new Error('incomplete Royal Chain source row');

  const { metal, lengths } = metalAndLengths(source.variants, itemNumber);
  const condition = conditionFacts(source.condition);
  const title = `${width}mm ${style} Chain in ${metal}`;
  const ebayTitle = truncateAtWord(title, EBAY_TITLE_MAX);
  const descriptionDetails: Array<[string, string]> = [
    ['Material', metal],
    ['Style', style],
    ['Width', `${width} mm`],
    ['Available lengths', lengths.join(', ')],
    ...(condition ? [['Condition', condition.label] as [string, string]] : []),
  ];
  const descriptionHtml = `<section class="lmny-product-description"><p>This ${escapeHtml(width)}mm ${escapeHtml(style.toLowerCase())} chain is crafted in ${escapeHtml(metal)} and offered by Laura Milman New York.</p>${detailsHtml(descriptionDetails)}</section>`;
  const seoTitle = fitWithSuffix(title, '| Laura Milman', 60);
  const seoDescription = truncateAtWord(`Shop the ${width}mm ${style.toLowerCase()} chain in ${metal}, available in ${lengths.join(' and ')}, from Laura Milman New York.`, 160);
  const handle = `lmny-${itemNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
  const imageUrls = dedupeRoyalChainImageUrls(source);
  const mediaReady = imageUrls.length >= ROYALCHAIN_MINIMUM_IMAGES;
  const tags = [ROYALCHAIN_VENDOR, ROYALCHAIN_PRODUCT_TYPE, ...(mediaReady ? [] : ['media-missing'])];
  const metafields: MetafieldValue[] = [
    { namespace: 'custom', key: 'metal_type', type: 'single_line_text_field', value: metal },
    { namespace: 'custom', key: 'measurements', type: 'single_line_text_field', value: `${width} mm wide; available in ${lengths.join(', ')}` },
    ...(condition
      ? [
          { namespace: 'custom' as const, key: 'condition', type: 'single_line_text_field' as const, value: condition.label },
          { namespace: 'custom' as const, key: 'ebay_condition', type: 'single_line_text_field' as const, value: condition.ebayCondition },
        ]
      : []),
  ];
  const contentReady = Boolean(title && descriptionHtml && seoTitle && seoDescription && metafields.length >= 2);
  const conditionReady = Boolean(condition);
  const ebay = {
    eligible: mediaReady && contentReady && conditionReady,
    blockers: [
      ...(mediaReady ? [] : [`requires at least ${ROYALCHAIN_MINIMUM_IMAGES} source images`]),
      ...(contentReady ? [] : ['requires complete public copy and item specifics']),
      ...(conditionReady ? [] : ['requires source-backed condition evidence']),
    ],
    title: ebayTitle,
    itemSpecifics: {
      Brand: ROYALCHAIN_VENDOR,
      Type: 'Necklace',
      Material: 'Gold',
      Metal: metal,
      Style: style,
      'Chain Type': style,
      Width: `${width} mm`,
      Length: lengths.join(', '),
      ...(condition ? { Condition: condition.label, 'Condition ID': condition.ebayCondition } : {}),
    },
    itemSpecificMapping: {
      Metal: 'custom.metal_type',
      Width: 'custom.measurements',
      Length: 'variant option: Metal / Length',
      Condition: 'custom.condition',
      'Condition ID': 'custom.ebay_condition',
    },
  };
  const product = {
    handle,
    title,
    descriptionHtml,
    vendor: ROYALCHAIN_VENDOR,
    productType: ROYALCHAIN_PRODUCT_TYPE,
    category: ROYALCHAIN_CATEGORY,
    status: 'DRAFT' as const,
    tags,
    metafields,
    seo: { title: seoTitle, description: seoDescription },
    productOptions: [{ name: 'Metal / Length', values: source.variants.map((variant) => ({ name: clean(variant.label).replace(':', ' / ') })) }],
    variants: source.variants.map((variant) => ({
      optionValues: [{ optionName: 'Metal / Length', name: clean(variant.label).replace(':', ' / ') }],
      price: supplierRetailFromCost(variant.costUsd).toFixed(2),
      sku: itemNumber,
      taxable: true,
      inventoryPolicy: 'DENY',
      inventoryItem: { tracked: true, requiresShipping: true, cost: variant.costUsd.toFixed(2) },
    })),
    files: imageUrls.map((url, index) => ({
      originalSource: url,
      contentType: 'IMAGE',
      alt: `${title}${index > 0 ? ` — view ${index + 1}` : ''}`,
      duplicateResolutionMode: 'APPEND_UUID',
    })),
    ebay,
  };
  assertRoyalChainPublicScrubbed({
    handle: product.handle,
    title: product.title,
    descriptionHtml: product.descriptionHtml,
    vendor: product.vendor,
    tags: product.tags,
    metafields: product.metafields,
    seo: product.seo,
    variants: product.variants.map(({ sku, optionValues }) => ({ sku, optionValues })),
    imageAlt: product.files.map((file) => file.alt),
    ebay: product.ebay,
  });
  return product;
}
