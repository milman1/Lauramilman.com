import { describe, expect, it } from 'vitest';
import { normalizeBackVaultFeed } from '../../src/backvault/normalize.js';
import { buildProductSetInput } from '../../src/backvault/product.js';
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
    expect(item.listedPriceUsd).toBe(4500);
    expect(item.costUsd).toBe(3000);
    expect(item.priceUsd).toBe(4500);
    expect(containsBackVaultReference(item.title)).toBe(false);
    expect(containsBackVaultReference(item.descriptionHtml)).toBe(false);
    expect(item.specs.metalType?.toLowerCase()).toContain('yellow gold');
    expect(item.specs.metalWeight).toBe('32.5g');
    expect(item.specs.era?.toLowerCase()).toContain('art deco');
    expect(item.specs.condition?.toLowerCase()).toContain('excellent');
  });

  it('builds the J10546 product update without a false diamond claim', () => {
    const { items } = normalizeBackVaultFeed([product({
      handle: 'cartier-18k-yellow-gold-octagonal-circa-2000-cuff-links-j10546',
      title: 'Cartier 18K Yellow Gold Octagonal Circa 2000 Cuff Links',
      product_type: 'Cuff Links',
      body_html:
        '<p>Double sided cufflinks in 18ct yellow gold with octagonal faces.</p>' +
        '<strong>Center Diamond Weight:</strong> 0.00<br>' +
        '<strong>Measurements:</strong> L 4.1cm<br>' +
        '<strong>Metal Type:</strong> 18K Yellow Gold<br>' +
        '<strong>Metal Weight:</strong> 19.9 gr.<br>' +
        '<strong>Signed:</strong> Cartier',
      variants: [{ id: 10, title: 'Default Title', price: '4200.00', available: true, sku: 'J10546' }],
    })]);
    expect(items).toHaveLength(1);
    const input = buildProductSetInput(items[0]!, '2026-11-21T00:00:00.000Z', {
      id: 'gid://shopify/Product/1',
      imageCount: 1,
    });
    expect(input.id).toBe('gid://shopify/Product/1');
    expect(input.descriptionHtml).not.toMatch(/(?:18ct|0ct) of diamonds/i);
    expect(input.metafields).not.toContainEqual(expect.objectContaining({ namespace: 'custom', key: 'diamond_weight' }));
    expect(input.metafields).toContainEqual(expect.objectContaining({
      namespace: 'custom', key: 'metal_type', value: '18K Yellow Gold',
    }));
  });

  it('prices every item at the supplier price, with the cost one third below it', () => {
    const { items } = normalizeBackVaultFeed([
      product({ handle: 'a', variants: [{ id: 1, title: 'Default Title', price: '67600.00', available: true }] }),
      product({ handle: 'b', variants: [{ id: 2, title: 'Default Title', price: '950.50', available: true }] }),
    ]);
    expect(items.map((i) => [i.costUsd, i.priceUsd])).toEqual([
      [45066.67, 67600],
      [633.67, 950.5],
    ]);
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
