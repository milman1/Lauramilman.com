import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCompetitorCatalog,
  fetchCompetitorPage,
  PAGE_DELAY_MS,
  retryAfterMs,
} from '../../src/backvault/competitor.js';

/**
 * The 2026-09-11 weekly dry run died on `HTTP 429 for page 61`: fetchPage
 * only retried when `fetch` itself threw, and pages were requested back to
 * back. These cover the retry/backoff/pacing that replaced that.
 */

function jsonPage(products: unknown[]): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ products }),
  } as unknown as Response;
}

function errorPage(status: number, retryAfter?: string): Response {
  return {
    ok: false,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' && retryAfter ? retryAfter : null) },
    json: async () => ({}),
  } as unknown as Response;
}

/** 250 products = a full page, so the walk asks for the next one. */
const FULL_PAGE = Array.from({ length: 250 }, (_, i) => ({ handle: `row-${i}` }));

let fetchMock: ReturnType<typeof vi.fn>;
let waits: number[];
const sleep = async (ms: number) => {
  waits.push(ms);
};

beforeEach(() => {
  waits = [];
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchCompetitorPage retries', () => {
  it('retries a 429 and honours Retry-After in seconds', async () => {
    fetchMock.mockResolvedValueOnce(errorPage(429, '5')).mockResolvedValueOnce(jsonPage([{ handle: 'a' }]));
    const rows = await fetchCompetitorPage(61, { sleep });
    expect(rows).toEqual([{ handle: 'a' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([5000]);
  });

  it('caps a long Retry-After at 30s', async () => {
    fetchMock.mockResolvedValueOnce(errorPage(429, '600')).mockResolvedValueOnce(jsonPage([]));
    await fetchCompetitorPage(1, { sleep });
    expect(waits).toEqual([30_000]);
  });

  it('honours Retry-After given as an HTTP date', () => {
    const now = Date.parse('2026-09-11T12:00:00Z');
    expect(retryAfterMs('Fri, 11 Sep 2026 12:00:08 GMT', 0, now)).toBe(8000);
    // A date already in the past means retry now, not a negative wait.
    expect(retryAfterMs('Fri, 11 Sep 2026 11:59:00 GMT', 0, now)).toBe(0);
  });

  it('falls back to exponential backoff with no Retry-After header', async () => {
    fetchMock
      .mockResolvedValueOnce(errorPage(429))
      .mockResolvedValueOnce(errorPage(429))
      .mockResolvedValueOnce(errorPage(503))
      .mockResolvedValueOnce(jsonPage([{ handle: 'a' }]));
    await fetchCompetitorPage(61, { sleep });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(waits).toEqual([1000, 2000, 4000]);
  });

  it('gives up after 4 attempts and reports the status', async () => {
    fetchMock.mockResolvedValue(errorPage(429));
    await expect(fetchCompetitorPage(61, { sleep })).rejects.toThrow('Competitor feed: HTTP 429 for page 61');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('fails a 404 immediately, with no retry', async () => {
    fetchMock.mockResolvedValue(errorPage(404));
    await expect(fetchCompetitorPage(3, { sleep })).rejects.toThrow('Competitor feed: HTTP 404 for page 3');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([]);
  });

  it('fails a 403 immediately, with no retry', async () => {
    fetchMock.mockResolvedValue(errorPage(403));
    await expect(fetchCompetitorPage(3, { sleep })).rejects.toThrow('Competitor feed: HTTP 403 for page 3');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still retries a network throw', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce(jsonPage([{ handle: 'a' }]));
    const rows = await fetchCompetitorPage(1, { sleep });
    expect(rows).toEqual([{ handle: 'a' }]);
    expect(waits).toEqual([1000]);
  });

  it('reports a network failure after every attempt throws', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    await expect(fetchCompetitorPage(1, { sleep })).rejects.toThrow('Competitor feed: request failed (ECONNRESET)');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe('fetchCompetitorCatalog pacing', () => {
  it('waits PAGE_DELAY_MS between pages and not before the first', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonPage(FULL_PAGE))
      .mockResolvedValueOnce(jsonPage(FULL_PAGE))
      .mockResolvedValueOnce(jsonPage([{ handle: 'last' }]));
    const rows = await fetchCompetitorCatalog({ sleep });
    expect(rows).toHaveLength(501);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(PAGE_DELAY_MS).toBe(250);
    expect(waits).toEqual([PAGE_DELAY_MS, PAGE_DELAY_MS]);
  });

  it('paces and retries together: page 2 throttled, then resumed', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonPage(FULL_PAGE))
      .mockResolvedValueOnce(errorPage(429, '2'))
      .mockResolvedValueOnce(jsonPage([{ handle: 'last' }]));
    const rows = await fetchCompetitorCatalog({ sleep });
    expect(rows).toHaveLength(251);
    expect(waits).toEqual([PAGE_DELAY_MS, 2000]);
  });

  it('logs progress every 25 pages so a failure shows how far it got', async () => {
    const logged = vi.spyOn(console, 'log');
    for (let i = 0; i < 25; i++) fetchMock.mockResolvedValueOnce(jsonPage(FULL_PAGE));
    fetchMock.mockResolvedValueOnce(jsonPage([{ handle: 'last' }]));
    await fetchCompetitorCatalog({ sleep });
    const lines = logged.mock.calls.map((c) => String(c[0]));
    expect(lines.filter((l) => l.includes('25 pages fetched'))).toHaveLength(1);
  });
});
