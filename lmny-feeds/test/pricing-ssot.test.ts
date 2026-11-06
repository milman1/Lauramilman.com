import { describe, expect, it } from 'vitest';
import {
  LAB_GROWN_JEWELRY,
  LOOSE_LAB_GROWN,
  coloredLabRetailFromCost,
  JEWELRY_RETAIL,
  labGrownJewelryRetailFromCost,
  labRetailMultipleFromCost,
  roundJewelryRetail,
  STONE_TIERS,
  WATCH,
  WATCH_RETAIL_CAP_BY_STOCK,
  WATCH_SALE,
} from '../config/pricing.js';

describe('pricing SSOT — API + lab jewelry', () => {
  it('keeps 1.40× through $4,000 Amount and 1.25× above', () => {
    expect(STONE_TIERS.map((t) => t.multiplier)).toEqual([1.4, 1.25]);
    expect(STONE_TIERS[0]?.maxCostUsd).toBe(4000);
  });

  it('uses graduated tiers with monotonic boundary prices', () => {
    expect(LOOSE_LAB_GROWN.tiers.map(t => t.multiplier)).toEqual([2.5, 2.25, 2, 1.75]);
    for (const [cost, multiple] of [[100,2.5],[400,2.25],[750,2],[1500,1.75]]) {
      expect(labRetailMultipleFromCost(cost)).toBe(multiple);
    }
    for (const cost of [200,500,1000]) {
      expect((cost + 0.01) * labRetailMultipleFromCost(cost + 0.01)).toBeGreaterThanOrEqual(cost * labRetailMultipleFromCost(cost));
    }
    expect(LOOSE_LAB_GROWN.welcomeDiscountPct).toBe(0.1);
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
    expect(JEWELRY_RETAIL.roundToUsd).toBe(10);
    expect(labGrownJewelryRetailFromCost(250)).toBe(500);
    expect(labGrownJewelryRetailFromCost(333.33)).toBe(670);
    expect(roundJewelryRetail(15)).toBe(20);
    expect(roundJewelryRetail(2025)).toBe(2030);
  });

  it('leaves loose and colored lab stones on the dollar tier, not the jewelry $10', () => {
    expect(coloredLabRetailFromCost(250)).toBe(563);
    expect(Math.round(250 * labRetailMultipleFromCost(250))).toBe(563);
  });

  it('rejects non-positive lab jewelry cost', () => {
    expect(() => labGrownJewelryRetailFromCost(0)).toThrow(/invalid cost/);
    expect(() => labGrownJewelryRetailFromCost(-10)).toThrow(/invalid cost/);
  });
});
