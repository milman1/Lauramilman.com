import { matchDesigner } from './designers.js';
import { canonicalProductType } from './listing.js';
import { extractSpecs } from './specs.js';
import { scrubText } from './scrub.js';
import type { BackVaultItem, RawBackVaultProduct } from './types.js';

/** Narrow an unknown feed row down to the shape we need, or return null if it doesn't fit. */
function asRawProduct(row: unknown): RawBackVaultProduct | null {
  if (row === null || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (typeof r.handle !== 'string' || typeof r.title !== 'string' || typeof r.vendor !== 'string') return null;
  if (!Array.isArray(r.variants) || !Array.isArray(r.images)) return null;
  return r as unknown as RawBackVaultProduct;
}

function isAvailable(product: RawBackVaultProduct): boolean {
  return product.variants.some((v) => v.available === true);
}

function firstPrice(product: RawBackVaultProduct): number | null {
  const available = product.variants.find((v) => v.available === true) ?? product.variants[0];
  if (!available) return null;
  const price = Number(available.price);
  return Number.isFinite(price) ? price : null;
}

function firstSku(product: RawBackVaultProduct): string | undefined {
  const available = product.variants.find((v) => v.available === true) ?? product.variants[0];
  return available?.sku || undefined;
}

export interface NormalizeStats {
  totalFetched: number;
  malformed: number;
  outOfStock: number;
  notTopDesigner: number;
  accepted: number;
}

export interface NormalizeResult {
  items: BackVaultItem[];
  stats: NormalizeStats;
}

/**
 * Filter the raw feed down to in-stock items whose vendor is one of the
 * curated top designers, then scrub and shape them for pricing/write.
 * Price is passed through as-is from the supplier's listed price — no
 * markup is applied.
 */
export function normalizeBackVaultFeed(rawRows: unknown[]): NormalizeResult {
  const stats: NormalizeStats = { totalFetched: rawRows.length, malformed: 0, outOfStock: 0, notTopDesigner: 0, accepted: 0 };
  const items: BackVaultItem[] = [];

  for (const row of rawRows) {
    const product = asRawProduct(row);
    if (!product) {
      stats.malformed += 1;
      continue;
    }
    if (!isAvailable(product)) {
      stats.outOfStock += 1;
      continue;
    }
    const designer = matchDesigner(product.vendor);
    if (!designer) {
      stats.notTopDesigner += 1;
      continue;
    }
    const price = firstPrice(product);
    if (price === null) {
      stats.malformed += 1;
      continue;
    }

    const title = scrubText(product.title);
    const descriptionHtml = scrubHtml(product.body_html ?? '');
    const specs = extractSpecs(product.title, product.body_html);
    for (const key of Object.keys(specs) as Array<keyof typeof specs>) {
      const v = specs[key];
      if (v) specs[key] = scrubText(v);
    }

    items.push({
      sourceHandle: product.handle,
      title,
      vendorRaw: product.vendor,
      vendor: designer.name,
      productType: canonicalProductType(product.product_type || 'Jewelry'),
      descriptionHtml,
      priceUsd: price,
      available: true,
      sku: firstSku(product),
      imageUrls: product.images.map((img) => img.src).filter(Boolean),
      specs,
    });
    stats.accepted += 1;
  }

  return { items, stats };
}

/**
 * Scrub HTML by stripping the phrase out of text nodes only, leaving markup
 * intact. Simpler string scrub would also silently corrupt an href/src that
 * happened to contain "back-vault" (e.g. a supplier-hosted image URL) —
 * those aren't rendered as visible branding, and images/links to the
 * supplier's own CDN are replaced entirely (see product.ts), not text-scrubbed.
 */
function scrubHtml(html: string): string {
  return html.replace(/>([^<]+)</g, (_match, text: string) => `>${scrubText(text)}<`);
}
