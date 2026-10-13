import { describe, expect, it } from 'vitest';
import {
  EMPTY_FEED_ERROR,
  EMPTY_FEED_RETRY_MS,
  emptyFeedRetryDelayMs,
  feedsNeedingRetry,
} from '../src/feedRetry.js';
import type { Kind } from '../src/types.js';

function stats(over: Partial<Record<Kind, { fetchError?: string; skipped?: boolean }>> = {}) {
  const base = {
    natural: {},
    lab: {},
    watch: {},
  } as Record<Kind, { fetchError?: string; skipped?: boolean }>;
  return { ...base, ...over };
}

describe('empty feed retry', () => {
  it('waits out the supplier window by default', () => {
    expect(emptyFeedRetryDelayMs({})).toBe(EMPTY_FEED_RETRY_MS);
    expect(EMPTY_FEED_RETRY_MS).toBe(15 * 60 * 1000);
  });

  it('honors an explicit delay, including zero', () => {
    expect(emptyFeedRetryDelayMs({ BELGIUMDIA_EMPTY_RETRY_MS: '0' })).toBe(0);
    expect(emptyFeedRetryDelayMs({ BELGIUMDIA_EMPTY_RETRY_MS: '5000' })).toBe(5000);
  });

  it('falls back when the override is not a delay', () => {
    expect(emptyFeedRetryDelayMs({ BELGIUMDIA_EMPTY_RETRY_MS: 'nope' })).toBe(EMPTY_FEED_RETRY_MS);
    expect(emptyFeedRetryDelayMs({ BELGIUMDIA_EMPTY_RETRY_MS: '-1' })).toBe(EMPTY_FEED_RETRY_MS);
    expect(emptyFeedRetryDelayMs({ BELGIUMDIA_EMPTY_RETRY_MS: '  ' })).toBe(EMPTY_FEED_RETRY_MS);
  });

  it('retries only an empty live feed, in fetch order', () => {
    expect(
      feedsNeedingRetry(
        stats({
          watch: { fetchError: 'Belgium Dia watch feed: HTTP 403' },
          natural: { skipped: true, fetchError: EMPTY_FEED_ERROR },
          lab: { fetchError: EMPTY_FEED_ERROR },
        }),
      ),
    ).toEqual(['lab']);
  });

  it('does not retry a feed that returned rows', () => {
    expect(feedsNeedingRetry(stats())).toEqual([]);
  });
});
