import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAP_PAGE_FLOOR,
  describeCompetitorStop,
  FETCH_DEADLINE_MS,
  fetchCompetitorCatalog,
  fetchCompetitorPage,
  PAGE_DELAY_MS,
  PAGINATION_CAP_PAGES,
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
    const result = await fetchCompetitorCatalog({ sleep, now });
    expect(result.rows).toHaveLength(501);
    expect(result).toMatchObject({ complete: true, pagesRead: 3, stoppedReason: 'exhausted' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(PAGE_DELAY_MS).toBe(250);
    expect(waits).toEqual([PAGE_DELAY_MS, PAGE_DELAY_MS]);
  });

  it('paces and retries together: page 2 throttled, then resumed', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonPage(FULL_PAGE))
      .mockResolvedValueOnce(errorPage(429, '2'))
      .mockResolvedValueOnce(jsonPage([{ handle: 'last' }]));
    const result = await fetchCompetitorCatalog({ sleep, now });
    expect(result.rows).toHaveLength(251);
    expect(result.complete).toBe(true);
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
 * The retailer caps page-based pagination at 100 pages of 250. On 2026-09-11
 * page 101 came back HTTP 400 after 25,000 rows had been read, and the walk
 * threw all 25,000 away, so the price comparison had still never run. A 4xx
 * past page 1 is the end of the road, not a failure.
 */
describe('fetchCompetitorCatalog pagination cap', () => {
  /**
   * Serves `cap` full pages and `status` for every page past them, keyed off
   * the page number in the URL — so a re-request of page 1 answers like page
   * 1, which is what the liveness probe depends on.
   */
  function cappedAt(cap: number, status: number, probe?: () => Response): void {
    let seenPageOne = false;
    fetchMock.mockImplementation(async (url: string) => {
      const page = Number(new URL(String(url)).searchParams.get('page'));
      if (page === 1) {
        if (seenPageOne && probe) return probe();
        seenPageOne = true;
      }
      return page <= cap ? jsonPage(FULL_PAGE) : errorPage(status);
    });
  }

  it('keeps all 25,000 rows when page 101 returns 400', async () => {
    cappedAt(PAGINATION_CAP_PAGES, 400);
    const result = await fetchCompetitorCatalog({ sleep, now });
    expect(result.rows).toHaveLength(25_000);
    expect(result.pagesRead).toBe(100);
    expect(result.complete).toBe(false);
    expect(result.stoppedReason).toBe('pagination-cap');
    expect(result.stoppedDetail).toContain('page 101 returned HTTP 400');
    // 100 pages + the 400 (not retried, it is not transient) + one probe.
    expect(fetchMock).toHaveBeenCalledTimes(102);
  });

  it('treats 404, 414 and 422 at the cap the same way', async () => {
    for (const status of [404, 414, 422]) {
      fetchMock.mockReset();
      cappedAt(PAGINATION_CAP_PAGES, status);
      const result = await fetchCompetitorCatalog({ sleep, now });
      expect(result.rows).toHaveLength(25_000);
      expect(result.stoppedReason).toBe('pagination-cap');
    }
  });

  it('throws on a 4xx far short of the cap, even with page 1 alive', async () => {
    // A feed that moved and starts 404ing at page 2 would otherwise hand back
    // a 250-row partial carrying a fabricated pagination-cap diagnosis.
    cappedAt(1, 404);
    await expect(fetchCompetitorCatalog({ sleep, now })).rejects.toThrow('Competitor feed: HTTP 404 for page 2');
  });

  it('reads the cap no earlier than CAP_PAGE_FLOOR pages', async () => {
    expect(CAP_PAGE_FLOOR).toBe(90);
    cappedAt(CAP_PAGE_FLOOR - 1, 400);
    await expect(fetchCompetitorCatalog({ sleep, now })).rejects.toThrow('Competitor feed: HTTP 400 for page 90');
    fetchMock.mockReset();
    cappedAt(CAP_PAGE_FLOOR, 400);
    const result = await fetchCompetitorCatalog({ sleep, now });
    expect(result.stoppedReason).toBe('pagination-cap');
    expect(result.pagesRead).toBe(CAP_PAGE_FLOOR);
  });

  it('throws when the probe finds page 1 gone: the feed moved, it is not a cap', async () => {
    cappedAt(PAGINATION_CAP_PAGES, 400, () => errorPage(404));
    await expect(fetchCompetitorCatalog({ sleep, now })).rejects.toThrow('Competitor feed: HTTP 400 for page 101');
  });

  it('throws when the probe finds page 1 no longer full', async () => {
    // A page-1 that suddenly holds 3 rows is a feed that was rebuilt, not a
    // catalogue whose 101st page does not exist.
    cappedAt(PAGINATION_CAP_PAGES, 400, () => jsonPage([{ handle: 'a' }, { handle: 'b' }, { handle: 'c' }]));
    await expect(fetchCompetitorCatalog({ sleep, now })).rejects.toThrow('Competitor feed: HTTP 400 for page 101');
  });

  it('still throws on a 400 on page 1 — a feed that is wrong or gone', async () => {
    cappedAt(0, 400);
    await expect(fetchCompetitorCatalog({ sleep, now })).rejects.toThrow('Competitor feed: HTTP 400 for page 1');
  });

  it('still throws on a 403 at the cap — blocked is not exhausted', async () => {
    cappedAt(PAGINATION_CAP_PAGES, 403);
    await expect(fetchCompetitorCatalog({ sleep, now })).rejects.toThrow('Competitor feed: HTTP 403 for page 101');
  });

  it('still throws on a 500 mid-walk, after its retries', async () => {
    cappedAt(1, 500);
    await expect(fetchCompetitorCatalog({ sleep, now })).rejects.toThrow('Competitor feed: HTTP 500 for page 2');
  });

  it('still throws on a malformed response', async () => {
    fetchMock.mockResolvedValueOnce(jsonPage(FULL_PAGE)).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({}),
    } as unknown as Response);
    await expect(fetchCompetitorCatalog({ sleep, now })).rejects.toThrow('response had no `products` array');
  });

  it('describes the partial read in one line for the report', async () => {
    cappedAt(PAGINATION_CAP_PAGES, 400);
    const said = describeCompetitorStop(await fetchCompetitorCatalog({ sleep, now }));
    expect(said).toContain('25000 rows over 100 pages');
    expect(said).toContain('caps page-based pagination at 100 pages of 250');
  });

  it('calls a walk that ran out of pages complete', async () => {
    fetchMock.mockResolvedValueOnce(jsonPage(FULL_PAGE)).mockResolvedValueOnce(jsonPage([]));
    const result = await fetchCompetitorCatalog({ sleep, now });
    expect(result).toMatchObject({ complete: true, stoppedReason: 'exhausted', pagesRead: 2 });
    expect(describeCompetitorStop(result)).toBe('250 rows over 2 pages (the whole catalogue)');
  });
});

/**
 * Wall-clock bound. 4 attempts x 30 s plus three 30 s waits is 210 s per page;
 * across 200 pages a sustained throttle would run for hours and be cancelled
 * by the job timeout with no report at all — worse than the 429 the retry
 * exists for. The budget is checked with an injected clock, never real time.
 */
describe('fetchCompetitorCatalog deadline', () => {
  it('is ten minutes — sized for the competitor\'s ~80-page catalogue, not the supplier\'s', () => {
    expect(FETCH_DEADLINE_MS).toBe(600_000);
  });

  it('stops paginating and keeps the rows it already read', async () => {
    // A competitor that throttles every page once, then serves it: each page
    // costs a 30 s wait (Retry-After 60, capped) plus pacing, so the walk eats
    // the budget around page 12 instead of grinding through all 200.
    let call = 0;
    fetchMock.mockImplementation(async () =>
      call++ % 2 === 0 ? errorPage(429, '60') : jsonPage(FULL_PAGE),
    );
    const result = await fetchCompetitorCatalog({ sleep, now });
    // A partial index, not a throw: the pages already read still price pieces.
    expect(result.complete).toBe(false);
    expect(result.stoppedReason).toBe('deadline');
    expect(result.pagesRead).toBeGreaterThan(0);
    expect(result.rows).toHaveLength(result.pagesRead * 250);
    expect(result.stoppedDetail).toMatch(/10-minute fetch deadline passed/);
    // Bounded by the budget, not by 200 pages x 4 attempts.
    expect(clock - 1_000_000).toBeLessThanOrEqual(FETCH_DEADLINE_MS);
    expect(fetchMock.mock.calls.length).toBeLessThan(60);
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
    const result = await fetchCompetitorCatalog({ sleep, now });
    expect(result.rows).toHaveLength(251);
    expect(result).toMatchObject({ complete: true, stoppedReason: 'exhausted' });
    expect(clock - 1_000_000).toBe(PAGE_DELAY_MS);
  });
});

describe('deadline message', () => {
  it('says the competitor was throttling when retries were taken', async () => {
    let call = 0;
    fetchMock.mockImplementation(async () =>
      call++ % 2 === 0 ? errorPage(429, '60') : jsonPage(FULL_PAGE),
    );
    const result = await fetchCompetitorCatalog({ sleep, now });
    expect(result.stoppedDetail).toMatch(/after \d+ retries — the competitor was throttling/);
    expect(describeCompetitorStop(result)).toMatch(/^\d+ rows over \d+ pages — /);
  });

  it('says the walk was too slow when nothing was ever retried', async () => {
    // Healthy pages, but each request eats 40 s of clock: no retry is taken,
    // so the deadline is the thing that is wrong, and the message says so.
    fetchMock.mockImplementation(async () => {
      clock += 40_000;
      return jsonPage(FULL_PAGE);
    });
    const result = await fetchCompetitorCatalog({ sleep, now });
    expect(result.stoppedDetail).toMatch(
      /with no retries — the walk was simply too slow, so the deadline is mis-sized/,
    );
  });

  it('reports a request aborted at the end of the budget as the deadline, not a network failure', async () => {
    // The clamped per-request timeout aborts the last attempt exactly as the
    // budget runs out; without the deadline check on that path the run would
    // lose the page and row counts to 'request failed (…aborted)'.
    fetchMock.mockImplementation(async () => {
      clock += 200_000;
      throw new Error('This operation was aborted');
    });
    await expect(fetchCompetitorCatalog({ sleep, now })).rejects.toThrow(
      /10-minute fetch deadline passed after 0 of up to 200 pages \(0 rows read\)/,
    );
  });

  it('still reports a plain network failure as one', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    await expect(fetchCompetitorCatalog({ sleep, now })).rejects.toThrow(
      'Competitor feed: request failed (ECONNRESET)',
    );
  });
});
