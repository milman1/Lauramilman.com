import { supplierRetailFromCost } from '../../config/pricing.js';
import { taxonomyGidForProductType } from '../taxonomy.js';

export const ROYALCHAIN_VENDOR = 'Laura Milman New York';
export const ROYALCHAIN_PRODUCT_TYPE = 'Necklaces';
export const ROYALCHAIN_CATEGORY = taxonomyGidForProductType(ROYALCHAIN_PRODUCT_TYPE);
export const ROYALCHAIN_BRACELET_PRODUCT_TYPE = 'Bracelets';
export const ROYALCHAIN_MINIMUM_IMAGES = 3;
export const EBAY_TITLE_MAX = 80;

const EXISTING_HANDLES: Record<string, string> = {
  NMC120: 'lmny-cuban-3-9-mm-nmc120', NHMC120: 'lmny-cuban-4-5-mm-nhmc120', NHMC150: 'lmny-cuban-5-mm-nhmc150', HMC150: 'lmny-cuban-5-5-mm-hmc150', MC180: 'lmny-cuban-6-mm-mc180',
  PCLIP060: 'lmny-paperclip-2-5-mm-pclip060', PCLIP095: 'lmny-paperclip-4-mm-pclip095', CH014: 'lmny-rope-1-8-mm-ch014', PROY018: 'lmny-rope-2-3-mm-proy018', HSR018: 'lmny-rope-2-5-mm-hsr018', SLK023: 'lmny-rope-3-mm-slk023',
  CC080: 'lmny-curb-3-2-mm-cc080', CC100: 'lmny-curb-3-6-mm-cc100', LCRB100: 'lmny-curb-4-4-mm-lcrb100', SF030: 'lmny-herringbone-2-8-mm-sf030', SF040: 'lmny-herringbone-3-8-mm-sf040', SF050: 'lmny-herringbone-4-6-mm-sf050',
  BOX073: 'lmny-box-1-4-mm-box073', SRBX130: 'lmny-box-2-5-mm-srbx130', OVSN200: 'lmny-snake-2-mm-ovsn200', OVSN260: 'lmny-snake-2-6-mm-ovsn260',
};
const REVIEWED_WIDTH_OVERRIDES: Record<string, string> = { PCLIP095: '4.1', HSR018: '2.7' };

export interface RoyalChainVariant {
  label: string;
  costUsd: number;
  /** Supplier child SKU. Parent item numbers are never reused as marketplace SKUs. */
  sku?: string;
  /** Exact supplier-reported weight in grams. */
  weightGrams?: number;
  /** Explicit supplier availability for this child variant. */
  available?: boolean;
}

/** A condition is usable only when the source record states it and preserves its evidence. */
export interface RoyalChainCondition {
  state: 'new' | 'preowned';
  evidence: string;
  /** Required before using eBay's New in original packaging condition. */
  originalPackagingEvidence?: string;
}

export interface RoyalChainSource {
  itemNumber: string;
  /** Existing Shopify handle for the live necklace product; planner input requires it. */
  existingHandle?: string;
  style: string;
  widthMm: string;
  closure?: string;
  finish?: string;
  construction?: string;
  /** @deprecated Use imageUrls so every collected source image is retained. */
  imageUrl?: string;
  imageUrls?: string[];
  /** Successfully imported Shopify CDN media, supplied only by post-import verification. */
  shopifyCdnImageUrls?: string[];
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

export function existingRoyalChainHandle(itemNumber: string, explicit?: string): string {
  const handle = clean(explicit ?? '') || EXISTING_HANDLES[clean(itemNumber).toUpperCase()];
  if (!handle) throw new Error(`${itemNumber}: no reviewed existing handle`);
  return handle;
}

function reviewedWidth(itemNumber: string, rawWidth: string): string {
  const override = REVIEWED_WIDTH_OVERRIDES[itemNumber.toUpperCase()];
  if (override) return override;
  if (!/^\d+(?:\.\d+)?$/.test(rawWidth)) throw new Error(`${itemNumber}: unresolved width mismatch`);
  return rawWidth;
}

function conditionFacts(condition: RoyalChainCondition | undefined): { label: string; ebayCondition: string } | null {
  if (!condition || !clean(condition.evidence)) return null;
  if (condition.state !== 'new' && condition.state !== 'preowned') throw new Error('invalid condition state');
  return condition.state === 'new'
    ? { label: 'New', ebayCondition: clean(condition.originalPackagingEvidence ?? '') ? '1000' : '1500' }
    : { label: 'Pre-owned', ebayCondition: '3000' };
}

interface ParsedVariant {
  variant: RoyalChainVariant;
  metal: string;
  length: string;
  lengthInches: number;
  productType: typeof ROYALCHAIN_PRODUCT_TYPE | typeof ROYALCHAIN_BRACELET_PRODUCT_TYPE;
}

function parseVariants(variants: RoyalChainVariant[], itemNumber: string): ParsedVariant[] {
  return variants.map((variant) => {
    const label = clean(variant.label);
    const match = /^14K (Yellow|Rose|White):(\d+(?:\.\d+)?)in$/i.exec(label);
    const color = match?.[1];
    const length = match?.[2];
    if (!color || !length) throw new Error(`${itemNumber}: invalid variant label`);
    const lengthInches = Number(length);
    return {
      variant,
      metal: `14K ${color[0]!.toUpperCase()}${color.slice(1).toLowerCase()} Gold`,
      length: `${length} in`,
      lengthInches,
      productType: lengthInches < 14 ? ROYALCHAIN_BRACELET_PRODUCT_TYPE : ROYALCHAIN_PRODUCT_TYPE,
    };
  });
}

function assertSingleMetal(parsed: ParsedVariant[], itemNumber: string): string {
  const metals = [...new Set(parsed.map((variant) => variant.metal))];
  if (metals.length !== 1) throw new Error(`${itemNumber}: variants do not share one metal`);
  return metals[0]!;
}

function titleCase(value: string): string {
  return clean(value).replace(/\S+/g, (word) => `${word[0]!.toUpperCase()}${word.slice(1).toLowerCase()}`);
}

/** Every spec fact a chain listing can state. Unknown facts stay empty; the theme hides empty rows. */
export interface RoyalChainListingFacts {
  /** Chain style, Title Case: `Cuban`. */
  style: string;
  /** Width in millimetres, numeric only: `3.9`. */
  widthMm: string;
  metal: string;
  singularType: 'Necklace' | 'Bracelet';
  /** Available lengths in source order, each `18 in` or `8.5 in`. */
  lengths: string[];
  clasp?: string;
  finish?: string;
  condition?: { label: string; ebayCondition: string } | null;
}

export interface RoyalChainListingCopy {
  title: string;
  descriptionHtml: string;
  seo: { title: string; description: string };
  metafields: MetafieldValue[];
}

function lengthNumbers(lengths: string[]): string[] {
  return [...new Set(lengths.map((length) => clean(length).replace(/\s*in\.?$/i, '')).filter(Boolean))];
}

/** `custom.length` carries every available length, comma-joined, with the unit stated once. */
export function royalChainLengthValue(lengths: string[]): string {
  const numbers = lengthNumbers(lengths);
  return numbers.length ? `${numbers.join(', ')} in` : '';
}

/** SEO copy states a span (`18 to 26 in`) rather than every length. */
function lengthSpan(lengths: string[]): string {
  const numbers = lengthNumbers(lengths).map(Number).filter((value) => Number.isFinite(value));
  if (numbers.length === 0) return '';
  const low = Math.min(...numbers);
  const high = Math.max(...numbers);
  return low === high ? `${low} in` : `${low} to ${high} in`;
}

export function royalChainTitle(facts: RoyalChainListingFacts): string {
  return `${clean(facts.widthMm)}mm ${clean(facts.style)} Chain ${facts.singularType} in ${clean(facts.metal)}`;
}

/**
 * One prose paragraph. Specs never go in the body: the theme renders them from
 * `product.metafields.custom.*` in its Specifications grid.
 */
export function royalChainBodyHtml(facts: RoyalChainListingFacts): string {
  const finish = clean(facts.finish ?? '');
  const clasp = clean(facts.clasp ?? '');
  let closing = '';
  if (finish && clasp) closing = ` Finished ${finish.toLowerCase()} and closed with a ${clasp.toLowerCase()} clasp.`;
  else if (finish) closing = ` Finished ${finish.toLowerCase()}.`;
  else if (clasp) closing = ` Closed with a ${clasp.toLowerCase()} clasp.`;
  const lead = `This ${clean(facts.widthMm)}mm ${clean(facts.style).toLowerCase()} chain ${facts.singularType.toLowerCase()} is crafted in ${clean(facts.metal)} and offered by Laura Milman New York.`;
  return `<p>${escapeHtml(`${lead}${closing}`)}</p>`;
}

export function royalChainSeoDescription(facts: RoyalChainListingFacts): string {
  const span = lengthSpan(facts.lengths);
  return truncateAtWord(
    `Shop the ${clean(facts.widthMm)}mm ${clean(facts.style).toLowerCase()} chain ${facts.singularType.toLowerCase()} in ${clean(facts.metal)}${span ? `, available in ${span}` : ''}, from Laura Milman New York.`,
    160,
  );
}

/** Written only where the fact is known; an unknown spec is omitted, never invented. */
export function royalChainSpecMetafields(facts: RoyalChainListingFacts): MetafieldValue[] {
  const pairs: Array<[string, string]> = [
    ['metal', clean(facts.metal)],
    ['link', titleCase(facts.style)],
    ['width', clean(facts.widthMm) ? `${clean(facts.widthMm)} mm` : ''],
    ['length', royalChainLengthValue(facts.lengths)],
    ['clasp', clean(facts.clasp ?? '')],
    ['finish', clean(facts.finish ?? '')],
    ...(facts.condition
      ? ([
          ['condition', clean(facts.condition.label)],
          ['ebay_condition', clean(facts.condition.ebayCondition)],
        ] as Array<[string, string]>)
      : []),
  ];
  return pairs
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => ({ namespace: 'custom' as const, key, type: 'single_line_text_field' as const, value }));
}

/** Single source of the public chain listing: title, body, SEO, and Specifications-grid metafields. */
export function royalChainListingCopy(facts: RoyalChainListingFacts): RoyalChainListingCopy {
  const title = royalChainTitle(facts);
  const copy: RoyalChainListingCopy = {
    title,
    descriptionHtml: royalChainBodyHtml(facts),
    seo: { title: fitWithSuffix(title, '| Laura Milman', 60), description: royalChainSeoDescription(facts) },
    metafields: royalChainSpecMetafields(facts),
  };
  assertRoyalChainPublicScrubbed(copy, 'royal chain listing copy');
  return copy;
}

/** The grid keys a complete chain listing must carry before it is publishable copy. */
export const ROYALCHAIN_REQUIRED_SPEC_KEYS = ['metal', 'link', 'width', 'length'] as const;

function buildRoyalChainProductForType(
  source: RoyalChainSource,
  parsed: ParsedVariant[],
  productType: typeof ROYALCHAIN_PRODUCT_TYPE | typeof ROYALCHAIN_BRACELET_PRODUCT_TYPE,
  splitByType: boolean,
): Record<string, unknown> {
  const itemNumber = clean(source.itemNumber);
  const style = clean(source.style);
  const width = reviewedWidth(itemNumber, clean(source.widthMm));
  if (!itemNumber || !style || !width || parsed.length === 0) throw new Error('incomplete Royal Chain source row');

  const metal = assertSingleMetal(parsed, itemNumber);
  const lengths = [...new Set(parsed.map((variant) => variant.length))];
  const condition = conditionFacts(source.condition);
  const singularType = productType === ROYALCHAIN_BRACELET_PRODUCT_TYPE ? 'Bracelet' : 'Necklace';
  const listing = royalChainListingCopy({
    style,
    widthMm: width,
    metal,
    singularType,
    lengths,
    clasp: source.closure,
    finish: source.finish,
    condition,
  });
  const title = listing.title;
  const ebayTitle = truncateAtWord(title, EBAY_TITLE_MAX);
  const descriptionHtml = listing.descriptionHtml;
  const seoTitle = listing.seo.title;
  const seoDescription = listing.seo.description;
  const fallbackHandle = `lmny-${itemNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
  const baseHandle = source.existingHandle || EXISTING_HANDLES[itemNumber] || fallbackHandle;
  const handle = splitByType && productType === ROYALCHAIN_BRACELET_PRODUCT_TYPE ? `${baseHandle}-bracelet` : baseHandle;
  const imageUrls = dedupeRoyalChainImageUrls(source);
  const mediaReady = shopifyCdnMediaUrlsAfterImport(source.shopifyCdnImageUrls ?? []).length >= ROYALCHAIN_MINIMUM_IMAGES;
  const tags = [ROYALCHAIN_VENDOR, productType, ...(mediaReady ? [] : ['media-missing'])];
  const metafields: MetafieldValue[] = listing.metafields;
  const specKeys = new Set(metafields.map((metafield) => metafield.key));
  const contentReady = Boolean(
    title && descriptionHtml && seoTitle && seoDescription && ROYALCHAIN_REQUIRED_SPEC_KEYS.every((key) => specKeys.has(key)),
  );
  const conditionReady = Boolean(condition);
  const childSkus = parsed.map(({ variant }) => clean(variant.sku ?? ''));
  const childSkuReady = childSkus.every(Boolean) && new Set(childSkus).size === childSkus.length;
  const weightReady = parsed.every(({ variant }) => Number.isFinite(variant.weightGrams) && (variant.weightGrams ?? 0) > 0);
  const availabilityReady = parsed.every(({ variant }) => variant.available === true);
  const ebay = {
    eligible: mediaReady && contentReady && conditionReady && childSkuReady && weightReady && availabilityReady,
    blockers: [
      ...(mediaReady ? [] : [`requires ${ROYALCHAIN_MINIMUM_IMAGES} successfully imported Shopify CDN images`]),
      ...(contentReady ? [] : ['requires complete public copy and item specifics']),
      ...(conditionReady ? [] : ['requires source-backed condition evidence']),
      ...(childSkuReady ? [] : ['requires unique supplier child SKU for every variant']),
      ...(weightReady ? [] : ['requires exact positive gram weight for every variant']),
      ...(availabilityReady ? [] : ['requires explicit supplier availability for every variant']),
    ],
    title: ebayTitle,
    itemSpecifics: {
      Brand: ROYALCHAIN_VENDOR,
      Type: singularType,
      Material: 'Gold',
      Metal: metal,
      Style: style,
      'Chain Type': style,
      Width: `${width} mm`,
      Length: lengths.join(', '),
      ...(clean(source.closure ?? '') ? { Closure: clean(source.closure ?? '') } : {}),
      ...(clean(source.finish ?? '') ? { Finish: clean(source.finish ?? '') } : {}),
      ...(clean(source.construction ?? '') ? { Construction: clean(source.construction ?? '') } : {}),
      ...(condition ? { Condition: condition.label, 'Condition ID': condition.ebayCondition } : {}),
    },
    itemSpecificMapping: {
      Metal: 'custom.metal',
      Style: 'custom.link',
      Width: 'custom.width',
      Length: 'custom.length',
      Condition: 'custom.condition',
      'Condition ID': 'custom.ebay_condition',
      Closure: 'custom.clasp',
      Finish: 'custom.finish',
      Construction: 'source.construction',
    },
  };
  const product = {
    handle,
    title,
    descriptionHtml,
    vendor: ROYALCHAIN_VENDOR,
    productType,
    category: taxonomyGidForProductType(productType),
    status: 'DRAFT' as const,
    tags,
    metafields,
    seo: { title: seoTitle, description: seoDescription },
    productOptions: [{ name: 'Metal / Length', values: parsed.map(({ variant }) => ({ name: clean(variant.label).replace(':', ' / ') })) }],
    variants: parsed.map(({ variant }) => ({
      optionValues: [{ optionName: 'Metal / Length', name: clean(variant.label).replace(':', ' / ') }],
      price: supplierRetailFromCost(variant.costUsd).toFixed(2),
      sku: clean(variant.sku ?? ''),
      taxable: true,
      inventoryPolicy: 'DENY',
      inventoryItem: {
        tracked: true,
        requiresShipping: true,
        cost: variant.costUsd.toFixed(2),
        ...(Number.isFinite(variant.weightGrams) && (variant.weightGrams ?? 0) > 0
          ? { measurement: { weight: { value: variant.weightGrams, unit: 'GRAMS' } } }
          : {}),
      },
    })),
    files: imageUrls.map((url, index) => ({
      originalSource: url,
      contentType: 'IMAGE',
      alt: `${title}${index > 0 ? ` — view ${index + 1}` : ''}`,
      duplicateResolutionMode: 'APPEND_UUID',
    })),
    variantItemSpecifics: parsed.map(({ variant }) => ({
      sku: clean(variant.sku ?? ''),
      weightGrams: variant.weightGrams ?? null,
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

/** Split 7–10in bracelet variants from 14in-and-up necklace variants. */
export function buildRoyalChainProducts(source: RoyalChainSource): Record<string, unknown>[] {
  if (!clean(source.itemNumber) || !clean(source.style) || !clean(source.widthMm) || source.variants.length === 0) {
    throw new Error('incomplete Royal Chain source row');
  }
  const parsed = parseVariants(source.variants, clean(source.itemNumber));
  assertSingleMetal(parsed, clean(source.itemNumber));
  const groups = new Map<typeof ROYALCHAIN_PRODUCT_TYPE | typeof ROYALCHAIN_BRACELET_PRODUCT_TYPE, ParsedVariant[]>();
  for (const variant of parsed) groups.set(variant.productType, [...(groups.get(variant.productType) ?? []), variant]);
  const splitByType = groups.size > 1;
  return [...groups.entries()].map(([productType, variants]) => buildRoyalChainProductForType(source, variants, productType, splitByType));
}

/** Compatibility helper for callers that have already separated product types. */
export function buildRoyalChainProduct(source: RoyalChainSource): Record<string, unknown> {
  const products = buildRoyalChainProducts(source);
  if (products.length !== 1) throw new Error(`${clean(source.itemNumber)}: bracelet and necklace variants must be planned separately`);
  return products[0]!;
}
