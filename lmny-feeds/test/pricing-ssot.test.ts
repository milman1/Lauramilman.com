import { describe, expect, it } from 'vitest';
import {
  FANCY_COLOR_JEWELRY,
  LAB_GROWN_JEWELRY,
  LOOSE_LAB_GROWN,
  fancyColorJewelryRetailFromCost,
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

  it('prices every loose lab at 3×', () => {
    expect(LOOSE_LAB_GROWN.costMultiple).toBe(3);
    expect(labRetailMultipleFromCost(182)).toBe(3);
    expect(labRetailMultipleFromCost(500)).toBe(3);
    expect(labRetailMultipleFromCost(501)).toBe(3);
    expect(labRetailMultipleFromCost(1662.12)).toBe(3);
    expect(LOOSE_LAB_GROWN.welcomeDiscountPct).toBe(0.1);
    expect(LOOSE_LAB_GROWN.costMultiple * (1 - LOOSE_LAB_GROWN.welcomeDiscountPct)).toBeCloseTo(2.7);
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

  it('prices fancy-color jewelry at a 35% margin, nearest $10', () => {
    expect(FANCY_COLOR_JEWELRY.grossMarginPct).toBe(0.35);
    expect(FANCY_COLOR_JEWELRY.roundToUsd).toBe(10);
    expect(fancyColorJewelryRetailFromCost(650)).toBe(1000);
    expect(fancyColorJewelryRetailFromCost(1000)).toBe(1540);
    expect(fancyColorJewelryRetailFromCost(325)).toBe(500);
    const retail = fancyColorJewelryRetailFromCost(1000);
    expect((retail - 1000) / retail).toBeCloseTo(0.35, 2);
  });

  it('rejects non-positive fancy-color jewelry cost', () => {
    expect(() => fancyColorJewelryRetailFromCost(0)).toThrow(/invalid cost/);
    expect(() => fancyColorJewelryRetailFromCost(-10)).toThrow(/invalid cost/);
  });
});
