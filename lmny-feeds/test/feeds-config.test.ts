import { describe, expect, it } from 'vitest';
import { FEED_FETCH_ORDER, parseEnabledFeeds } from '../src/feeds-config.js';

describe('SYNC_FEEDS gate', () => {
  it('defaults to natural only when unset', () => {
    expect([...parseEnabledFeeds(undefined)]).toEqual(['natural']);
  });

  it('parses a comma list and ignores whitespace/case', () => {
    expect([...parseEnabledFeeds('natural, LAB')].sort()).toEqual(['lab', 'natural']);
  });

  it('drops unknown tokens', () => {
    expect([...parseEnabledFeeds('natural,gold,watch')].sort()).toEqual(['natural', 'watch']);
  });

  it('falls back to natural when empty or all-invalid', () => {
    expect([...parseEnabledFeeds('')]).toEqual(['natural']);
    expect([...parseEnabledFeeds('nonsense')]).toEqual(['natural']);
  });
});

describe('FEED_FETCH_ORDER', () => {
  it('fetches watch before natural/lab so the rate-limit slot is not burned first', () => {
    expect(FEED_FETCH_ORDER[0]).toBe('watch');
    expect(FEED_FETCH_ORDER).toEqual(['watch', 'natural', 'lab']);
  });
});
