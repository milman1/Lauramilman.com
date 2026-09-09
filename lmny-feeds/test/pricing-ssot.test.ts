import { describe, expect, it } from 'vitest';
import {
  LAB_GROWN_JEWELRY,
  labGrownJewelryRetailFromCost,
  STONE_TIERS,
  WATCH,
  WATCH_COST_TIERS,
} from '../config/pricing.js';

describe('pricing SSOT — API + lab jewelry', () => {
  it('keeps the live Amount chart for loose natural and lab diamonds', () => {
    expect(STONE_TIERS.map((t) => t.multiplier)).toEqual([1.4, 1.35, 1.3, 1.25]);
  });

  it('exposes Belgium Dia watch cost tiers on pricing.ts', () => {
    expect(WATCH.costTiers).toBe(WATCH_COST_TIERS);
    expect(WATCH_COST_TIERS.map((t) => t.multiplier)).toEqual([1.3, 1.2, 1.12, 1.08]);
    expect(WATCH.reviewTag).toBe('pricing-review');
  });

  it('prices lab-grown jewelry at cost × 4', () => {
    expect(LAB_GROWN_JEWELRY.costMultiple).toBe(4);
    expect(LAB_GROWN_JEWELRY.vendors).toContain('Peaceful Diamonds');
    expect(LAB_GROWN_JEWELRY.skuPrefixes).toEqual(['BC14', 'NK14']);
    expect(labGrownJewelryRetailFromCost(250)).toBe(1000);
    expect(labGrownJewelryRetailFromCost(333.33)).toBe(1333);
  });

  it('rejects non-positive lab jewelry cost', () => {
    expect(() => labGrownJewelryRetailFromCost(0)).toThrow(/invalid cost/);
    expect(() => labGrownJewelryRetailFromCost(-10)).toThrow(/invalid cost/);
  });
});
