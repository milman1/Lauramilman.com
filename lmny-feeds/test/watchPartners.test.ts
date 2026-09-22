import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAllowedWatchStocks } from '../src/feeds/watchPartners.js';

afterEach(() => vi.unstubAllGlobals());

describe('watch supplier allowlist fetch', () => {
  it('requests ROMAN and TLV and returns only those branch stocks', async () => {
    const requests: Array<{ url: string; body: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = String(init?.body ?? '');
      requests.push({ url, body });
      if (url.endsWith('/get-token')) return new Response('a'.repeat(20));
      const branch = new URLSearchParams(body).get('branch');
      const stock = branch === 'ROMAN' ? 'RW3085' : branch === 'TLV WATCHES LLC' ? 'T3717' : 'SHOULD-NOT';
      return Response.json({ record: [{ Stock: stock }], total: 1 });
    }));

    await expect(fetchAllowedWatchStocks()).resolves.toEqual(new Set(['RW3085', 'T3717']));
    const branchRequests = requests.filter((request) => request.url.includes('/watch'));
    expect(branchRequests.map((request) => new URLSearchParams(request.body).get('branch'))).toEqual([
      'ROMAN',
      'TLV WATCHES LLC',
    ]);
    expect(requests.some((request) => /VIVID/i.test(request.body))).toBe(false);
  });

  it('throws when ROMAN cannot be classified so the watch segment stays protected', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith('/get-token')) return new Response('a'.repeat(20));
      return Response.json({ record: [], total: 0 });
    }));

    await expect(fetchAllowedWatchStocks()).rejects.toThrow('watch partner allowlist: 0 stocks');
  });
});
