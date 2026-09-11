import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAllowedWatchStocks } from '../src/feeds/watchPartners.js';

afterEach(() => vi.unstubAllGlobals());

describe('watch supplier allowlist fetch', () => {
  it('requests only ROMAN and returns only that branch stock', async () => {
    const requests: Array<{ url: string; body: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, body: String(init?.body ?? '') });
      if (url.endsWith('/get-token')) return new Response('a'.repeat(20));
      return Response.json({ record: [{ Stock: 'RW3085' }, { Stock: 'ROMAN-FUTURE-1' }], total: 2 });
    }));

    await expect(fetchAllowedWatchStocks()).resolves.toEqual(new Set(['RW3085', 'ROMAN-FUTURE-1']));
    const branchRequests = requests.filter((request) => request.url.includes('/watch'));
    expect(branchRequests).toHaveLength(1);
    expect(new URLSearchParams(branchRequests[0]!.body).get('branch')).toBe('ROMAN');
    expect(requests.some((request) => /TLV|VIVID/i.test(request.body))).toBe(false);
  });

  it('throws when ROMAN cannot be classified so the watch segment stays protected', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith('/get-token')) return new Response('a'.repeat(20));
      return Response.json({ record: [], total: 0 });
    }));

    await expect(fetchAllowedWatchStocks()).rejects.toThrow('watch partner allowlist: 0 stocks');
  });
});
