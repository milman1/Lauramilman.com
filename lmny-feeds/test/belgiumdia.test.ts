import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractRows, fetchBelgiumDiaFeed } from '../src/feeds/belgiumdia.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BELGIUMDIA_API_KEY;
  delete process.env.BELGIUMDIA_API_URL;
});

describe('belgiumdia response parsing', () => {
  it('finds a bare array of rows', () => {
    expect(extractRows([{ a: 1 }, { a: 2 }])).toHaveLength(2);
  });

  it('finds rows nested under a common wrapper key', () => {
    expect(extractRows({ data: [{ stock_ref: 'X' }] })).toEqual([{ stock_ref: 'X' }]);
    expect(extractRows({ diamonds: [{ id: 1 }], page: 1, total: 3800 })).toEqual([{ id: 1 }]);
  });

  it('returns [] for an empty page (pagination stop signal)', () => {
    expect(extractRows({ data: [] })).toEqual([]);
    expect(extractRows([])).toEqual([]);
  });

  it('returns null when no array of objects is present', () => {
    expect(extractRows({ message: 'no results' })).toBeNull();
    expect(extractRows(null)).toBeNull();
  });
});

describe('belgiumdia cache fallback', () => {
  it('falls back to the supplier when cache page 1 is empty', async () => {
    process.env.BELGIUMDIA_API_KEY = 'test-key';
    process.env.BELGIUMDIA_API_URL = 'https://cache.example';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValueOnce(json({ data: [{ stock_ref: 'N-1' }] }))
      .mockResolvedValueOnce(json({ data: [{ stock_ref: 'N-2' }] }))
      .mockResolvedValueOnce(json({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBelgiumDiaFeed('natural')).resolves.toEqual([
      { stock_ref: 'N-1' },
      { stock_ref: 'N-2' },
    ]);
    expect(String(fetchMock.mock.calls[1]![0])).toContain('belgiumdia.com');
    expect(String(fetchMock.mock.calls[2]![0])).toContain('belgiumdia.com');
  });

  it('uses a nonempty cache and preserves its page 2 terminator', async () => {
    process.env.BELGIUMDIA_API_KEY = 'test-key';
    process.env.BELGIUMDIA_API_URL = 'https://cache.example';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ data: [{ stock_ref: 'N-1' }] }))
      .mockResolvedValueOnce(json({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBelgiumDiaFeed('natural')).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith('https://cache.example'))).toBe(true);
  });

  it('fails the whole feed instead of mixing sources after a late cache error', async () => {
    process.env.BELGIUMDIA_API_KEY = 'test-key';
    process.env.BELGIUMDIA_API_URL = 'https://cache.example';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ data: [{ stock_ref: 'N-1' }] }))
      .mockResolvedValueOnce(json({ message: 'cache unavailable' }, 500));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBelgiumDiaFeed('natural')).rejects.toThrow(/cache failed after page 1/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith('https://cache.example'))).toBe(true);
  });

  it('falls back to the supplier on a cache HTTP error', async () => {
    process.env.BELGIUMDIA_API_KEY = 'test-key';
    process.env.BELGIUMDIA_API_URL = 'https://cache.example';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ message: 'forbidden' }, 403))
      .mockResolvedValueOnce(json({ data: [{ Stock: 'RW1' }] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBelgiumDiaFeed('watch')).resolves.toEqual([{ Stock: 'RW1' }]);
    expect(String(fetchMock.mock.calls[1]![0])).toContain('belgiumdia.com');
  });

  it('keeps an empty direct-source response empty and fail closed', async () => {
    process.env.BELGIUMDIA_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(json({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBelgiumDiaFeed('watch')).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
