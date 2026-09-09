import { describe, expect, it } from 'vitest';
import { competitorPriceFor, indexCompetitor, stockRefFor, stockRefsIn } from '../../src/backvault/competitor.js';
import { normalizeBackVaultFeed } from '../../src/backvault/normalize.js';
import { backVaultRetail } from '../../src/backvault/pricing.js';

function row(overrides: Record<string, unknown> = {}) {
  return {
    handle: 'cartier-dolphin-ring-estate',
    title: 'Cartier Dolphin 18K Yellow Gold Double Dolphin Diamond Ring',
    body_html: '<p>Estate piece. Style J10605.</p>',
    variants: [{ sku: '001-440-113610', price: '72000.00', available: true }],
    images: [{ src: 'https://cdn.shopify.com/s/files/1/0601/7105/9379/files/J10605_a1b2.jpg?v=1' }],
    ...overrides,
  };
}

describe('stockRefsIn', () => {
  it('finds the supplier stock number in body copy and image file names', () => {
    expect([...stockRefsIn(row())]).toEqual(['J10605']);
  });

  it('finds it in a title or the retailer SKU and ignores unrelated tokens', () => {
    const refs = stockRefsIn(row({ body_html: '', images: [], title: 'Cartier Ring RR9688 18K', variants: [{ sku: 'RR9688', price: '10.00', available: true }] }));
    expect([...refs]).toEqual(['RR9688']);
    expect(stockRefsIn(row({ body_html: '', images: [], title: '18K gold 750 hallmark' })).size).toBe(0);
  });
});

describe('indexCompetitor', () => {
  it('maps a stock number to the lowest available price', () => {
    const index = indexCompetitor([row({ variants: [{ price: '72000.00', available: true }, { price: '70000.00', available: true }, { price: '1.00', available: false }] })]);
    expect(index.get('J10605')).toBe(70000);
  });

  it('drops a stock number that appears on two rows at different prices', () => {
    const index = indexCompetitor([row(), row({ handle: 'other', variants: [{ price: '65000.00', available: true }] })]);
    expect(index.has('J10605')).toBe(false);
  });

  it('skips rows with no available variant', () => {
    expect(indexCompetitor([row({ variants: [{ price: '72000.00', available: false }] })]).size).toBe(0);
  });
});

describe('stockRefFor / competitorPriceFor', () => {
  it('uses the SKU, then the handle tail', () => {
    expect(stockRefFor({ sku: 'j10605', sourceHandle: 'x' })).toBe('J10605');
    expect(stockRefFor({ sourceHandle: 'cartier-dolphin-ring-j10605' })).toBe('J10605');
    expect(stockRefFor({ sourceHandle: 'cartier-dolphin-ring' })).toBeNull();
  });

  it('returns the competitor price only on an exact stock-number match', () => {
    const index = indexCompetitor([row()]);
    expect(competitorPriceFor({ sku: 'J10605', sourceHandle: 'x' }, index)).toBe(72000);
    expect(competitorPriceFor({ sku: 'J10606', sourceHandle: 'x' }, index)).toBeNull();
  });
});

describe('backVaultRetail', () => {
  it('is the midpoint between cost and the competitor when matched', () => {
    expect(backVaultRetail(67600, 72000)).toBe(69800);
  });

  it('never drops below cost + markup when the competitor prices low', () => {
    expect(backVaultRetail(67600, 67700)).toBe(68100);
    expect(backVaultRetail(67600, 0)).toBe(68100);
  });

  it('is cost + markup without a match', () => {
    expect(backVaultRetail(67600)).toBe(68100);
    expect(backVaultRetail(67600, null)).toBe(68100);
  });
});

describe('normalizeBackVaultFeed with a competitor index', () => {
  const supplierRow = {
    id: 1,
    handle: 'cartier-dolphin-ring-j10605',
    title: 'Cartier Dolphin Ring',
    body_html: '<p>18K Yellow Gold.</p>',
    vendor: 'Cartier',
    product_type: 'Ring',
    tags: '',
    variants: [{ id: 10, title: 'Default Title', price: '67600.00', available: true, sku: 'J10605' }],
    images: [{ src: 'https://cdn.example.com/J10605.jpg' }],
  };

  it('prices matched pieces at the midpoint and records the competitor price', () => {
    const { items, stats } = normalizeBackVaultFeed([supplierRow], indexCompetitor([row()]));
    expect(items[0]!.costUsd).toBe(67600);
    expect(items[0]!.competitorPriceUsd).toBe(72000);
    expect(items[0]!.priceUsd).toBe(69800);
    expect(stats.competitorMatched).toBe(1);
  });

  it('falls back to the flat markup without an index or a match', () => {
    const { items, stats } = normalizeBackVaultFeed([supplierRow]);
    expect(items[0]!.priceUsd).toBe(68100);
    expect(items[0]!.competitorPriceUsd).toBeUndefined();
    expect(stats.competitorMatched).toBe(0);
  });
});
