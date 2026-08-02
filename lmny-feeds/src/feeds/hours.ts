/**
 * Hours market-comp client (per watch reference).
 *
 * HOURS_API_URL handling per the provider's contract: a direct Supabase
 * function URL is used as-is; a site root gets `/api/comps` appended.
 * A 404 means "no market comp" — a hold, not an error.
 */

import type { WatchComp } from '../markup.js';

// Hours response fields (camelCase, e.g. { asOf, lowUsd, midUsd, sourceCount }),
// with snake_case fallbacks for resilience.
const MID_KEYS = ['midUsd', 'comp_mid_usd', 'comp_mid', 'mid', 'median', 'mid_usd', 'price_mid', 'market_mid'];
const LOW_KEYS = ['lowUsd', 'comp_low_usd', 'comp_low', 'low', 'low_usd', 'price_low', 'market_low'];
const SOURCE_COUNT_KEYS = ['sourceCount', 'source_count', 'listingCount', 'listing_count', 'n', 'count'];
const ASOF_KEYS = ['asOf', 'comp_as_of', 'as_of', 'updated_at', 'date'];

export function resolveUrl(raw: string | undefined = process.env.HOURS_API_URL): string {
  if (!raw) throw new Error('HOURS_API_URL is not set');
  const url = raw.replace(/\/+$/, '');
  // Already a full function/api path — use as-is.
  if (/\/functions\/|\/api\//i.test(url)) return url;
  // Bare Supabase origin (no function path): append the comps function path.
  if (/\bsupabase\.(co|in|net)\b/i.test(url)) return `${url}/functions/v1/comps`;
  // Site root: the provider appends /api/comps.
  return `${url}/api/comps`;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    const n = typeof v === 'number' ? v : v != null ? Number(v) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return undefined;
}

export interface HoursProbeResult {
  /** Resolved request URL, key never included (key travels in headers). */
  url: string;
  brandSent: string;
  referenceSent: string;
  status: number | null;
  ok: boolean;
  bodySnippet: string;
  parsedMid: number | null;
  networkError?: string;
}

export class HoursClient {
  private cache = new Map<string, WatchComp | null>();

  /**
   * One-shot diagnostic: send a known reference and report the raw HTTP
   * status + body, so a 401 (auth) / 404 (wrong URL) / 200-no_comp (format
   * mismatch) can be told apart. The key is sent in headers, never the URL.
   */
  async probe(brand: string, reference: string): Promise<HoursProbeResult> {
    const key = process.env.HOURS_API_KEY ?? '';
    const u = new URL(resolveUrl());
    u.searchParams.set('brand', brand);
    u.searchParams.set('reference', reference);
    const safeUrl = `${u.origin}${u.pathname}?brand=${encodeURIComponent(brand)}&reference=${encodeURIComponent(reference)}`;
    try {
      const res = await fetch(u, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${key}`, apikey: key },
        signal: AbortSignal.timeout(20_000),
      });
      const text = await res.text();
      let parsedMid: number | null = null;
      try {
        const payload = JSON.parse(text) as Record<string, unknown>;
        const body = (payload.data && typeof payload.data === 'object' ? payload.data : payload) as Record<string, unknown>;
        parsedMid = pickNumber(body, MID_KEYS) ?? null;
      } catch {
        /* body wasn't JSON */
      }
      return { url: safeUrl, brandSent: brand, referenceSent: reference, status: res.status, ok: res.ok, bodySnippet: text.slice(0, 600), parsedMid };
    } catch (err) {
      const cause = (err as { cause?: { code?: string; name?: string; message?: string } }).cause;
      const networkError = [cause?.code, cause?.name, cause?.message].filter(Boolean).join(': ') || (err instanceof Error ? err.message : String(err));
      return { url: safeUrl, brandSent: brand, referenceSent: reference, status: null, ok: false, bodySnippet: '', parsedMid: null, networkError };
    }
  }

  async compFor(brand: string, reference: string): Promise<WatchComp | null> {
    const cacheKey = `${brand}::${reference}`.toLowerCase();
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;
    const comp = await this.fetchComp(brand, reference);
    this.cache.set(cacheKey, comp);
    return comp;
  }

  private async fetchComp(brand: string, reference: string): Promise<WatchComp | null> {
    const key = process.env.HOURS_API_KEY;
    if (!key) throw new Error('HOURS_API_KEY is not set');
    const url = new URL(resolveUrl());
    url.searchParams.set('brand', brand);
    url.searchParams.set('reference', reference);
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
    });
    if (res.status === 404) return null; // no comp for this reference — hold
    if (!res.ok) throw new Error(`Hours comp lookup for ${reference}: HTTP ${res.status}`);
    const payload = (await res.json()) as Record<string, unknown>;
    const body = (payload.data && typeof payload.data === 'object' ? payload.data : payload) as Record<string, unknown>;
    const midUsd = pickNumber(body, MID_KEYS);
    if (midUsd === undefined) return null;
    const lowUsd = pickNumber(body, LOW_KEYS);
    const sourceCount = pickNumber(body, SOURCE_COUNT_KEYS);
    const asOf = pickString(body, ASOF_KEYS);
    return {
      midUsd,
      lowUsd,
      sourceCount: sourceCount !== undefined ? Math.round(sourceCount) : undefined,
      asOf: asOf?.slice(0, 10),
    };
  }
}

/** Bounded-concurrency map preserving input order. */
export async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return results;
}
