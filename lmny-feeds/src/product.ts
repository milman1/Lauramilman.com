import { LAB_GUARDS, WATCH } from '../config/pricing.js';
import { contentHash } from './hash.js';
import { isCuratedWatchBrand } from './normalize.js';
import { taxonomyGidForFeedKind } from './taxonomy.js';
import type { FeedItem, Priced, WatchItem } from './types.js';
import {
  buildWatchListing,
  type WatchFeedRecord,
  type WatchListing,
} from './watchListingBuilder.js';

export const FEED_TAG = 'lmny-feed';
export const MEDIA_MISSING_TAG = 'media-missing';
/** Tag for watches held out of auto-pricing (missing supplier cost). */
export const PRICING_REVIEW_TAG = WATCH.reviewTag;
/** Tag for watches whose brand is outside the curated WATCH_BRANDS list. */
export const OTHER_WATCH_BRAND_TAG = 'other-watch-brand';
/** Automated collection that gathers OTHER_WATCH_BRAND_TAG products. */
export const OTHER_WATCH_BRANDS_COLLECTION = 'Other Watch Brands';
export const STONE_VENDOR = 'Laura Milman New York';
export const METAFIELD_NAMESPACE = 'lmny_feed';
/** App-reserved namespace: private to the sync app, invisible to theme/Storefront API. */
export const APP_NAMESPACE = '$app';
/**
 * Merchant-owned namespace the storefront can read. These power the collection
 * filters (shape / carat / colour / clarity / cut) and are the same definitions
 * the estate catalogue already uses, so filtering is consistent store-wide.
 */
export const CUSTOM_NAMESPACE = 'custom';

/**
 * Bump when the product payload changes shape (new metafields, new tags…).
 * It feeds the content hash, so an existing catalogue is refreshed once
 * instead of being skipped as "unchanged".
 */
export const PRODUCT_SCHEMA_VERSION = 19;

/**
 * Unique watches, naturals, and large labs are one-of-one. Uploadify (and
 * other marketplace apps) keep a listing only while Shopify status is ACTIVE,
 * SKU is set, and available quantity is > 0. The feed is the availability
 * source: in stock while the item is publishable, 0 when it has no photo
 * (DRAFT) or when we later archive it.
 *
 * Labs under {@link LAB_GUARDS.uploadifyMinCarat} stay ACTIVE on the
 * storefront but are left untracked so Uploadify reads qty 0 and delists.
 */
export const UNIQUE_IN_STOCK_QTY = 1;
/** Labs at or above this carat keep tracked qty 1 for Uploadify. */
export const LAB_UPLOADIFY_MIN_CARAT = LAB_GUARDS.uploadifyMinCarat;
/** @deprecated Use UNIQUE_IN_STOCK_QTY */
export const WATCH_IN_STOCK_QTY = UNIQUE_IN_STOCK_QTY;
/** productSet inventoryQuantities.name — available is what Admin apps read. */
export const UNIQUE_INVENTORY_QUANTITY_NAME = 'available';
/** @deprecated Use UNIQUE_INVENTORY_QUANTITY_NAME */
export const WATCH_INVENTORY_QUANTITY_NAME = UNIQUE_INVENTORY_QUANTITY_NAME;

const SEO_TITLE_MAX = 60;
const SEO_DESCRIPTION_MAX = 160;

/** Theme template for stones — the gemological PDP, not the jewelry one. */
export const STONE_TEMPLATE_SUFFIX = 'diamond';

export const PRODUCT_TYPES = {
  natural: 'Natural Diamond',
  lab: 'Lab-Grown Diamond',
  watch: 'Watch',
} as const;

const HANDLE_PREFIX = { natural: 'nd', lab: 'lg', watch: 'w' } as const;

export function sanitizeRef(ref: string): string {
  return ref
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Deterministic idempotency key. Never look products up by title. */
export function handleFor(item: FeedItem): string {
  return handleForRef(item.kind, item.stockRef);
}

/**
 * The same key from a kind + stock ref alone — held rows never become items,
 * but the diff still needs to know their handles were in the feed.
 */
export function handleForRef(kind: FeedItem['kind'], stockRef: string): string {
  return `${HANDLE_PREFIX[kind]}-${sanitizeRef(stockRef)}`;
}

/** Map a normalized feed watch onto the listing-builder input shape. */
export function watchFeedRecordFrom(item: WatchItem): WatchFeedRecord {
  return {
    brand: item.brand,
    model: item.model,
    reference: item.reference,
    year: item.year,
    conditionRaw: item.condition ?? '',
    box: item.box,
    paper: item.papers,
    caseSizeMm: item.caseSizeMm,
    metal: item.metal,
    dial: item.dial,
    bezel: item.bezel,
    bracelet: item.bracelet,
    link: item.link,
    comment: item.comment,
    stockNumber: item.stockRef,
  };
}

/**
 * Schema listing when condition maps cleanly; unknown values now produce a
 * neutral listing without inventing a Pre-Owned/Unworn classification.
 */
export function watchListingFor(item: WatchItem): WatchListing | null {
  const listing = buildWatchListing(watchFeedRecordFrom(item));
  if ('needsReview' in listing) return null;
  return listing;
}

export function titleFor(item: FeedItem): string {
  if (item.kind === 'watch') {
    const listing = watchListingFor(item);
    if (listing) return listing.title;
    return `${item.brand} ${item.model} ${item.reference}`;
  }
  const origin = item.kind === 'lab' ? 'Lab-Grown Diamond' : 'Natural Diamond';
  return `${formatCarat(item.carat)}ct ${item.shape} ${origin} — ${item.color} ${item.clarity}, ${item.lab} Certified`;
}

function formatCarat(carat: number): string {
  return carat.toFixed(2).replace(/0$/, '').replace(/\.$/, '');
}

function truncateAtWord(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

/** Keep the high-intent suffix while shortening only the descriptive lead. */
function fitWithSuffix(lead: string, suffix: string, maxLength: number): string {
  const available = maxLength - suffix.length - 1;
  return `${truncateAtWord(lead, available)} ${suffix}`.trim();
}

/**
 * Search title formula for every Belgium Dia product. Shopify's theme supplies
 * the store-name suffix, so this field spends its budget on product intent:
 * identity/specification first, then origin/condition and certification.
 */
export function seoTitleFor(item: FeedItem): string {
  if (item.kind === 'watch') {
    const listing = watchListingFor(item);
    if (listing) return listing.seoTitle;
    return fitWithSuffix(
      `${item.brand} ${item.model} ${item.reference}`.replace(/\s+/g, ' ').trim(),
      'Watch',
      SEO_TITLE_MAX,
    );
  }
  const origin = item.kind === 'lab' ? 'Lab-Grown Diamond' : 'Natural Diamond';
  const lead = `${formatCarat(item.carat)}ct ${item.shape} ${origin} — ${item.color} ${item.clarity}`;
  return fitWithSuffix(lead, `| ${item.lab}`, SEO_TITLE_MAX);
}

/** Human-readable SERP copy; specifications remain available in the PDP body. */
export function seoDescriptionFor(item: FeedItem): string {
  if (item.kind === 'watch') {
    const listing = watchListingFor(item);
    if (listing) return listing.seoDescription;
    return truncateAtWord(
      `Explore this ${item.brand} ${item.model} ${item.reference} watch from Laura Milman New York.`,
      SEO_DESCRIPTION_MAX,
    );
  }
  const origin = item.kind === 'lab' ? 'lab-grown' : 'natural';
  const cut = item.cut ? ` with ${item.cut.toLowerCase()} cut` : '';
  return truncateAtWord(
    `Shop this ${formatCarat(item.carat)}ct ${item.shape.toLowerCase()} ${origin} diamond, graded ${item.color} ${item.clarity}${cut} and certified by ${item.lab}.`,
    SEO_DESCRIPTION_MAX,
  );
}

/** Half-carat bands: 0.5-1.0ct, 1.0-1.5ct, …; 5ct and up collapse to 5.0ct+. */
export function caratBand(carat: number): string {
  if (carat >= 5) return '5.0ct+';
  const lo = Math.floor(carat * 2) / 2;
  const hi = lo + 0.5;
  return `${lo.toFixed(1)}-${hi.toFixed(1)}ct`;
}

export function tagsFor(item: FeedItem): string[] {
  const tags: string[] = [FEED_TAG];
  if (item.kind === 'watch') {
    const listing = watchListingFor(item);
    if (listing) {
      // Schema marketing tags (TitleCase brand/model, "Pre-Owned Watches", …)
      // unioned with operational feed tags — never replace lmny-feed / full-set.
      tags.push(...listing.tags);
    } else {
      tags.push(item.brand);
      if (item.condition) tags.push(item.condition);
    }
    if (!isCuratedWatchBrand(item.brand)) tags.push(OTHER_WATCH_BRAND_TAG);
    if (item.box && item.papers) tags.push('full-set');
    else if (item.box) tags.push('box-only');
    else if (item.papers) tags.push('papers-only');
    else tags.push('naked');
  } else {
    tags.push(item.shape, item.color, item.clarity, caratBand(item.carat), item.lab);
    if (item.cut) tags.push(item.cut);
  }
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))].sort();
}

export function vendorFor(item: FeedItem): string {
  return item.kind === 'watch' ? item.brand : STONE_VENDOR;
}

interface MetafieldValue {
  namespace: string;
  key: string;
  type: string;
  value: string;
}

/**
 * lmny_feed.* metafields carry sync state. cost_cents lives in the
 * app-reserved namespace so it never reaches the theme or Storefront API,
 * and no compare-at price is ever derived from Rap or comp values.
 */
export function metafieldsFor(item: FeedItem, priced: Priced, hash: string, syncedAt: string): MetafieldValue[] {
  const ns = METAFIELD_NAMESPACE;
  const fields: MetafieldValue[] = [
    { namespace: ns, key: 'stock_ref', type: 'single_line_text_field', value: item.stockRef },
    { namespace: ns, key: 'kind', type: 'single_line_text_field', value: item.kind },
    { namespace: ns, key: 'content_hash', type: 'single_line_text_field', value: hash },
    { namespace: ns, key: 'synced_at', type: 'date_time', value: syncedAt },
    { namespace: APP_NAMESPACE, key: 'cost_cents', type: 'number_integer', value: String(Math.round(item.costUsd * 100)) },
  ];
  if (item.kind !== 'watch') {
    if (item.certNumber) fields.push({ namespace: ns, key: 'cert_number', type: 'single_line_text_field', value: item.certNumber });
    if (item.certUrl) fields.push({ namespace: ns, key: 'cert_url', type: 'url', value: item.certUrl });
    // The gemological PDP renders these as its own spec table rather than
    // parsing them back out of descriptionHtml.
    if (item.lab) fields.push({ namespace: ns, key: 'lab', type: 'single_line_text_field', value: item.lab });
    if (item.polish) fields.push({ namespace: ns, key: 'polish', type: 'single_line_text_field', value: item.polish });
    if (item.symmetry) fields.push({ namespace: ns, key: 'symmetry', type: 'single_line_text_field', value: item.symmetry });
    if (item.fluorescence) fields.push({ namespace: ns, key: 'fluorescence', type: 'single_line_text_field', value: item.fluorescence });
    if (item.measurements) fields.push({ namespace: ns, key: 'measurements', type: 'single_line_text_field', value: item.measurements });
    if (item.tablePct) fields.push({ namespace: ns, key: 'table_pct', type: 'number_decimal', value: String(item.tablePct) });
    if (item.depthPct) fields.push({ namespace: ns, key: 'depth_pct', type: 'number_decimal', value: String(item.depthPct) });
    // Stone videos are 360° viewers embedded straight from the supplier rather
    // than attached as Shopify media — re-hosting 24k of them per run isn't
    // affordable. `video_url` stays the first one for the existing PDP tab;
    // `video_urls` carries the rest, which the single-key media parse used to
    // throw away before anything could read them.
    if (item.videoUrls[0]) fields.push({ namespace: ns, key: 'video_url', type: 'url', value: item.videoUrls[0] });
    if (item.videoUrls.length > 0) {
      fields.push({ namespace: ns, key: 'video_urls', type: 'list.url', value: JSON.stringify(item.videoUrls) });
    }
    // Storefront-readable copies that drive the collection filters. carat_weight
    // is numeric so the carat control can be a true range, not a band.
    const c = CUSTOM_NAMESPACE;
    fields.push(
      { namespace: c, key: 'diamond_shape', type: 'single_line_text_field', value: item.shape },
      { namespace: c, key: 'carat_weight', type: 'number_decimal', value: String(item.carat) },
      { namespace: c, key: 'color', type: 'single_line_text_field', value: item.color },
      { namespace: c, key: 'clarity', type: 'single_line_text_field', value: item.clarity },
    );
    if (item.cut) fields.push({ namespace: c, key: 'cut', type: 'single_line_text_field', value: item.cut });
  } else {
    fields.push({ namespace: ns, key: 'is_naked', type: 'boolean', value: String(item.isNaked) });
    const listing = watchListingFor(item);
    if (listing) {
      for (const mf of listing.metafields) {
        fields.push({
          namespace: mf.namespace,
          key: mf.key,
          type: mf.type,
          value: mf.value,
        });
      }
    }
  }
  return fields;
}

export function descriptionFor(item: FeedItem): string {
  if (item.kind === 'watch') {
    const listing = watchListingFor(item);
    if (listing) return listing.descriptionHtml;
    const set = item.box && item.papers ? 'Full set (box and papers)' : item.box ? 'With original box' : item.papers ? 'With papers' : 'Watch only';
    const rows = [
      ['Brand', item.brand],
      ['Model', item.model],
      ['Reference', item.reference],
      ['Year', item.year],
      ['Condition', item.condition],
      ['Accessories', set],
    ];
    return renderRows(rows);
  }
  const origin = item.kind === 'lab' ? 'Lab-grown diamond' : 'Natural diamond';
  const certification = item.certNumber ? `${item.lab} report ${item.certNumber}` : `${item.lab} certified`;
  const lead =
    `<p>This ${escapeHtml(formatCarat(item.carat))}ct ${escapeHtml(item.shape.toLowerCase())} ` +
    `${escapeHtml(origin.toLowerCase())} is graded ${escapeHtml(item.color)} color and ` +
    `${escapeHtml(item.clarity)} clarity, with ${escapeHtml(certification)}.</p>`;
  const rows = [
    ['Origin', origin],
    ['Shape', item.shape],
    ['Carat weight', `${formatCarat(item.carat)}ct`],
    ['Color', item.color],
    ['Clarity', item.clarity],
    ['Cut', item.cut],
    ['Polish', item.polish],
    ['Symmetry', item.symmetry],
    ['Fluorescence', item.fluorescence],
    ['Measurements', item.measurements],
    ['Certification', item.certNumber ? `${item.lab} ${item.certNumber}` : item.lab],
  ];
  return `${lead}${renderRows(rows)}`;
}

function renderRows(rows: (string | undefined)[][]): string {
  const lis = rows
    .filter((r): r is [string, string] => Boolean(r[1]))
    .map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</li>`)
    .join('');
  return `<ul>${lis}</ul>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Everything that, when changed, should trigger a product update.
 * synced_at and the hash itself are excluded by construction.
 */
export function contentHashFor(item: FeedItem, priced: Priced): string {
  return contentHash({
    schemaVersion: PRODUCT_SCHEMA_VERSION,
    handle: handleFor(item),
    title: titleFor(item),
    vendor: vendorFor(item),
    productType: PRODUCT_TYPES[item.kind],
    category: taxonomyGidForFeedKind(item.kind),
    tags: tagsFor(item),
    description: descriptionFor(item),
    seoTitle: seoTitleFor(item),
    seoDescription: seoDescriptionFor(item),
    price: priced.retailUsd,
    costCents: Math.round(item.costUsd * 100),
    images: item.imageUrls,
    videos: item.videoUrls,
    certNumber: item.kind !== 'watch' ? (item.certNumber ?? null) : null,
    certUrl: item.kind !== 'watch' ? (item.certUrl ?? null) : null,
    tablePct: item.kind !== 'watch' ? (item.tablePct ?? null) : null,
    depthPct: item.kind !== 'watch' ? (item.depthPct ?? null) : null,
    isNaked: item.kind === 'watch' ? item.isNaked : null,
  });
}

/** What the Shopify catalogue already holds for this handle, if anything. */
export interface ExistingProduct {
  id: string;
  /** READY images. Fewer than the feed supplies → re-send the whole set. */
  imageCount: number;
}

/**
 * Tracked qty 1 is what Uploadify imports. Labs below the marketplace carat
 * floor are left untracked so they stay buyable on the Online Store.
 */
export function tracksUniqueInventory(item: FeedItem): boolean {
  return !(item.kind === 'lab' && item.carat < LAB_UPLOADIFY_MIN_CARAT);
}

export function uniqueStockQtyFor(item: FeedItem, hasImages: boolean): number {
  if (!tracksUniqueInventory(item) || !hasImages) return 0;
  return UNIQUE_IN_STOCK_QTY;
}

function variantPayload(
  item: FeedItem,
  priced: Priced,
  hasImages: boolean,
  locationId?: string,
): Record<string, unknown> {
  const inventoryItem: Record<string, unknown> = {
    tracked: false,
    requiresShipping: true,
    // Shopify InventoryItem.cost — required so margin is auditable in admin
    // independently of Supabase / $app.cost_cents.
    cost: item.costUsd.toFixed(2),
  };
  const variant: Record<string, unknown> = {
    optionValues: [{ optionName: 'Title', name: 'Default Title' }],
    price: priced.retailUsd.toFixed(2),
    sku: item.stockRef,
    taxable: true,
    inventoryPolicy: 'DENY',
    inventoryItem,
  };
  // Unique one-of-one inventory. Without a location keep the old untracked
  // payload so unit tests and a location-less dry-run cannot invent a qty
  // at a missing GID. Labs under the Uploadify carat floor stay untracked
  // even when a location exists, so marketplaces delist them.
  if (locationId && tracksUniqueInventory(item)) {
    inventoryItem.tracked = true;
    variant.inventoryQuantities = [
      {
        locationId,
        name: UNIQUE_INVENTORY_QUANTITY_NAME,
        quantity: uniqueStockQtyFor(item, hasImages),
      },
    ];
  }
  return variant;
}

/**
 * Build the full ProductSetInput. Images attach by external URL so Shopify
 * copies them to its own CDN. Feed-hosted .mp4 videos can't attach by URL
 * (Shopify requires staged uploads for video) and are skipped for now.
 *
 * `existing` must be passed whenever the product is already in the catalogue.
 * productSet keys on `id`, not on `handle`: given a handle alone it tries to
 * CREATE and fails with HANDLE_NOT_UNIQUE. That stayed invisible for as long
 * as the sync only ever created — matching hashes meant updates never ran at
 * volume — and then failed 2,506 writes the first time a schema change made
 * every product an update.
 *
 * `locationId` turns on tracked qty 1 (Uploadify / marketplace import)
 * for watches, naturals, and labs at/above {@link LAB_UPLOADIFY_MIN_CARAT}.
 */
export function buildProductSetInput(
  item: FeedItem,
  priced: Priced,
  syncedAt: string,
  existing?: ExistingProduct,
  locationId?: string,
): Record<string, unknown> {
  const hash = contentHashFor(item, priced);
  // A feed row with no image would otherwise go live with no photo and only be
  // caught by the next run's media audit. Quarantine it up front instead, so
  // there is never a window where an imageless product is ACTIVE.
  const hasImages = item.imageUrls.length > 0;
  const tags = hasImages ? tagsFor(item) : [...tagsFor(item), MEDIA_MISSING_TAG].sort();
  const input: Record<string, unknown> = {
    handle: handleFor(item),
    title: titleFor(item),
    descriptionHtml: descriptionFor(item),
    vendor: vendorFor(item),
    productType: PRODUCT_TYPES[item.kind],
    category: taxonomyGidForFeedKind(item.kind),
    status: hasImages ? 'ACTIVE' : 'DRAFT',
    // Stones get the gemological PDP; watches keep the default product page.
    templateSuffix: item.kind === 'watch' ? '' : STONE_TEMPLATE_SUFFIX,
    tags,
    metafields: metafieldsFor(item, priced, hash, syncedAt),
    productOptions: [{ name: 'Title', values: [{ name: 'Default Title' }] }],
    variants: [variantPayload(item, priced, hasImages, locationId)],
  };
  input.seo = { title: seoTitleFor(item), description: seoDescriptionFor(item) };
  if (existing) input.id = existing.id;
  // productSet fully replaces any field it's given, so re-sending `files` on a
  // product that already holds every photo makes Shopify detach and re-download
  // all of them — thousands of pointless fetches, and a window with no picture.
  // Send files when the product is short of what the feed supplies: a new
  // product, one whose media failed entirely, or — the case the old
  // `mediaCount === 0` test missed — one carrying the single image the
  // single-key media parse produced while the feed offers several.
  //
  // This only runs on a create/update decision. A matching hash used to skip
  // the product before we got here, which is why one-photo watches never
  // picked up ImageLink2/3. sync promotes those skips (`media_short`) so
  // this branch actually runs. Once imageCount catches up, files stay off.
  if (!existing || existing.imageCount < item.imageUrls.length) {
    input.files = item.imageUrls.map((url, i) => ({
      originalSource: url,
      contentType: 'IMAGE',
      alt: `${titleFor(item)}${i > 0 ? ` — view ${i + 1}` : ''}`,
      duplicateResolutionMode: 'APPEND_UUID',
    }));
  }
  return input;
}

export function isInvalidShopifyFileUrlError(message: string): boolean {
  return /file url is invalid/i.test(message);
}

/**
 * Isolated per-SKU rejections (one bad ImageLink) must not fail a live run
 * of a handful of writes. Fail only when several errors look systemic.
 */
export function writeErrorsAreSystemic(errorCount: number, attempted: number, failRate = 0.01): boolean {
  if (errorCount < 3) return false;
  const rate = attempted > 0 ? errorCount / attempted : 1;
  return rate > failRate;
}

/**
 * Retry payload when Shopify rejects `files.originalSource`. Create the
 * product as a DRAFT with no photos rather than losing the write.
 */
export function quarantineProductSetInput(input: Record<string, unknown>): Record<string, unknown> {
  const { files: _omit, ...rest } = input;
  const tags = new Set(Array.isArray(rest.tags) ? (rest.tags as string[]) : []);
  tags.add(MEDIA_MISSING_TAG);
  const variants = Array.isArray(rest.variants)
    ? (rest.variants as Array<Record<string, unknown>>).map((variant) => {
        const qtys = variant.inventoryQuantities;
        if (!Array.isArray(qtys)) return variant;
        return {
          ...variant,
          inventoryQuantities: qtys.map((qty) =>
            qty && typeof qty === 'object' ? { ...qty, quantity: 0 } : qty,
          ),
        };
      })
    : rest.variants;
  return { ...rest, status: 'DRAFT', tags: [...tags].sort(), variants };
}
