import { describe, expect, it } from 'vitest';
import { WATCH_RETAIL_CAP_BY_STOCK, WATCH_SALE } from '../config/pricing.js';
import {
  ebayWatchFeeUsd,
  minRetailLeavingMargin,
  priceWatchFromCost,
  retailFromCost,
  roundUpTo100,
  watchNetAfterSaleUsd,
  watchShippingUsd,
} from '../src/watchPricing.js';

function netsAtLeast(price: number, cost: number, margin: number): boolean {
  return watchNetAfterSaleUsd(price, cost) + 1e-6 >= margin * price;
}

describe('roundUpTo100', () => {
  it('rounds up to the next hundred', () => {
    expect(roundUpTo100(6401)).toBe(6500);
    expect(roundUpTo100(6500)).toBe(6500);
    expect(roundUpTo100(0.01)).toBe(100);
  });
});

describe('ebay watch fee and shipping', () => {
  it('charges the eBay watch fee in slices', () => {
    // 15% of 500 + $0.40.
    expect(ebayWatchFeeUsd(500)).toBeCloseTo(75.4, 5);
    // 15% of 1,000 + 6.5% of 6,500 + 3% of 2,500 + $0.40.
    expect(ebayWatchFeeUsd(10_000)).toBeCloseTo(647.9, 5);
  });

  it('charges a flat postage amount plus 1% insurance', () => {
    expect(watchShippingUsd(9_000)).toBe(210);
    expect(WATCH_SALE.shippingFlatUsd).toBe(120);
    expect(WATCH_SALE.shippingInsuranceRate).toBe(0.01);
  });
});

describe('retailFromCost', () => {
  it('leaves 5% on a lower-cost watch', () => {
    expect(retailFromCost(8_000)).toBe(9_400);
    expect(retailFromCost(7_500)).toBe(8_800);
    expect(retailFromCost(5_000)).toBe(6_000);
    expect(retailFromCost(4_123)).toBe(5_000);
    for (const cost of [4_123, 5_000, 7_500, 8_000]) {
      const price = retailFromCost(cost);
      expect(netsAtLeast(price, cost, 0.05)).toBe(true);
      expect(netsAtLeast(price - 100, cost, 0.05)).toBe(false);
    }
  });

  it('leaves $500 on a $10,000 price', () => {
    expect(retailFromCost(8_600)).toBe(10_000);
    expect(watchNetAfterSaleUsd(10_000, 8_600)).toBeGreaterThanOrEqual(500);
    expect(watchNetAfterSaleUsd(9_900, 8_600)).toBeLessThan(0.05 * 9_900);
  });

  it('leaves 5% once the price is above $10,000', () => {
    expect(retailFromCost(9_000)).toBe(10_500);
    expect(retailFromCost(15_000)).toBe(17_000);
    expect(retailFromCost(40_000)).toBe(44_500);
    expect(retailFromCost(42_000)).toBe(46_700);
    expect(retailFromCost(50_000)).toBe(55_500);
    for (const cost of [9_000, 15_000, 40_000, 42_000, 50_000]) {
      const price = retailFromCost(cost);
      expect(price).toBeGreaterThan(10_000);
      expect(netsAtLeast(price, cost, 0.05)).toBe(true);
      expect(netsAtLeast(price - 100, cost, 0.05)).toBe(false);
    }
  });

  it('is monotonic and never nets under the rule', () => {
    let prev = 0;
    for (let cost = 100; cost <= 80_000; cost += 100) {
      const price = retailFromCost(cost);
      expect(price, `cost ${cost}`).toBeGreaterThanOrEqual(prev);
      expect(netsAtLeast(price, cost, WATCH_SALE.minNetMarginOfPrice), `cost ${cost}`).toBe(true);
      expect(watchNetAfterSaleUsd(price, cost), `cost ${cost}`).toBeGreaterThanOrEqual(-1e-6);
      prev = price;
    }
  });
});

describe('priceWatchFromCost', () => {
  it('excludes aftermarket', () => {
    expect(priceWatchFromCost({ costUsd: 10_000, aftermarket: true })).toEqual({
      status: 'excluded',
      reason: 'aftermarket',
    });
  });

  it('returns no_cost when supplier cost is missing', () => {
    expect(priceWatchFromCost({}).status).toBe('no_cost');
    expect(priceWatchFromCost({ costUsd: 0 }).status).toBe('no_cost');
    expect(priceWatchFromCost({ costUsd: null }).status).toBe('no_cost');
  });

  it('prices from cost alone', () => {
    expect(priceWatchFromCost({ costUsd: 9_000 })).toEqual({ status: 'priced', retailUsd: 10_500 });
  });

  it('never nets under cost after the eBay fee and free shipping', () => {
    for (let cost = 100; cost <= 80_000; cost += 100) {
      const retail = priceWatchFromCost({ costUsd: cost });
      expect(retail.status).toBe('priced');
      if (retail.status !== 'priced') continue;
      expect(watchNetAfterSaleUsd(retail.retailUsd, cost), `cost ${cost}`).toBeGreaterThanOrEqual(-1e-6);
      expect(retail.retailUsd).toBeGreaterThanOrEqual(minRetailLeavingMargin(cost, 0));
    }
  });

  it('drops a ceiling that would net under cost after shipping', () => {
    // Ceiling $10,600 on a $10,000 cost is under the break-even price.
    expect(priceWatchFromCost({ costUsd: 10_000, stockRef: 'T3489' })).toEqual({
      status: 'priced',
      retailUsd: 11_600,
    });
  });

  it('caps a listed stock number without raising the standard price', () => {
    // $24,000 cost prices at $26,900 before the $26,400 ceiling.
    expect(priceWatchFromCost({ costUsd: 24_000, stockRef: 'T3590' })).toEqual({
      status: 'priced',
      retailUsd: 26_400,
    });
    // $20,000 prices at $22,500, under the ceiling.
    expect(priceWatchFromCost({ costUsd: 20_000, stockRef: 'T3590' })).toEqual({
      status: 'priced',
      retailUsd: 22_500,
    });
  });

  it('ignores a ceiling that is below the break-even price', () => {
    // $27,000 prices at $30,200. The $26,400 ceiling does not clear shipping.
    expect(priceWatchFromCost({ costUsd: 27_000, stockRef: 'T3590' })).toEqual({
      status: 'priced',
      retailUsd: 30_200,
    });
  });

  it('keeps the market ceilings that can still clear cost after shipping', () => {
    expect(WATCH_RETAIL_CAP_BY_STOCK).toEqual({
      T3489: 10_600,
      T3559: 14_900,
      T3652: 15_800,
      T3690: 15_900,
      RW3084: 16_500,
      RW3103: 16_500,
      T3590: 26_400,
      RW3100: 49_000,
    });
    expect(WATCH_RETAIL_CAP_BY_STOCK.RW3087).toBeUndefined();
    expect(WATCH_RETAIL_CAP_BY_STOCK.T3691).toBeUndefined();
  });

  /**
   * Shape of the Audemars Piguet failure under the old mid×0.97 rule:
   * market mid below cost → published retail under cost. The sale rule
   * always clears cost after the eBay fee and shipping, and never consults Hours.
   */
  it('does not publish under cost (old AP mid×0.97 shape)', () => {
    const costUsd = 42_000;
    const r = priceWatchFromCost({ costUsd });
    expect(r.status).toBe('priced');
    if (r.status === 'priced') {
      expect(r.retailUsd).toBe(46_700);
      expect(watchNetAfterSaleUsd(r.retailUsd, costUsd)).toBeGreaterThan(0);
    }
  });
});
