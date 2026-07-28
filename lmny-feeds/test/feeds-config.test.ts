import { describe, expect, it } from 'vitest';
import { parseEnabledFeeds } from '../src/feeds-config.js';

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
