import { describe, expect, it } from 'vitest';
import {
  channelsFor,
  LOOSE_DIAMOND_CHANNELS,
  publicationMatchesChannel,
  SALES_CHANNELS,
} from '../config/channels.js';
import { channelsForHandle } from '../src/diff.js';

describe('SALES_CHANNELS', () => {
  it('is the five channels the merchant approved on 2026-09-10, in order', () => {
    expect([...SALES_CHANNELS]).toEqual([
      'Online Store',
      'Shop',
      'Google & YouTube',
      'Facebook & Instagram',
      'Pinterest',
    ]);
  });

  it('starts with Online Store so a partial resolve still lists the storefront', () => {
    expect(SALES_CHANNELS[0]).toBe('Online Store');
  });

  it('has no duplicates', () => {
    expect(new Set(SALES_CHANNELS).size).toBe(SALES_CHANNELS.length);
  });

  it('does not list eBay — Marketplace Connect is not a publication', () => {
    expect(SALES_CHANNELS.some((c) => /ebay/i.test(c))).toBe(false);
  });
});

describe('LOOSE_DIAMOND_CHANNELS', () => {
  it('is Online Store and Shop only', () => {
    expect([...LOOSE_DIAMOND_CHANNELS]).toEqual(['Online Store', 'Shop']);
  });

  it('is a subset of the full list', () => {
    for (const channel of LOOSE_DIAMOND_CHANNELS) {
      expect(SALES_CHANNELS).toContain(channel);
    }
  });
});

describe('channelsFor', () => {
  it('keeps loose stones off Merchant Center and Meta', () => {
    expect([...channelsFor('diamond')]).toEqual([...LOOSE_DIAMOND_CHANNELS]);
  });

  it('sends watches to every channel', () => {
    expect([...channelsFor('watch')]).toEqual([...SALES_CHANNELS]);
  });

  it('sends estate pieces to every channel', () => {
    expect([...channelsFor('estate')]).toEqual([...SALES_CHANNELS]);
  });
});

describe('publicationMatchesChannel', () => {
  it('matches an exact publication name', () => {
    expect(publicationMatchesChannel('Pinterest', 'Pinterest')).toBe(true);
    expect(publicationMatchesChannel('Pinterest', 'TikTok')).toBe(false);
  });

  it('accepts either storefront publication name', () => {
    expect(publicationMatchesChannel('Online Store', 'Online Store')).toBe(true);
    expect(publicationMatchesChannel('Online Store', 'Online Store 2.0')).toBe(true);
  });

  it('does not treat the storefront alias as any other channel', () => {
    expect(publicationMatchesChannel('Shop', 'Online Store 2.0')).toBe(false);
  });
});

describe('channelsForHandle (Belgium Dia routing)', () => {
  it('sends a watch to all five channels', () => {
    expect([...channelsForHandle('w-3194')]).toEqual([...SALES_CHANNELS]);
    expect(channelsForHandle('w-3194')).toHaveLength(5);
  });

  it('keeps a natural stone on the two-channel list', () => {
    expect([...channelsForHandle('nd-350393')]).toEqual([...LOOSE_DIAMOND_CHANNELS]);
  });

  it('keeps a lab stone on the two-channel list', () => {
    expect([...channelsForHandle('lg-ak3808')]).toEqual([...LOOSE_DIAMOND_CHANNELS]);
  });

  it('falls back to the narrow list for a missing or unrecognized handle', () => {
    // A bulk write can return a product without a handle; the safe default is
    // the list that keeps stones out of Merchant Center and Meta.
    expect([...channelsForHandle(null)]).toEqual([...LOOSE_DIAMOND_CHANNELS]);
    expect([...channelsForHandle(undefined)]).toEqual([...LOOSE_DIAMOND_CHANNELS]);
    expect([...channelsForHandle('bv-cartier-love')]).toEqual([...LOOSE_DIAMOND_CHANNELS]);
    expect([...channelsForHandle('')]).toEqual([...LOOSE_DIAMOND_CHANNELS]);
  });
});
