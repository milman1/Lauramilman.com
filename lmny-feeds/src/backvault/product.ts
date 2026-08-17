import { contentHash } from '../hash.js';
import { assertScrubbed } from './scrub.js';
import { buildJewelryListing, conditionMetafield } from './listing.js';
import type { BackVaultItem } from './types.js';

/** Tag every synced product carries — scopes catalog reads/diff/archive to this feed only. */
export const FEED_TAG = 'backvault-feed';
export const CUSTOM_NAMESPACE = 'custom';
export const METAFIELD_NAMESPACE = 'backvault_feed';

/** Bump when the payload shape changes, so an unchanged supplier row still refreshes once. */
export const PRODUCT_SCHEMA_VERSION = 2;

export function sanitizeHandle(ref: string): string {
  return ref
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Deterministic idempotency key — never look products up by title. */
export function handleFor(item: BackVaultItem): string {
  return `bv-${sanitizeHandle(item.sourceHandle)}`;
}

export function tagsFor(item: BackVaultItem): string[] {
  const listing = buildJewelryListing(item);
  const tags = [FEED_TAG, ...listing.tags];
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))].sort();
}

interface MetafieldValue {
  namespace: string;
  key: string;
  type: string;
  value: string;
}

export function metafieldsFor(item: BackVaultItem, hash: string, syncedAt: string): MetafieldValue[] {
  const c = CUSTOM_NAMESPACE;
  const ns = METAFIELD_NAMESPACE;
  const fields: MetafieldValue[] = [
    { namespace: ns, key: 'source_handle', type: 'single_line_text_field', value: item.sourceHandle },
    { namespace: ns, key: 'content_hash', type: 'single_line_text_field', value: hash },
    { namespace: ns, key: 'synced_at', type: 'date_time', value: syncedAt },
    {
      namespace: 'mm-google-shopping',
      key: 'condition',
      type: 'single_line_text_field',
      value: 'used',
    },
  ];
  // The theme's product-card.liquid and main-product.liquid already read
  // these exact custom.* keys for existing estate jewelry (SHOPIFY_SETUP.md §1).
  if (item.specs.metalType) fields.push({ namespace: c, key: 'metal_type', type: 'single_line_text_field', value: item.specs.metalType });
  if (item.specs.metalWeight) fields.push({ namespace: c, key: 'metal_weight', type: 'single_line_text_field', value: item.specs.metalWeight });
  if (item.specs.diamondWeight) fields.push({ namespace: c, key: 'diamond_weight', type: 'single_line_text_field', value: item.specs.diamondWeight });
  if (item.specs.measurements) fields.push({ namespace: c, key: 'measurements', type: 'single_line_text_field', value: item.specs.measurements });
  if (item.specs.gemstones) fields.push({ namespace: c, key: 'gemstones', type: 'single_line_text_field', value: item.specs.gemstones });
  if (item.specs.era) fields.push({ namespace: c, key: 'era', type: 'single_line_text_field', value: item.specs.era });
  fields.push({
    namespace: c,
    key: 'condition',
    type: 'single_line_text_field',
    value: conditionMetafield(item.specs.condition),
  });
  return fields;
}

export function contentHashFor(item: BackVaultItem): string {
  const listing = buildJewelryListing(item);
  return contentHash({
    schemaVersion: PRODUCT_SCHEMA_VERSION,
    handle: handleFor(item),
    title: listing.title,
    vendor: item.vendor,
    productType: listing.productType,
    tags: tagsFor(item),
    description: listing.descriptionHtml,
    seoTitle: listing.seoTitle,
    seoDescription: listing.seoDescription,
    price: item.priceUsd,
    images: item.imageUrls,
    specs: item.specs,
  });
}

export interface ExistingProduct {
  id: string;
  imageCount: number;
}

/**
 * Build the ProductSetInput for one Back Vault item. Rewrites title, body,
 * and SEO to the LMNY estate listing schema (src/backvault/listing.ts), then
 * runs assertScrubbed over every field SHOPIFY_SETUP.md §3a audits as a
 * hard gate — a run throws rather than let a Back Vault reference reach
 * the live store.
 *
 * Image originalSource URLs may still point at the supplier CDN; Shopify
 * copies those files onto its own CDN, and the URL is never shown as
 * storefront copy, so it is not part of the scrub gate.
 */
export function buildProductSetInput(item: BackVaultItem, syncedAt: string, existing?: ExistingProduct): Record<string, unknown> {
  const handle = handleFor(item);
  const listing = buildJewelryListing(item);
  const tags = tagsFor(item);

  assertScrubbed({
    handle,
    title: listing.title,
    description: listing.descriptionHtml,
    vendor: item.vendor,
    seoTitle: listing.seoTitle,
    seoDescription: listing.seoDescription,
  });

  const hash = contentHashFor(item);
  const hasImages = item.imageUrls.length > 0;
  const finalTags = hasImages ? tags : [...tags, 'media-missing'].sort();

  const input: Record<string, unknown> = {
    handle,
    title: listing.title,
    descriptionHtml: listing.descriptionHtml,
    vendor: item.vendor,
    productType: listing.productType,
    status: hasImages ? 'ACTIVE' : 'DRAFT',
    tags: finalTags,
    metafields: metafieldsFor(item, hash, syncedAt),
    seo: { title: listing.seoTitle, description: listing.seoDescription },
    productOptions: [{ name: 'Title', values: [{ name: 'Default Title' }] }],
    variants: [
      {
        optionValues: [{ optionName: 'Title', name: 'Default Title' }],
        price: item.priceUsd.toFixed(2),
        sku: item.sku ?? item.sourceHandle,
        taxable: true,
        inventoryPolicy: 'DENY',
        inventoryItem: { tracked: false, requiresShipping: true },
      },
    ],
  };
  if (existing) input.id = existing.id;
  // Same re-send-only-if-short rule as the Belgium Dia sync (src/product.ts):
  // productSet fully replaces `files`, so resending on an already-complete
  // product would detach and re-download every photo for nothing.
  if (!existing || existing.imageCount < item.imageUrls.length) {
    input.files = item.imageUrls.map((url, i) => ({
      originalSource: url,
      contentType: 'IMAGE',
      alt: `${listing.title}${i > 0 ? ` — view ${i + 1}` : ''}`,
      duplicateResolutionMode: 'APPEND_UUID',
    }));
  }
  return input;
}
