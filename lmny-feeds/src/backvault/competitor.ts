/**
 * Competitor price lookup for Back Vault pieces.
 *
 * Robinson's Jewelers (robinsonsjewelers.com) stocks the same estate pieces
 * from the same supplier, under its own SKUs. The supplier's stock number
 * (J10605, RR9688, ...) survives in the retailer's titles, handles, image
 * file names, or body copy, so that token is the match key. Anything that
 * cannot be matched by stock number is treated as unmatched; there is no
 * fuzzy title matching here on purpose, because a wrong match sets a wrong
 * public price.
 *
 * Read from the retailer's public Shopify /products.json, same as the
 * supplier feed. No API key. The sandbox that wrote this cannot reach the
 * host; GitHub Actions can.
 */

import { BACKVAULT } from '../../config/pricing.js';

const PAGE_LIMIT = 250;
const MAX_PAGES = 200;

const REQUEST_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; LMNY-FeedSync/1.0; +https://lauramilman.com)',
} as const;

/** Supplier stock numbers: 1-3 letters then 3-6 digits, e.g. J10605, RR9688, RR2954. */
const STOCK_REF = /\b([A-Z]{1,3}\d{3,6})\b/gi;

export interface CompetitorRow {
  handle?: string;
  title?: string;
  body_html?: string;
  variants?: Array<{ sku?: string | null; price?: string; available?: boolean }>;
  images?: Array<{ src?: string }>;
}

/** stock ref (upper-case) -> lowest available price on the competitor. */
export type CompetitorIndex = Map<string, number>;

function baseUrl(): string {
  return (process.env.COMPETITOR_BASE_URL || BACKVAULT.competitor.baseUrl).replace(/\/+$/, '');
}

async function fetchPage(page: number): Promise<unknown[]> {
  const url = `${baseUrl()}/products.json?limit=${PAGE_LIMIT}&page=${page}`;
  let res: Response | undefined;
  let lastErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(url, { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(30_000) });
      break;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  if (!res) throw new Error(`Competitor feed: request failed (${lastErr})`);
  if (!res.ok) throw new Error(`Competitor feed: HTTP ${res.status} for page ${page}`);
  const body = (await res.json()) as { products?: unknown[] };
  if (!Array.isArray(body.products)) throw new Error('Competitor feed: response had no `products` array');
  return body.products;
}

/** Every page of the competitor's public catalog. */
export async function fetchCompetitorCatalog(): Promise<unknown[]> {
  const all: unknown[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const rows = await fetchPage(page);
    if (rows.length === 0) break;
    all.push(...rows);
    if (rows.length < PAGE_LIMIT) break;
  }
  return all;
}

/** Stock-number tokens found anywhere on a competitor row. */
export function stockRefsIn(row: CompetitorRow): Set<string> {
  const refs = new Set<string>();
  const texts: string[] = [row.title ?? '', row.handle ?? '', row.body_html ?? ''];
  for (const v of row.variants ?? []) if (v.sku) texts.push(v.sku);
  for (const img of row.images ?? []) {
    if (!img.src) continue;
    const file = img.src.split('?')[0]!.split('/').pop() ?? '';
    texts.push(file.replace(/[._-]/g, ' '));
  }
  for (const text of texts) {
    for (const m of text.matchAll(STOCK_REF)) refs.add(m[1]!.toUpperCase());
  }
  return refs;
}

function lowestAvailablePrice(row: CompetitorRow): number | null {
  let best: number | null = null;
  for (const v of row.variants ?? []) {
    if (v.available === false) continue;
    const p = Number(v.price);
    if (!Number.isFinite(p) || p <= 0) continue;
    if (best === null || p < best) best = p;
  }
  return best;
}

/**
 * Build the stock-ref -> price index. A ref that appears on more than one
 * competitor row with different prices is ambiguous and dropped: a wrong
 * public price is worse than a missing match.
 */
export function indexCompetitor(rows: unknown[]): CompetitorIndex {
  const index: CompetitorIndex = new Map();
  const ambiguous = new Set<string>();
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as CompetitorRow;
    const price = lowestAvailablePrice(row);
    if (price === null) continue;
    for (const ref of stockRefsIn(row)) {
      const seen = index.get(ref);
      if (seen !== undefined && Math.abs(seen - price) > 0.005) ambiguous.add(ref);
      else index.set(ref, price);
    }
  }
  for (const ref of ambiguous) index.delete(ref);
  return index;
}

/** The supplier stock number for one of our items: the SKU, else the handle's last token. */
export function stockRefFor(item: { sku?: string; sourceHandle: string }): string | null {
  const fromSku = item.sku?.trim().toUpperCase();
  if (fromSku && /^[A-Z]{1,3}\d{3,6}$/.test(fromSku)) return fromSku;
  const tail = item.sourceHandle.split('-').pop()?.toUpperCase() ?? '';
  return /^[A-Z]{1,3}\d{3,6}$/.test(tail) ? tail : null;
}

export function competitorPriceFor(item: { sku?: string; sourceHandle: string }, index: CompetitorIndex): number | null {
  const ref = stockRefFor(item);
  if (!ref) return null;
  return index.get(ref) ?? null;
}
