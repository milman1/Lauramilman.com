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
  it('prices a full-set at blended anchor × 0.97 when above the cost floor', () => {
    // low 10000, mid 12000 → anchor 10900; full-set haircut 1; ×0.97 = 10573
    const r = priceWatch(
      watch({ costUsd: 9000, box: true, papers: true, isNaked: false }),
      { midUsd: 12000, lowUsd: 10000, sourceCount: 12, asOf: '2026-07-20' },
    );
    expect(r.ok && r.priced.retailUsd).toBe(10573);
    expect(r.ok && r.priced.compMidUsd).toBe(12000);
  });

  it('applies the naked haircut (−10%) on incomplete sets', () => {
    // anchor 10900 × 0.90 × 0.97 = 9516
    const r = priceWatch(
      watch({ costUsd: 8000, box: false, papers: false, isNaked: true }),
      { midUsd: 12000, lowUsd: 10000, sourceCount: 12 },
    );
    expect(r.ok && r.priced.retailUsd).toBe(9516);
  });

  it('applies the partial haircut (−5%) for box-or-papers-only', () => {
    // anchor 10900 × 0.95 × 0.97 = 10044
    const r = priceWatch(
      watch({ costUsd: 8000, box: true, papers: false, isNaked: false }),
      { midUsd: 12000, lowUsd: 10000, sourceCount: 12 },
    );
    expect(r.ok && r.priced.retailUsd).toBe(10044);
  });

  it('falls back to mid when low is missing', () => {
    // mid 12000 × 0.97 = 11640 (full set)
    const r = priceWatch(
      watch({ costUsd: 9000, box: true, papers: true, isNaked: false }),
      { midUsd: 12000, sourceCount: 12 },
    );
    expect(r.ok && r.priced.retailUsd).toBe(11640);
  });

  it('holds with no market comp (provider 404)', () => {
    const r = priceWatch(watch(), null);
    expect(!r.ok && r.hold.reason).toBe('watch_no_market_comp');
  });

  it('holds when sourceCount is below the gate', () => {
    const r = priceWatch(
      watch({ costUsd: 9000, box: true, papers: true, isNaked: false }),
      { midUsd: 12000, lowUsd: 10000, sourceCount: 2 },
    );
    expect(!r.ok && r.hold.reason).toBe('watch_weak_comp');
  });

  it('holds when the feed price is already at market', () => {
    // anchor 10900 × 0.97 = 10573 < cost×1.05 = 11550 → hold
    const r = priceWatch(
      watch({ costUsd: 11000, box: true, papers: true, isNaked: false }),
      { midUsd: 12000, lowUsd: 10000, sourceCount: 12 },
    );
    expect(!r.ok && r.hold.reason).toBe('watch_feed_price_at_market');
  });
});
