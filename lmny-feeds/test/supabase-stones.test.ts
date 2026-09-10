import { describe, expect, it, vi } from 'vitest';
import { labStone, naturalStone, priced } from './fixtures.js';
import { contentHashFor } from '../src/product.js';
import {
  stoneRowFor,
  supabaseConfigured,
  dualWriteStones,
} from '../src/supabase-stones.js';

describe('supabaseConfigured', () => {
  it('returns null when either URL or key is missing', () => {
    expect(supabaseConfigured({})).toBeNull();
    expect(supabaseConfigured({ SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
    expect(supabaseConfigured({ SUPABASE_SERVICE_KEY: 'k' })).toBeNull();
  });

  it('accepts SERVICE_KEY or SERVICE_ROLE_KEY', () => {
    expect(
      supabaseConfigured({ SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_SERVICE_KEY: 'k' }),
    ).toEqual({ url: 'https://x.supabase.co', key: 'k' });
    expect(
      supabaseConfigured({
        SUPABASE_URL: 'https://x.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'role',
      }),
    ).toEqual({ url: 'https://x.supabase.co', key: 'role' });
  });
});

describe('stoneRowFor', () => {
  it('maps every filter column the App Proxy will query', () => {
    const item = labStone({
      shape: 'Round',
      carat: 1.22,
      color: 'F',
      clarity: 'VVS2',
      cut: 'Ideal',
    });
    const row = stoneRowFor(item, 744, 'hash', '2026-08-02T00:00:00Z');
    expect(row).toMatchObject({
      stock_ref: item.stockRef,
      kind: 'lab',
      shape: 'Round',
      carat: 1.22,
      color: 'F',
      clarity: 'VVS2',
      cut: 'Ideal',
      retail_usd: 744,
      available: true,
      content_hash: 'hash',
      price_per_carat_usd: item.pricePerCaratUsd ?? null,
    });
  });

  it('keeps colour/clarity on naturals too', () => {
    const item = naturalStone();
    const row = stoneRowFor(item, 15000, 'h', '2026-08-02T00:00:00Z');
    expect(row.color).toBe('F');
    expect(row.clarity).toBe('VS1');
    expect(row.cut).toBe('Excellent');
  });

  it('marks imageless stones unavailable so the grid cannot list them', () => {
    const row = stoneRowFor(labStone({ imageUrls: [] }), 120, 'h', '2026-08-02T00:00:00Z');
    expect(row.available).toBe(false);
    expect(row.image_urls).toEqual([]);
  });
});

describe('dualWriteStones', () => {
  it('POSTs upsert chunks to PostgREST', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body)) });
      return new Response('', { status: 201 });
    }) as unknown as typeof fetch;

    const publishable = [
      { item: labStone(), priced: priced({ retailUsd: 1550 }) },
      { item: naturalStone(), priced: priced({ retailUsd: 15000 }) },
    ];
    const hashes = new Map(
      publishable.map((p) => [p.item.stockRef, contentHashFor(p.item, p.priced)]),
    );
    const result = await dualWriteStones(publishable, hashes, '2026-08-02T00:00:00Z', {
      url: 'https://example.supabase.co',
      key: 'service',
      fetchImpl,
    });
    expect(result.upserted).toBe(2);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/rest/v1/stones?on_conflict=stock_ref');
    expect(calls[0]!.body).toHaveLength(2);
  });
});
