import { contentHash } from './hash.js';
import type { FeedItem, Priced, StoneItem, WatchItem } from './types.js';

export const FEED_TAG = 'lmny-feed';
export const MEDIA_MISSING_TAG = 'media-missing';
export const STONE_VENDOR = 'Laura Milman New York';
export const METAFIELD_NAMESPACE = 'lmny_feed';
/** App-reserved namespace: private to the sync app, invisible to theme/Storefront API. */
export const APP_NAMESPACE = '$app';

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
  return `${HANDLE_PREFIX[item.kind]}-${sanitizeRef(item.stockRef)}`;
}

export function titleFor(item: FeedItem): string {
  if (item.kind === 'watch') {
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
    tags.push(item.brand);
    if (item.condition) tags.push(item.condition);
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
  } else {
    fields.push({ namespace: ns, key: 'is_naked', type: 'boolean', value: String(item.isNaked) });
    if (priced.compMidUsd !== undefined) {
      fields.push({ namespace: ns, key: 'comp_mid_usd', type: 'number_decimal', value: priced.compMidUsd.toFixed(2) });
    }
    if (priced.compAsOf) {
      fields.push({ namespace: ns, key: 'comp_as_of', type: 'date', value: priced.compAsOf });
    }
  }
  return fields;
}

export function descriptionFor(item: FeedItem): string {
  if (item.kind === 'watch') {
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
  return contentHash({
    handle: handleFor(item),
    title: titleFor(item),
    vendor: vendorFor(item),
    productType: PRODUCT_TYPES[item.kind],
    tags: tagsFor(item),
    description: descriptionFor(item),
    price: priced.retailUsd,
    costCents: Math.round(item.costUsd * 100),
    compMidUsd: priced.compMidUsd ?? null,
    images: item.imageUrls,
    certNumber: item.kind !== 'watch' ? (item.certNumber ?? null) : null,
    certUrl: item.kind !== 'watch' ? (item.certUrl ?? null) : null,
    isNaked: item.kind === 'watch' ? item.isNaked : null,
  });
}

/**
 * Build the full ProductSetInput. Images attach by external URL so Shopify
 * copies them to its own CDN. Feed-hosted .mp4 videos can't attach by URL
 * (Shopify requires staged uploads for video) and are skipped for now.
 */
export function buildProductSetInput(item: FeedItem, priced: Priced, syncedAt: string): Record<string, unknown> {
  const hash = contentHashFor(item, priced);
  return {
    handle: handleFor(item),
    title: titleFor(item),
    descriptionHtml: descriptionFor(item),
    vendor: vendorFor(item),
    productType: PRODUCT_TYPES[item.kind],
    status: 'ACTIVE',
    tags: tagsFor(item),
    metafields: metafieldsFor(item, priced, hash, syncedAt),
    files: item.imageUrls.map((url, i) => ({
      originalSource: url,
      contentType: 'IMAGE',
      alt: `${titleFor(item)}${i > 0 ? ` — view ${i + 1}` : ''}`,
      duplicateResolutionMode: 'APPEND_UUID',
    })),
    productOptions: [{ name: 'Title', values: [{ name: 'Default Title' }] }],
    variants: [
      {
        optionValues: [{ optionName: 'Title', name: 'Default Title' }],
        price: priced.retailUsd.toFixed(2),
        sku: item.stockRef,
        taxable: true,
        inventoryPolicy: 'DENY',
        inventoryItem: { tracked: false, requiresShipping: true },
      },
    ],
  };
}
