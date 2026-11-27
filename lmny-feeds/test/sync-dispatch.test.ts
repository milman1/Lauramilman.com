import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error Cloudflare Worker runs native JavaScript.
import worker from '../cloudflare-worker/feed-cache.js';
// @ts-expect-error Cloudflare Worker runs native JavaScript.
import { SYNC_DISPATCH_CRON, dispatchSync } from '../cloudflare-worker/sync-dispatch.js';

describe('hourly sync dispatch', () => {
  it('does nothing without a token', async () => {
    const fetchImpl = vi.fn();
    expect(await dispatchSync({}, fetchImpl)).toEqual({ dispatched: false, reason: 'no_token' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('starts the feed sync on main as a scheduled run, never with dry_run=false', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await dispatchSync({ GITHUB_DISPATCH_TOKEN: 't' }, fetchImpl)).toEqual({ dispatched: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/milman1/Lauramilman.com/actions/workflows/lmny-feed-sync.yml/dispatches');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t');
    expect(JSON.parse(init.body as string)).toEqual({ ref: 'main', inputs: { scheduled: 'true' } });
  });

  it('throws on a refused dispatch so the cron shows as failed', async () => {
    const fetchImpl = vi.fn(async () => new Response('Bad credentials', { status: 401 }));
    await expect(dispatchSync({ GITHUB_DISPATCH_TOKEN: 't' }, fetchImpl)).rejects.toThrow('HTTP 401');
  });

  it('the :17 cron dispatches and makes no supplier request', async () => {
    const waits: Promise<unknown>[] = [];
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const env = { GITHUB_DISPATCH_TOKEN: 't', FEED_CACHE: { get: vi.fn(), put: vi.fn() } };
    await worker.scheduled({ cron: SYNC_DISPATCH_CRON, scheduledTime: Date.UTC(2026, 10, 27, 15, 17) }, env, { waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('api.github.com');
    expect(env.FEED_CACHE.put).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
