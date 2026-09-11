import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FETCH_DEADLINE_MS,
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

/** Records whether the discarded response's body was released. */
const cancelled: boolean[] = [];

function errorPage(status: number, retryAfter?: string): Response {
  const body = {
    cancel: async () => {
      cancelled.push(true);
    },
  };
  return {
    ok: false,
    status,
    body,
    headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' && retryAfter ? retryAfter : null) },
    json: async () => ({}),
  } as unknown as Response;
}

/** 250 products = a full page, so the walk asks for the next one. */
const FULL_PAGE = Array.from({ length: 250 }, (_, i) => ({ handle: `row-${i}` }));

let fetchMock: ReturnType<typeof vi.fn>;
let waits: number[];
/** Fake wall clock: every injected wait advances it, nothing else does. */
let clock: number;
const sleep = async (ms: number) => {
  waits.push(ms);
  clock += ms;
};
const now = () => clock;

beforeEach(() => {
  waits = [];
  clock = 1_000_000;
  cancelled.length = 0;
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
    const rows = await fetchCompetitorPage(61, { sleep, now });
    expect(rows).toEqual([{ handle: 'a' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([5000]);
  });

  it('caps a long Retry-After at 30s', async () => {
    fetchMock.mockResolvedValueOnce(errorPage(429, '600')).mockResolvedValueOnce(jsonPage([]));
    await fetchCompetitorPage(1, { sleep, now });
    expect(waits).toEqual([30_000]);
  });

  it('honours Retry-After given as a strict HTTP date', () => {
    const at = Date.parse('2026-09-11T12:00:00Z');
    expect(retryAfterMs('Fri, 11 Sep 2026 12:00:08 GMT', 0, at)).toBe(8000);
  });

  it('ignores anything Date.parse would accept but the spec does not', () => {
    const at = Date.parse('2026-09-11T12:00:00Z');
    // '-5' and '1,5' both parse as a date in 2001 in V8, which used to come
    // back as a 0 ms wait and burn all four attempts in milliseconds.
    for (const header of ['-5', '1,5', ' ', '', 'soon', '5.5', '+5', '1e3']) {
      expect(retryAfterMs(header, 0, at)).toBe(1000);
      expect(retryAfterMs(header, 2, at)).toBe(4000);
    }
  });

  it('ignores a date in the past and any wait under a second', () => {
    const at = Date.parse('2026-09-11T12:00:00Z');
    expect(retryAfterMs('Fri, 11 Sep 2026 11:59:00 GMT', 0, at)).toBe(1000);
    expect(retryAfterMs('Fri, 11 Sep 2026 12:00:00 GMT', 1, at)).toBe(2000);
    expect(retryAfterMs('0', 0, at)).toBe(1000);
  });

  it('drains the discarded response body before retrying', async () => {
    fetchMock.mockResolvedValueOnce(errorPage(429, '5')).mockResolvedValueOnce(jsonPage([]));
    await fetchCompetitorPage(1, { sleep, now });
    expect(cancelled).toEqual([true]);
  });

  it('falls back to exponential backoff with no Retry-After header', async () => {
    fetchMock
      .mockResolvedValueOnce(errorPage(429))
      .mockResolvedValueOnce(errorPage(429))
      .mockResolvedValueOnce(errorPage(503))
      .mockResolvedValueOnce(jsonPage([{ handle: 'a' }]));
    await fetchCompetitorPage(61, { sleep, now });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(waits).toEqual([1000, 2000, 4000]);
  });

  it('gives up after 4 attempts and reports the status', async () => {
    fetchMock.mockResolvedValue(errorPage(429));
    await expect(fetchCompetitorPage(61, { sleep, now })).rejects.toThrow('Competitor feed: HTTP 429 for page 61');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('fails a 404 immediately, with no retry', async () => {
    fetchMock.mockResolvedValue(errorPage(404));
    await expect(fetchCompetitorPage(3, { sleep, now })).rejects.toThrow('Competitor feed: HTTP 404 for page 3');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([]);
  });

  it('fails a 403 immediately, with no retry', async () => {
    fetchMock.mockResolvedValue(errorPage(403));
    await expect(fetchCompetitorPage(3, { sleep, now })).rejects.toThrow('Competitor feed: HTTP 403 for page 3');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still retries a network throw', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce(jsonPage([{ handle: 'a' }]));
    const rows = await fetchCompetitorPage(1, { sleep, now });
    expect(rows).toEqual([{ handle: 'a' }]);
    expect(waits).toEqual([1000]);
  });

  it('reports a network failure after every attempt throws', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    await expect(fetchCompetitorPage(1, { sleep, now })).rejects.toThrow('Competitor feed: request failed (ECONNRESET)');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe('fetchCompetitorCatalog pacing', () => {
  it('waits PAGE_DELAY_MS between pages and not before the first', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonPage(FULL_PAGE))
      .mockResolvedValueOnce(jsonPage(FULL_PAGE))
      .mockResolvedValueOnce(jsonPage([{ handle: 'last' }]));
    const rows = await fetchCompetitorCatalog({ sleep, now });
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
    const rows = await fetchCompetitorCatalog({ sleep, now });
    expect(rows).toHaveLength(251);
    expect(waits).toEqual([PAGE_DELAY_MS, 2000]);
  });

  it('logs progress every 25 pages so a failure shows how far it got', async () => {
    const logged = vi.spyOn(console, 'log');
    for (let i = 0; i < 25; i++) fetchMock.mockResolvedValueOnce(jsonPage(FULL_PAGE));
    fetchMock.mockResolvedValueOnce(jsonPage([{ handle: 'last' }]));
    await fetchCompetitorCatalog({ sleep, now });
    const lines = logged.mock.calls.map((c) => String(c[0]));
    expect(lines.filter((l) => l.includes('25 pages fetched'))).toHaveLength(1);
  });
});

/**
 * Wall-clock bound. 4 attempts x 30 s plus three 30 s waits is 210 s per page;
 * across 200 pages a sustained throttle would run for hours and be cancelled
 * by the job timeout with no report at all — worse than the 429 the retry
 * exists for. The budget is checked with an injected clock, never real time.
 */
describe('fetchCompetitorCatalog deadline', () => {
  it('is six minutes', () => {
    expect(FETCH_DEADLINE_MS).toBe(360_000);
  });

  it('stops paginating and names how far it got', async () => {
    // A competitor that throttles every page once, then serves it: each page
    // costs a 30 s wait (Retry-After 60, capped) plus pacing, so the walk eats
    // the budget around page 12 instead of grinding through all 200.
    let call = 0;
    fetchMock.mockImplementation(async () =>
      call++ % 2 === 0 ? errorPage(429, '60') : jsonPage(FULL_PAGE),
    );
    await expect(fetchCompetitorCatalog({ sleep, now })).rejects.toThrow(
      /6-minute fetch deadline passed after \d+ of up to 200 pages \(\d+ rows read\)/,
    );
    // Bounded by the budget, not by 200 pages x 4 attempts.
    expect(clock - 1_000_000).toBeLessThanOrEqual(FETCH_DEADLINE_MS);
    expect(fetchMock.mock.calls.length).toBeLessThan(40);
  });

  it('never sleeps past the deadline', async () => {
    fetchMock.mockResolvedValue(errorPage(429, '30'));
    await expect(fetchCompetitorPage(1, { sleep, now, deadlineAt: clock + 10_000 })).rejects.toThrow(
      'Competitor feed: fetch deadline passed on page 1',
    );
    expect(waits).toEqual([]); // a 30s wait does not fit in a 10s budget
  });

  it('refuses to start a page once the budget is gone', async () => {
    fetchMock.mockResolvedValue(jsonPage(FULL_PAGE));
    await expect(fetchCompetitorPage(1, { sleep, now, deadlineAt: clock })).rejects.toThrow(
      'Competitor feed: fetch deadline passed on page 1',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves a healthy walk untouched', async () => {
    fetchMock.mockResolvedValueOnce(jsonPage(FULL_PAGE)).mockResolvedValueOnce(jsonPage([{ handle: 'last' }]));
    const rows = await fetchCompetitorCatalog({ sleep, now });
    expect(rows).toHaveLength(251);
    expect(clock - 1_000_000).toBe(PAGE_DELAY_MS);
  });
});
