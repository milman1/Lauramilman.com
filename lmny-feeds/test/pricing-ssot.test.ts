import { describe, expect, it } from 'vitest';
import {
  LAB_GROWN_JEWELRY,
  LOOSE_LAB_GROWN,
  labGrownJewelryRetailFromCost,
  labRetailMultipleFromCost,
  NATURAL_STONE,
  naturalRetailFromCost,
  STONE_TIERS,
  WATCH,
  WATCH_RETAIL_CAP_BY_STOCK,
  WATCH_SALE,
} from '../config/pricing.js';

describe('pricing SSOT — API + lab jewelry', () => {
  it('prices every natural stone at a 30% gross margin', () => {
    expect(NATURAL_STONE.marginPct).toBe(0.3);
    expect(STONE_TIERS).toHaveLength(1);
    expect(STONE_TIERS[0]?.maxCostUsd).toBe(Number.POSITIVE_INFINITY);
    expect(naturalRetailFromCost(400)).toBe(571);
    expect(naturalRetailFromCost(4_080)).toBe(5829);
    expect(naturalRetailFromCost(106_463)).toBe(152_090);
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

  it('exposes the Belgium Dia watch sale rule on pricing.ts', () => {
    expect(WATCH.sale).toBe(WATCH_SALE);
    expect(WATCH.retailCapByStock).toBe(WATCH_RETAIL_CAP_BY_STOCK);
    expect(WATCH.sale.minNetMarginOfPrice).toBe(0.05);
    expect(WATCH.sale.higherMinNetMarginOfPrice).toBe(0.1);
    expect(WATCH.sale.higherMarginMaxPriceUsd).toBe(10_000);
    expect(WATCH.sale.shippingFlatUsd).toBe(120);
    expect(WATCH.sale.shippingInsuranceRate).toBe(0.01);
    expect(WATCH.reviewTag).toBe('pricing-review');
  });

  it('prices lab-grown jewelry at cost × 2', () => {
    expect(LAB_GROWN_JEWELRY.costMultiple).toBe(2);
    expect(LAB_GROWN_JEWELRY.vendors).toContain('Peaceful Diamonds');
    expect(LAB_GROWN_JEWELRY.skuPrefixes).toEqual(['BC14', 'NK14']);
    expect(labGrownJewelryRetailFromCost(250)).toBe(500);
    expect(labGrownJewelryRetailFromCost(333.33)).toBe(666.66);
  });

  it('rejects non-positive lab jewelry cost', () => {
    expect(() => labGrownJewelryRetailFromCost(0)).toThrow(/invalid cost/);
    expect(() => labGrownJewelryRetailFromCost(-10)).toThrow(/invalid cost/);
  });
});
