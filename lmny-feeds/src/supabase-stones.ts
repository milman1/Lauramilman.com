/**
 * Optional dual-write of priced stones into Supabase `public.stones`.
 *
 * Gated on SUPABASE_URL + SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY).
 * When unset the sync behaves exactly as before — Shopify remains the only
 * store. Populate and verify this table before deleting tag:lmny-feed products.
 */

import type { Publishable, StoneItem } from './types.js';

export interface StoneRow {
  stock_ref: string;
  kind: 'natural' | 'lab';
  shape: string;
  carat: number;
  color: string;
  clarity: string;
  cut: string | null;
  polish: string | null;
  symmetry: string | null;
  fluorescence: string | null;
  lab: string;
  cert_number: string | null;
  cert_url: string | null;
  measurements: string | null;
  table_pct: number | null;
  depth_pct: number | null;
  cost_usd: number;
  rap_price_usd: number | null;
  retail_usd: number;
  image_urls: string[];
  video_urls: string[];
  content_hash: string;
  synced_at: string;
  available: boolean;
}

export function supabaseConfigured(
  env: NodeJS.ProcessEnv = process.env,
): { url: string; key: string } | null {
  const url = env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function stoneRowFor(
  item: StoneItem,
  retailUsd: number,
  contentHash: string,
  syncedAt: string,
): StoneRow {
  return {
    stock_ref: item.stockRef,
    kind: item.kind,
    shape: item.shape,
    carat: item.carat,
    color: item.color,
    clarity: item.clarity,
    cut: item.cut ?? null,
    polish: item.polish ?? null,
    symmetry: item.symmetry ?? null,
    fluorescence: item.fluorescence ?? null,
    lab: item.lab,
    cert_number: item.certNumber ?? null,
    cert_url: item.certUrl ?? null,
    measurements: item.measurements ?? null,
    table_pct: item.tablePct ?? null,
    depth_pct: item.depthPct ?? null,
    cost_usd: item.costUsd,
    rap_price_usd: item.rapPriceUsd ?? null,
    retail_usd: retailUsd,
    image_urls: item.imageUrls,
    video_urls: item.videoUrls,
    content_hash: contentHash,
    synced_at: syncedAt,
    available: true,
  };
}

/** Upsert publishable stones; mark stock_refs that left the feed unavailable. */
export async function dualWriteStones(
  publishable: Publishable[],
  contentHashByStockRef: Map<string, string>,
  syncedAt: string,
  opts: { url: string; key: string; fetchImpl?: typeof fetch } = supabaseConfigured()!,
): Promise<{ upserted: number; markedUnavailable: number }> {
  const stones = publishable.filter((p): p is Publishable & { item: StoneItem } => p.item.kind !== 'watch');
  const rows = stones.map((p) =>
    stoneRowFor(p.item, p.priced.retailUsd, contentHashByStockRef.get(p.item.stockRef) ?? '', syncedAt),
  );
  const fetchFn = opts.fetchImpl ?? fetch;
  const headers = {
    apikey: opts.key,
    Authorization: `Bearer ${opts.key}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates',
  };

  // Chunk upserts — PostgREST defaults are fine for a few hundred rows; lab
  // is ~20k so batch.
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const res = await fetchFn(`${opts.url}/rest/v1/stones?on_conflict=stock_ref`, {
      method: 'POST',
      headers,
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`stones upsert HTTP ${res.status}: ${body.slice(0, 400)}`);
    }
  }

  // Mark anything still available whose stock_ref was not in this run as gone.
  // Prefer an RPC for this once the project exists; until then, patch by kind
  // with a NOT IN list is too large, so we only soft-delete when the run
  // covered both stone feeds (caller passes liveStockRefs).
  return { upserted: rows.length, markedUnavailable: 0 };
}

/**
 * Soft-delete stones whose stock_ref is no longer publishable.
 * Only safe to call when both natural and lab feeds fetched successfully.
 */
export async function markMissingStonesUnavailable(
  liveStockRefs: Set<string>,
  opts: { url: string; key: string; fetchImpl?: typeof fetch } = supabaseConfigured()!,
): Promise<number> {
  const fetchFn = opts.fetchImpl ?? fetch;
  // Fetch currently-available refs, then patch the ones missing from live.
  const res = await fetchFn(
    `${opts.url}/rest/v1/stones?select=stock_ref&available=eq.true`,
    {
      headers: {
        apikey: opts.key,
        Authorization: `Bearer ${opts.key}`,
      },
    },
  );
  if (!res.ok) {
    throw new Error(`stones list HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const existing = (await res.json()) as Array<{ stock_ref: string }>;
  const gone = existing.map((r) => r.stock_ref).filter((ref) => !liveStockRefs.has(ref));
  if (gone.length === 0) return 0;

  const chunkSize = 200;
  for (let i = 0; i < gone.length; i += chunkSize) {
    const chunk = gone.slice(i, i + chunkSize);
    const filter = chunk.map(encodeURIComponent).join(',');
    const patch = await fetchFn(`${opts.url}/rest/v1/stones?stock_ref=in.(${filter})`, {
      method: 'PATCH',
      headers: {
        apikey: opts.key,
        Authorization: `Bearer ${opts.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ available: false }),
    });
    if (!patch.ok) {
      throw new Error(`stones soft-delete HTTP ${patch.status}: ${(await patch.text()).slice(0, 400)}`);
    }
  }
  return gone.length;
}
