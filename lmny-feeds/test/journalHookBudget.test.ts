import { describe, expect, it } from 'vitest';
import {
  HOOK_MIN_REQUEST_MS,
  HOOK_REQUEST_TIMEOUT_MS,
  HOOK_SEARCH_BUDGET_MS,
  hookRequestOptions,
} from '../scripts/journal-draft.js';

describe('Journal hook search time budget', () => {
  it('gives web search 10 minutes in total and each request at most 4, with one retry', () => {
    expect(HOOK_SEARCH_BUDGET_MS).toBe(10 * 60_000);
    expect(hookRequestOptions(HOOK_SEARCH_BUDGET_MS, 0)).toEqual({ timeout: HOOK_REQUEST_TIMEOUT_MS, maxRetries: 1 });
  });

  it('shortens the last request to what is left of the budget', () => {
    expect(hookRequestOptions(100_000, 0)?.timeout).toBe(100_000);
  });

  it('starts no new request once the budget is nearly spent, so the run falls back to RSS', () => {
    expect(hookRequestOptions(HOOK_MIN_REQUEST_MS - 1, 0)).toBeNull();
    expect(hookRequestOptions(0, 5_000)).toBeNull();
  });
});
