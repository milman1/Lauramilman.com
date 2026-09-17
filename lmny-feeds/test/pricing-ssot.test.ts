import { describe, expect, it } from 'vitest';
import {
  LAB_GROWN_JEWELRY,
  LOOSE_LAB_GROWN,
  labGrownJewelryRetailFromCost,
  labRetailMultipleFromCost,
  STONE_TIERS,
  WATCH,
  WATCH_COST_TIERS,
} from '../config/pricing.js';

describe('pricing SSOT — API + lab jewelry', () => {
  it('keeps 1.40× through $4,000 Amount and 1.25× above', () => {
    expect(STONE_TIERS.map((t) => t.multiplier)).toEqual([1.4, 1.25]);
    expect(STONE_TIERS[0]?.maxCostUsd).toBe(4000);
  });

  it('prices cheap loose labs at 2.50× and the rest at 1.50×', () => {
    expect(LOOSE_LAB_GROWN.smallCostMaxUsd).toBe(500);
    expect(LOOSE_LAB_GROWN.smallCostMultiple).toBe(2.5);
    expect(LOOSE_LAB_GROWN.costMultiple).toBe(1.5);
    expect(labRetailMultipleFromCost(182)).toBe(2.5);
    expect(labRetailMultipleFromCost(500)).toBe(2.5);
    expect(labRetailMultipleFromCost(501)).toBe(1.5);
    expect(LOOSE_LAB_GROWN.welcomeDiscountPct).toBe(0.1);
    expect(LOOSE_LAB_GROWN.costMultiple * (1 - LOOSE_LAB_GROWN.welcomeDiscountPct)).toBeCloseTo(1.35);
    expect(LOOSE_LAB_GROWN.smallCostMultiple * (1 - LOOSE_LAB_GROWN.welcomeDiscountPct)).toBeCloseTo(2.25);
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
