import { describe, expect, it } from 'vitest';
import { channelsFor, LOOSE_DIAMOND_CHANNELS, SALES_CHANNELS } from '../config/channels.js';

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
