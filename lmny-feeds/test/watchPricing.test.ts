import { describe, expect, it } from 'vitest';
import {
  priceWatchFromCost,
  retailFromCost,
  roundUpTo100,
  tierFloorUsd,
} from '../src/watchPricing.js';

describe('roundUpTo100', () => {
  it('rounds up to the next hundred', () => {
    expect(roundUpTo100(6401)).toBe(6500);
    expect(roundUpTo100(6500)).toBe(6500);
    expect(roundUpTo100(0.01)).toBe(100);
  });
});

describe('tier floors (boundary inversion fix)', () => {
  it('floors the $5k tier at ceil($5k × 1.30)', () => {
    expect(tierFloorUsd(1)).toBe(6_500);
  });
  it('floors the $15k tier at ceil($15k × 1.20)', () => {
    expect(tierFloorUsd(2)).toBe(18_000);
  });
  it('floors the $40k tier at ceil($40k × 1.12)', () => {
    expect(tierFloorUsd(3)).toBe(44_800);
  });
});

describe('retailFromCost', () => {
  it('applies 1.30× under $5k and rounds up to $100', () => {
    expect(retailFromCost(4_000)).toBe(5_200); // 5200 exact
    expect(retailFromCost(4_123)).toBe(5_400); // 5360 → 5400
  });

  it('never drops across the $5k boundary', () => {
    const below = retailFromCost(4_999);
    const at = retailFromCost(5_000);
    expect(below).toBe(6_500); // 6498.7 → 6500
    expect(at).toBe(6_500); // raw 6000 floored to 6500
    expect(at).toBeGreaterThanOrEqual(below);
  });

  it('never drops across the $15k boundary', () => {
    expect(retailFromCost(14_999)).toBe(18_000);
    expect(retailFromCost(15_000)).toBe(18_000); // raw 16800 floored
  });

  it('never drops across the $40k boundary', () => {
    expect(retailFromCost(39_999)).toBe(44_800);
    expect(retailFromCost(40_000)).toBe(44_800); // raw 43200 floored
  });

  it('uses 1.08× above $40k once past the floor', () => {
    // 50_000 × 1.08 = 54_000
    expect(retailFromCost(50_000)).toBe(54_000);
  });

  it('is monotonic across a dense cost sweep', () => {
    let prev = 0;
    for (let cost = 100; cost <= 80_000; cost += 100) {
      const retail = retailFromCost(cost);
      expect(retail, `cost ${cost}`).toBeGreaterThanOrEqual(prev);
      prev = retail;
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

  it('prices from cost alone — comps do not move retail', () => {
    const a = priceWatchFromCost({ costUsd: 9_000 });
    // mid high enough that the 40% review gate does not fire
    const b = priceWatchFromCost({ costUsd: 9_000, compMidUsd: 15_000 });
    expect(a).toEqual({ status: 'priced', retailUsd: 10_800 });
    expect(b).toEqual({ status: 'priced', retailUsd: 10_800 });
  });

  it('holds needs_review when retail is more than 40% under mid', () => {
    // cost 3_000 → 3_900; mid 10_000 → 60% = 6_000; 3900 < 6000
    const r = priceWatchFromCost({ costUsd: 3_000, compMidUsd: 10_000 });
    expect(r.status).toBe('needs_review');
    if (r.status === 'needs_review') {
      expect(r.retailUsd).toBe(3_900);
      expect(r.compMidUsd).toBe(10_000);
    }
  });

  it('publishes when retail is at or above 60% of mid', () => {
    // cost 8_000 → 9_600; mid 10_000 → 60% = 6_000; 9600 >= 6000
    const r = priceWatchFromCost({ costUsd: 8_000, compMidUsd: 10_000 });
    expect(r).toEqual({ status: 'priced', retailUsd: 9_600 });
  });

  it('does not hold when there is no mid (missing comps are fine)', () => {
    const r = priceWatchFromCost({ costUsd: 3_000 });
    expect(r).toEqual({ status: 'priced', retailUsd: 3_900 });
  });

  /**
   * Shape of the Audemars Piguet failure under the old mid×0.97 rule:
   * market mid below cost → published retail under cost. Cost-tier markup
   * always clears cost, and a mid that low trips needs_review instead of
   * going live under water.
   */
  it('does not publish under cost when mid sits below cost (AP shape)', () => {
    const costUsd = 42_000;
    const compMidUsd = 38_000; // old: 38000×0.97 = 36860 < cost
    const r = priceWatchFromCost({ costUsd, compMidUsd });
    // 42000 × 1.08 = 45360 → 45400, floored at 44800 → 45400
    // 45400 vs 60% of 38000 = 22800 → priced cleanly above cost
    expect(r.status).toBe('priced');
    if (r.status === 'priced') {
      expect(r.retailUsd).toBeGreaterThanOrEqual(costUsd);
      expect(r.retailUsd).toBe(45_400);
    }
  });

  it('holds when a low mid makes cost look suspect (deep under mid)', () => {
    // cost 5_000 → floored 6_500; mid 20_000 → 60% = 12_000; 6500 < 12000
    const r = priceWatchFromCost({ costUsd: 5_000, compMidUsd: 20_000 });
    expect(r.status).toBe('needs_review');
  });
});
