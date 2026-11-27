import { describe, expect, it } from 'vitest';
import {
  LAB_GROWN_JEWELRY,
  LOOSE_LAB_GROWN,
  labGrownJewelryRetailFromCost,
  labRetailMultipleFromCost,
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

  it.each([
    // Live catalog, 2026-11-27: engagement-style rings at cost × 2.75 to the dollar.
    ['RG14WSOOV150PNS', 1200, 3300],
    ['RG14YSOOV200PNS', 1200, 3300],
    ['RG14TTSOMQ250PNS', 1300, 3575],
    ['RG14WSORAD150PNS', 1150, 3163],
    ['RG14YSOOV350HBNS', 2250, 6188],
    ['RG14WHHRD150P', 850, 2338],
    ['RG14W3OV350HMPNS', 1750, 4813],
    ['RG14YSDSEM75RDBEW', 700, 1925],
    ['LMNY-MTO-RG14W3MQ75RDPNS-14K-4', 650, 1788],
    ['LMNY-MTO-RG14YSDSPS75RDPIN-14K-4', 750, 2063],
    // Everything else at cost × 2.
    ['BC14WTSRD550P', 2250, 4500],
    ['NK14WTSEM550BEW', 4950, 9900],
    ['ER14WHPRD100P', 700, 1400],
    ['EB14WRD750P', 2300, 4600],
    ['LMNY-MTO-RG14WSPRD100P-14K-4', 750, 1500],
    ['LMNY-MTO-RG14YSPRD75P-14K-4', 850, 1700],
  ])('prices lab-grown %s from cost %d at %d, as listed', (sku, cost, retail) => {
    expect(labGrownJewelryRetailFromCost(cost, sku)).toBe(retail);
  });

  it('prices lab-grown jewelry at cost × 2, engagement-style rings at × 2.75', () => {
    expect(LAB_GROWN_JEWELRY.engagementRingCostMultiple).toBe(2.75);
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
