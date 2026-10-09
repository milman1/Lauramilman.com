import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error Cloudflare Worker runs native JavaScript.
import worker from '../cloudflare-worker/feed-cache.js';
// @ts-expect-error Cloudflare Worker runs native JavaScript.
import { collectFeed } from '../cloudflare-worker/complete-feed.js';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
afterEach(() => vi.unstubAllGlobals());

describe('complete feed snapshots', () => {
  it('collects all pages, not just the first 3000 rows', async () => {
    const pages = [Array.from({ length: 3000 }, (_, id) => ({ id })), [{ id: 3000 }], []];
    const fetchPage = vi.fn(async (page: number) => json({ data: pages[page - 1] }));
    expect(await collectFeed('lab', fetchPage)).toHaveLength(3001);
    expect(fetchPage.mock.calls.map(c => c[0])).toEqual([1, 2, 3]);
  });
  it('rejects a late HTTP failure or rate-limit response', async () => {
    for (const failed of [() => json({}, 429), () => json({ data: [], message: 'Rate limit reached' })]) {
      await expect(collectFeed('lab', async (p: number) => p === 1 ? json({ data: [{ id: 1 }] }) : failed())).rejects.toThrow();
    }
  });
  it('checks declared totals and rejects early termination', async () => {
    await expect(collectFeed('lab', async (p: number) => json({ total: 4, data: p === 1 ? [{ id: 1 }] : [] }))).rejects.toThrow('incomplete');
  });
  it('supports an API ignoring page only when no larger total is declared', async () => {
    expect(await collectFeed('natural', async () => json({ data: [{ id: 1 }] }))).toEqual([{ id: 1 }]);
    await expect(collectFeed('natural', async () => json({ data: [{ id: 1 }], total: 20 }))).rejects.toThrow('repeated');
  });
  it('rejects hitting the page cap and malformed large bodies', async () => {
    await expect(collectFeed('lab', async (p: number) => json({ data: [{ id: p }] }), 2)).rejects.toThrow('cap');
    await expect(collectFeed('lab', async () => json({ error: 'x'.repeat(5000) }))).rejects.toThrow();
  });
  it('never serves a legacy page-one cache or commits a failed refresh', async () => {
    const put = vi.fn();
    const env = { API_KEY: 'test-key', FEED_CACHE: {
      get: vi.fn(async () => null), put,
      getWithMetadata: vi.fn(async () => ({ value: null, metadata: null })),
    } };
    vi.stubGlobal('fetch', vi.fn(async () => json({ data: [], message: 'rate limit' })));
    const result = await worker.fetch(new Request('https://cache.test/api/developer-api/diamond?type=lab&key=test-key'), env, {});
    expect(result.status).toBe(503);
    expect(put).not.toHaveBeenCalled();
    expect(env.FEED_CACHE.getWithMetadata).toHaveBeenCalledWith('feed:v2:lab', { type: 'arrayBuffer' });
  });
  it('requires a complete fresh snapshot even for the page-two terminator', async () => {
    const env = { API_KEY: 'test-key', FEED_CACHE: {
      get: vi.fn(async () => null), put: vi.fn(),
      getWithMetadata: vi.fn(async () => ({ value: new ArrayBuffer(1), metadata: { complete: true, fetchedAt: new Date().toISOString(), rows: 25378 } })),
    } };
    const result = await worker.fetch(new Request('https://cache.test/api/developer-api/diamond?type=lab&page=2&key=test-key'), env, {});
    expect(await result.json()).toEqual({ data: [] });
  });
});
