import { describe, expect, it } from 'vitest';
import {
  priceWatchFromCost,
  retailFromCost,
  roundUpTo100,
  tierForCost,
  tierFloorUsd,
} from '../src/watchPricing.js';

describe('roundUpTo100', () => {
  it('rounds up to the next hundred', () => {
    expect(roundUpTo100(6401)).toBe(6500);
    expect(roundUpTo100(6500)).toBe(6500);
    expect(roundUpTo100(0.01)).toBe(100);
  });
});

describe('chart bands', () => {
  it('uses 1.30× under $5,000', () => {
    expect(tierForCost(4_999).multiplier).toBe(1.3);
  });
  it('uses 1.20× from $5,000 through $15,000 inclusive', () => {
    expect(tierForCost(5_000).multiplier).toBe(1.2);
    expect(tierForCost(15_000).multiplier).toBe(1.2);
  });
  it('uses 1.12× from $15,001 through $40,000 inclusive', () => {
    expect(tierForCost(15_001).multiplier).toBe(1.12);
    expect(tierForCost(40_000).multiplier).toBe(1.12);
  });
  it('uses 1.08× above $40,000', () => {
    expect(tierForCost(40_001).multiplier).toBe(1.08);
  });
});

describe('tier floors (chart mins)', () => {
  it('has no floor under $5k', () => {
    expect(tierFloorUsd(0)).toBe(0);
  });
  it('floors the $5k–$15k band at $6,500', () => {
    expect(tierFloorUsd(1)).toBe(6_500);
  });
  it('floors the $15,001–$40k band at $18,000', () => {
    expect(tierFloorUsd(2)).toBe(18_000);
  });
  it('floors the above-$40k band at $44,800', () => {
    expect(tierFloorUsd(3)).toBe(44_800);
  });
});

describe('retailFromCost', () => {
  it('applies 1.30× under $5k and rounds up to $100', () => {
    expect(retailFromCost(4_000)).toBe(5_200);
    expect(retailFromCost(4_123)).toBe(5_400); // 5359.9 → 5400
  });

  it('never drops across the $5k boundary', () => {
    const below = retailFromCost(4_999);
    const at = retailFromCost(5_000);
    expect(below).toBe(6_500); // 6498.7 → 6500
    expect(at).toBe(6_500); // 5000 × 1.20 = 6000, min 6500
    expect(at).toBeGreaterThanOrEqual(below);
  });

  it('keeps $15,000 in the 1.20× band', () => {
    expect(retailFromCost(14_999)).toBe(18_000);
    expect(retailFromCost(15_000)).toBe(18_000); // 15000 × 1.20
    expect(retailFromCost(15_001)).toBe(18_000); // 15001 × 1.12 = 16801 → 16900, min 18000
  });

  it('keeps $40,000 in the 1.12× band', () => {
    expect(retailFromCost(39_999)).toBe(44_800);
    expect(retailFromCost(40_000)).toBe(44_800); // 40000 × 1.12
    expect(retailFromCost(40_001)).toBe(44_800); // 40001 × 1.08 = 43201 → 43300, min 44800
  });

  it('uses 1.08× above $40k once past the floor', () => {
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

  it('prices from cost alone', () => {
    expect(priceWatchFromCost({ costUsd: 9_000 })).toEqual({ status: 'priced', retailUsd: 10_800 });
  });

  /**
   * Shape of the Audemars Piguet failure under the old mid×0.97 rule:
   * market mid below cost → published retail under cost. Cost-tier markup
   * always clears cost and never consults Hours.
   */
  it('does not publish under cost (old AP mid×0.97 shape)', () => {
    const costUsd = 42_000;
    const r = priceWatchFromCost({ costUsd });
    // 42000 × 1.08 = 45360 → 45400, floored at 44800 → 45400
    expect(r.status).toBe('priced');
    if (r.status === 'priced') {
      expect(r.retailUsd).toBeGreaterThanOrEqual(costUsd);
      expect(r.retailUsd).toBe(45_400);
    }
  });
});
