import { contentHash } from './hash.js';
import { isCuratedWatchBrand } from './normalize.js';
import type { FeedItem, Priced, WatchItem } from './types.js';
import {
  buildWatchListing,
  type WatchFeedRecord,
  type WatchListing,
} from './watchListingBuilder.js';

export const FEED_TAG = 'lmny-feed';
export const MEDIA_MISSING_TAG = 'media-missing';
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
export const PRODUCT_SCHEMA_VERSION = 7;

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
    stockNumber: item.stockRef,
  };
}

/**
 * Schema listing when condition maps cleanly; null when the condition is
 * unrecognized (NEEDS_REVIEW) so callers can fall back to the legacy bullet
 * list instead of inventing a Pre-Owned/Unworn title.
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
  return `${formatCarat(item.carat)}ct ${item.shape}, ${item.color} ${item.clarity} — ${item.lab}`;
}

function formatCarat(carat: number): string {
  return carat.toFixed(2).replace(/0$/, '').replace(/\.$/, '');
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
    if (priced.compMidUsd !== undefined) {
      fields.push({ namespace: ns, key: 'comp_mid_usd', type: 'number_decimal', value: priced.compMidUsd.toFixed(2) });
    }
    // Audit trail only — retail is round(comp_mid × 0.97) when a mid exists.
    if (priced.compLowUsd !== undefined) {
      fields.push({ namespace: ns, key: 'comp_low_usd', type: 'number_decimal', value: priced.compLowUsd.toFixed(2) });
    }
    if (priced.compAsOf) {
      fields.push({ namespace: ns, key: 'comp_as_of', type: 'date', value: priced.compAsOf });
    }
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
  return renderRows(rows);
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
  const listing = item.kind === 'watch' ? watchListingFor(item) : null;
  return contentHash({
    schemaVersion: PRODUCT_SCHEMA_VERSION,
    handle: handleFor(item),
    title: titleFor(item),
    vendor: vendorFor(item),
    productType: PRODUCT_TYPES[item.kind],
    tags: tagsFor(item),
    description: descriptionFor(item),
    seoTitle: listing?.seoTitle ?? null,
    seoDescription: listing?.seoDescription ?? null,
    price: priced.retailUsd,
    costCents: Math.round(item.costUsd * 100),
    compMidUsd: priced.compMidUsd ?? null,
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
 */
export function buildProductSetInput(
  item: FeedItem,
  priced: Priced,
  syncedAt: string,
  existing?: ExistingProduct,
): Record<string, unknown> {
  const hash = contentHashFor(item, priced);
  // A feed row with no image would otherwise go live with no photo and only be
  // caught by the next run's media audit. Quarantine it up front instead, so
  // there is never a window where an imageless product is ACTIVE.
  const hasImages = item.imageUrls.length > 0;
  const tags = hasImages ? tagsFor(item) : [...tagsFor(item), MEDIA_MISSING_TAG].sort();
  const listing = item.kind === 'watch' ? watchListingFor(item) : null;
  const input: Record<string, unknown> = {
    handle: handleFor(item),
    title: titleFor(item),
    descriptionHtml: descriptionFor(item),
    vendor: vendorFor(item),
    productType: PRODUCT_TYPES[item.kind],
    status: hasImages ? 'ACTIVE' : 'DRAFT',
    // Stones get the gemological PDP; watches keep the default product page.
    templateSuffix: item.kind === 'watch' ? '' : STONE_TEMPLATE_SUFFIX,
    tags,
    metafields: metafieldsFor(item, priced, hash, syncedAt),
    productOptions: [{ name: 'Title', values: [{ name: 'Default Title' }] }],
    variants: [
      {
        optionValues: [{ optionName: 'Title', name: 'Default Title' }],
        price: priced.retailUsd.toFixed(2),
        sku: item.stockRef,
        taxable: true,
        inventoryPolicy: 'DENY',
        inventoryItem: {
          tracked: false,
          requiresShipping: true,
          // Shopify InventoryItem.cost — required so margin is auditable in admin
          // independently of Supabase / $app.cost_cents.
          cost: item.costUsd.toFixed(2),
        },
      },
    ],
  };
  if (listing) {
    input.seo = { title: listing.seoTitle, description: listing.seoDescription };
  }
  if (existing) input.id = existing.id;
  // productSet fully replaces any field it's given, so re-sending `files` on a
  // product that already holds every photo makes Shopify detach and re-download
  // all of them — thousands of pointless fetches, and a window with no picture.
  // Send files when the product is short of what the feed supplies: a new
  // product, one whose media failed entirely, or — the case the old
  // `mediaCount === 0` test missed — one carrying the single image the
  // single-key media parse produced while the feed offers several.
  //
  // This only runs on a create/update decision, so a product whose extra
  // images permanently fail to process is not re-sent every hour: its hash is
  // unchanged, and the diff skips it before reaching here.
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
