/**
 * Boutique Jacob & Co. H-24 already live on the storefront
 * (`/products/jacob-amp-company-limited-edition-five-time-zone-automatic-h-24`).
 *
 * Rewrites copy, specs, type, and tags to the watch listing schema. Does not
 * invent Pre-Owned/Unworn. Photos, handle, price, and ACTIVE status stay as
 * they are.
 */

import { PRODUCT_TYPES } from './product.js';
import { TAXONOMY } from './taxonomy.js';
import { buildWatchListing, type WatchFeedRecord } from './watchListingBuilder.js';

export const JACOB_H24_HANDLE = 'jacob-amp-company-limited-edition-five-time-zone-automatic-h-24';
export const JACOB_VENDOR = 'Jacob & Co.';
export const JACOB_COLLECTION_TITLE = 'Jacob & Co. Watches';
export const JACOB_COLLECTION_HANDLE = 'jacob-co-watches';
export const NEW_VINTAGE = 'New Vintage';
export const JACOB_BOUTIQUE_TAG = 'jacob-co-boutique';
export const JACOB_H24_SKU = '90712192';

const H24_RECORD: WatchFeedRecord = {
  brand: JACOB_VENDOR,
  model: 'Five Time Zone',
  reference: 'H-24 SSSL',
  conditionRaw: '',
  caseSizeMm: '47.5',
  metal: 'Stainless Steel',
  dial: 'Silver Discs on Slate Guilloche',
  stockNumber: '0796/1800',
  box: true,
  paper: true,
  comment: 'Limited edition (0796/1800). Swiss automatic movement.',
};

function truncateAtWord(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

function fitWithSuffix(lead: string, suffix: string, maxLen: number): string {
  const available = maxLen - suffix.length - 1;
  return `${truncateAtWord(lead, available)} ${suffix}`.trim();
}

function applyNewVintage(listing: {
  title: string;
  descriptionHtml: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  metafields: Array<{ namespace: string; key: string; type: string; value: string }>;
}): typeof listing {
  const identity = listing.title.replace(/^(Pre-Owned|Unworn)\s+/i, '').trim();
  const title = `${NEW_VINTAGE} ${identity}`;
  const descriptionHtml = listing.descriptionHtml.replace(
    /<p>This (Pre-Owned |Unworn )?/i,
    `<p>This ${NEW_VINTAGE} `,
  );
  const seoTitle = fitWithSuffix(identity, `– ${NEW_VINTAGE} Watch`, 60);
  const seoDescription = truncateAtWord(
    `Shop this ${NEW_VINTAGE.toLowerCase()} ${identity}. Authenticated by Laura Milman New York.`,
    160,
  );
  const metafields = listing.metafields
    .filter((m) => !(m.namespace === 'mm-google-shopping' && m.key === 'condition'))
    .map((m) => (m.namespace === 'custom' && m.key === 'condition' ? { ...m, value: NEW_VINTAGE } : m));
  if (!metafields.some((m) => m.namespace === 'custom' && m.key === 'condition')) {
    metafields.push({
      namespace: 'custom',
      key: 'condition',
      type: 'single_line_text_field',
      value: NEW_VINTAGE,
    });
  }
  const tags = [
    ...new Set(
      listing.tags
        .filter((t) => !/^(Pre-Owned|Unworn)(\s+Watches)?$/i.test(t))
        .concat([NEW_VINTAGE, `${NEW_VINTAGE} Watches`, JACOB_BOUTIQUE_TAG, 'Jacob & Co']),
    ),
  ];
  return { title, descriptionHtml, seoTitle, seoDescription, tags, metafields };
}

function boutiqueListing() {
  const built = buildWatchListing(H24_RECORD);
  if ('needsReview' in built) {
    throw new Error(`H-24 listing needs review: ${built.reason}`);
  }
  return applyNewVintage(built);
}

export interface JacobH24ProductSetOptions {
  id: string;
  variantId: string;
  price: string;
  sku?: string;
}

export function buildJacobH24ProductSetInput(opts: JacobH24ProductSetOptions): Record<string, unknown> {
  const listing = boutiqueListing();
  const tags = [...new Set([...listing.tags, JACOB_BOUTIQUE_TAG, 'Watch', 'Watches'])].sort();
  return {
    id: opts.id,
    handle: JACOB_H24_HANDLE,
    title: listing.title,
    descriptionHtml: listing.descriptionHtml,
    vendor: JACOB_VENDOR,
    productType: PRODUCT_TYPES.watch,
    category: TAXONOMY.watches.gid,
    status: 'ACTIVE',
    tags,
    metafields: listing.metafields,
    seo: { title: listing.seoTitle, description: listing.seoDescription },
    productOptions: [{ name: 'Title', values: [{ name: 'Default Title' }] }],
    variants: [
      {
        id: opts.variantId,
        optionValues: [{ optionName: 'Title', name: 'Default Title' }],
        price: opts.price,
        sku: opts.sku ?? JACOB_H24_SKU,
        taxable: true,
      },
    ],
  };
}

export function jacobCoWatchesCollectionInput(): Record<string, unknown> {
  return {
    title: JACOB_COLLECTION_TITLE,
    handle: JACOB_COLLECTION_HANDLE,
    ruleSet: {
      appliedDisjunctively: false,
      rules: [
        { column: 'TYPE', relation: 'EQUALS', condition: PRODUCT_TYPES.watch },
        { column: 'VENDOR', relation: 'EQUALS', condition: JACOB_VENDOR },
      ],
    },
  };
}
