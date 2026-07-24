/**
 * Hours market-comp client (per watch reference).
 *
 * HOURS_API_URL handling per the provider's contract: a direct Supabase
 * function URL is used as-is; a site root gets `/api/comps` appended.
 * A 404 means "no market comp" — a hold, not an error.
 */

import type { WatchComp } from '../markup.js';

function resolveUrl(): string {
  const raw = process.env.HOURS_API_URL;
  if (!raw) throw new Error('HOURS_API_URL is not set');
  const url = raw.replace(/\/+$/, '');
  if (/supabase|\/functions\//i.test(url) || /\/api\//i.test(url)) return url;
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

export class HoursClient {
  private cache = new Map<string, WatchComp | null>();

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
    const midUsd = pickNumber(body, ['comp_mid_usd', 'comp_mid', 'mid', 'median', 'mid_usd', 'price_mid', 'market_mid']);
    if (midUsd === undefined) return null;
    const asOf = pickString(body, ['comp_as_of', 'as_of', 'updated_at', 'date']);
    return { midUsd, asOf: asOf?.slice(0, 10) };
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
