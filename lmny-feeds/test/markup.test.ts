import { describe, expect, it } from 'vitest';
import { FALLBACK_RULES, priceLab, priceNatural, priceWatch } from '../src/markup.js';
import { labStone, naturalStone, watch } from './fixtures.js';

describe('natural pricing', () => {
  it('prices at Rap × 0.75', () => {
    const r = priceNatural(naturalStone({ rapPriceUsd: 20000, costUsd: 10000 }));
    expect(r.ok && r.priced.retailUsd).toBe(15000);
  });

  it('holds when there is no Rap price', () => {
    const r = priceNatural(naturalStone({ rapPriceUsd: undefined }));
    expect(!r.ok && r.hold.reason).toBe('natural_no_rap_price');
  });

  it('holds below the 20% margin floor', () => {
    // retail 15000, cost 12500 → margin 16.7% < 20%
    const r = priceNatural(naturalStone({ rapPriceUsd: 20000, costUsd: 12500 }));
    expect(!r.ok && r.hold.reason).toBe('natural_margin_floor');
  });

  it('publishes at exactly the floor', () => {
    // retail 15000, cost 12000 → margin 20.0%
    const r = priceNatural(naturalStone({ rapPriceUsd: 20000, costUsd: 12000 }));
    expect(r.ok).toBe(true);
  });
});

describe('lab pricing', () => {
  it('selects the tier by carat', () => {
    const small = priceLab(labStone({ carat: 0.4, costUsd: 1000 }));
    const mid = priceLab(labStone({ carat: 1.5, costUsd: 1000 }));
    const big = priceLab(labStone({ carat: 4.5, costUsd: 1000 }));
    expect(small.ok && small.priced.retailUsd).toBe(1700);
    expect(mid.ok && mid.priced.retailUsd).toBe(1550);
    expect(big.ok && big.priced.retailUsd).toBe(1450);
  });

  it('boundary carats fall in the lower tier (≤ maxCarat)', () => {
    const atHalf = priceLab(labStone({ carat: 0.5, costUsd: 1000 }));
    expect(atHalf.ok && atHalf.priced.retailUsd).toBe(1700);
  });

  it('has a tier for any carat (last tier is unbounded)', () => {
    expect(FALLBACK_RULES.at(-1)?.maxCarat).toBe(Number.POSITIVE_INFINITY);
    const r = priceLab(labStone({ carat: 25 }));
    expect(r.ok).toBe(true);
  });
});

describe('watch pricing', () => {
  it('prices at comp × 0.97 when above the cost floor', () => {
    const r = priceWatch(watch({ costUsd: 9000 }), { midUsd: 12000, asOf: '2026-07-20' });
    expect(r.ok && r.priced.retailUsd).toBe(11640);
    expect(r.ok && r.priced.compMidUsd).toBe(12000);
  });

  it('holds with no market comp (provider 404)', () => {
    const r = priceWatch(watch(), null);
    expect(!r.ok && r.hold.reason).toBe('watch_no_market_comp');
  });

  it('holds when the feed price is already at market', () => {
    // comp×0.97 = 9700 < cost×1.05 = 9975 → grey-market priced, hold
    const r = priceWatch(watch({ costUsd: 9500 }), { midUsd: 10000 });
    expect(!r.ok && r.hold.reason).toBe('watch_feed_price_at_market');
  });
});
