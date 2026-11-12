import { describe, expect, it } from 'vitest';
import { THROTTLE_BUDGET_MS, throttleWaitMs } from '../src/shopify.js';

describe('throttleWaitMs', () => {
  it('waits until the bucket holds the query cost again', () => {
    // 1000 needed, 200 there, 100 a second back: 8 s plus slack.
    expect(throttleWaitMs({ requestedQueryCost: 1000, throttleStatus: { maximumAvailable: 2000, currentlyAvailable: 200, restoreRate: 100 } })).toBe(8250);
  });

  it('falls back to the bucket size when the query cost is not given', () => {
    expect(throttleWaitMs({ throttleStatus: { maximumAvailable: 1000, currentlyAvailable: 0, restoreRate: 50 } })).toBe(20250);
  });

  it('stays between 1 and 30 seconds, and waits 2 s with nothing to go on', () => {
    expect(throttleWaitMs({ requestedQueryCost: 10, throttleStatus: { currentlyAvailable: 900, restoreRate: 50 } })).toBe(1000);
    expect(throttleWaitMs({ requestedQueryCost: 20000, throttleStatus: { currentlyAvailable: 0, restoreRate: 50 } })).toBe(30000);
    expect(throttleWaitMs(undefined)).toBe(2000);
    expect(throttleWaitMs({ throttleStatus: { currentlyAvailable: 0, restoreRate: 0 } })).toBe(2000);
  });

  it('keeps retrying for ten minutes, not the 2.5 that failed on 2026-11-11', () => {
    expect(THROTTLE_BUDGET_MS).toBe(600000);
  });
});
