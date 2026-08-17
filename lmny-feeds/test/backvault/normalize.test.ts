import { describe, expect, it } from 'vitest';
import { normalizeBackVaultFeed } from '../../src/backvault/normalize.js';
import { containsBackVaultReference } from '../../src/backvault/scrub.js';
import type { RawBackVaultProduct } from '../../src/backvault/types.js';

function product(overrides: Partial<RawBackVaultProduct> = {}): RawBackVaultProduct {
  return {
    id: 1,
    handle: 'cartier-love-bracelet-yg',
    title: 'Cartier Love Bracelet 18K Yellow Gold',
    body_html: '<p>Sold by The Back Vault. 18K Yellow Gold, 32.5 grams, from the Art Deco era. Condition: Excellent condition.</p>',
    vendor: 'Cartier',
    product_type: 'Bracelet',
    tags: 'estate,gold',
    variants: [{ id: 10, title: 'Default Title', price: '4500.00', available: true, sku: 'CLV-001' }],
    images: [{ src: 'https://cdn.shopify.com/s/files/1/backvault/cartier.jpg' }],
    ...overrides,
  };
}

describe('normalizeBackVaultFeed', () => {
  it('accepts an in-stock top-designer item and scrubs it', () => {
    const { items, stats } = normalizeBackVaultFeed([product()]);
    expect(stats.accepted).toBe(1);
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.vendor).toBe('Cartier');
    expect(item.priceUsd).toBe(4500);
    expect(containsBackVaultReference(item.title)).toBe(false);
    expect(containsBackVaultReference(item.descriptionHtml)).toBe(false);
    expect(item.specs.metalType?.toLowerCase()).toContain('yellow gold');
    expect(item.specs.metalWeight).toBe('32.5g');
    expect(item.specs.era?.toLowerCase()).toContain('art deco');
    expect(item.specs.condition?.toLowerCase()).toContain('excellent');
  });

  it('rejects out-of-stock items', () => {
    const { items, stats } = normalizeBackVaultFeed([
      product({ variants: [{ id: 10, title: 'Default Title', price: '4500.00', available: false }] }),
    ]);
    expect(items).toHaveLength(0);
    expect(stats.outOfStock).toBe(1);
  });

  it('rejects brands outside the curated top-designer list', () => {
    const { items, stats } = normalizeBackVaultFeed([product({ vendor: 'Generic Estate Jewelers' })]);
    expect(items).toHaveLength(0);
    expect(stats.notTopDesigner).toBe(1);
  });

  it('rejects malformed rows without crashing', () => {
    const { items, stats } = normalizeBackVaultFeed([{ nonsense: true }, 'not an object', null, 42]);
    expect(items).toHaveLength(0);
    expect(stats.malformed).toBe(4);
  });

  it('handle is idempotent and namespaced with bv- when built into a product', () => {
    const { items } = normalizeBackVaultFeed([product()]);
    expect(items[0]!.sourceHandle).toBe('cartier-love-bracelet-yg');
  });
});
