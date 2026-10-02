/**
 * Watch retail from supplier unit cost only. No Hours / market mid.
 *
 * Tier chart lives in `config/pricing.ts` (`WATCH_COST_TIERS`) — the single
 * source of truth. This module applies the chart (round up to $100, band floors).
 *
 * Band mins are the previous band's ceiling so retail never drops as cost
 * crosses a boundary.
 */

import {
  EBAY_WATCH_FEE,
  WATCH_COST_TIERS,
  WATCH_RETAIL_CAP_BY_STOCK,
  type WatchCostTier,
} from '../config/pricing.js';

export { EBAY_WATCH_FEE, WATCH_COST_TIERS, WATCH_RETAIL_CAP_BY_STOCK, type WatchCostTier };

export type WatchPricingOutcome =
  | { status: 'priced'; retailUsd: number }
  | { status: 'excluded'; reason: 'aftermarket' }
  | { status: 'no_cost' };

export interface WatchPricingInput {
  /** Supplier unit cost in USD. Missing / ≤0 → no_cost. */
  costUsd?: number | null;
  /** Feed stock number. When set, a retail ceiling in the chart may apply. */
  stockRef?: string | null;
  /** Feed condition aftermarket — excluded entirely. */
  aftermarket?: boolean;
}

/** Round up to the next $100 (already on a hundred stays put). */
export function roundUpTo100(usd: number): number {
  if (!(usd > 0)) return 0;
  // Subtract a tiny epsilon so float noise like `40000 * 1.12 ===
  // 44800.00000000001` does not jump an extra hundred.
  return Math.ceil((usd - 1e-6) / 100) * 100;
}

export function tierForCost(costUsd: number): WatchCostTier {
  for (const tier of WATCH_COST_TIERS) {
    if (tier.maxInclusive ? costUsd <= tier.maxCostUsd : costUsd < tier.maxCostUsd) {
      return tier;
    }
  }
  return WATCH_COST_TIERS[WATCH_COST_TIERS.length - 1]!;
}

/** Band minimum retail (0 under $5k). */
export function tierFloorUsd(tierIndex: number): number {
  return WATCH_COST_TIERS[tierIndex]?.minRetailUsd ?? 0;
}

/** Pure retail from cost alone. */
export function retailFromCost(costUsd: number): number {
  const tier = tierForCost(costUsd);
  return Math.max(roundUpTo100(costUsd * tier.multiplier), tier.minRetailUsd);
}

/** eBay Watches, Parts & Accessories final value fee, plus the per-order fee. */
export function ebayWatchFeeUsd(priceUsd: number): number {
  if (!(priceUsd > 0)) return EBAY_WATCH_FEE.perOrderUsd;
  let fee = EBAY_WATCH_FEE.perOrderUsd;
  let prev = 0;
  let left = priceUsd;
  for (const band of EBAY_WATCH_FEE.bands) {
    const slice = Math.min(left, band.upToUsd - prev);
    if (slice > 0) fee += slice * band.rate;
    left -= slice;
    prev = band.upToUsd;
    if (left <= 1e-9) break;
  }
  return fee;
}

/**
 * Lowest $100 price whose eBay watch-fee net is still at least cost.
 * Marginal fee never exceeds the price, so stepping up by $100 reaches it.
 */
export function minRetailClearingEbayFee(costUsd: number): number {
  const low = EBAY_WATCH_FEE.bands[0]!;
  const mid = EBAY_WATCH_FEE.bands[1]!;
  const top = EBAY_WATCH_FEE.bands[2]!;
  const topStart = mid.upToUsd;
  const feeThroughTopStart = ebayWatchFeeUsd(topStart);
  let raw = (costUsd + feeThroughTopStart - top.rate * topStart) / (1 - top.rate);
  if (!(raw > topStart)) {
    const midStart = low.upToUsd;
    const feeThroughMidStart = ebayWatchFeeUsd(midStart);
    raw = (costUsd + feeThroughMidStart - mid.rate * midStart) / (1 - mid.rate);
    if (!(raw > midStart)) {
      raw = (costUsd + EBAY_WATCH_FEE.perOrderUsd) / (1 - low.rate);
    }
  }
  let price = roundUpTo100(Math.max(raw, costUsd));
  while (price - ebayWatchFeeUsd(price) + 1e-6 < costUsd) price += 100;
  return price;
}

/**
 * Chart retail, then a stock-number ceiling when that ceiling still nets at
 * least cost after the eBay watch fee. A ceiling that would not is ignored.
 * The result is never below the fee floor, so the net cannot fall under cost.
 */
export function retailForWatch(costUsd: number, stockRef?: string | null): number {
  const chart = retailFromCost(costUsd);
  const floor = minRetailClearingEbayFee(costUsd);
  const cap = stockRef ? WATCH_RETAIL_CAP_BY_STOCK[stockRef] : undefined;
  const capped = cap != null && cap < chart && cap >= floor ? cap : chart;
  return Math.max(capped, floor);
}

/**
 * Price a feed watch from supplier cost.
 *
 * Outcomes:
 *  - priced        → safe to publish / update variant price
 *  - excluded      → aftermarket; do not import
 *  - no_cost       → missing cost; do not publish / do not overwrite price
 */
export function priceWatchFromCost(input: WatchPricingInput): WatchPricingOutcome {
  if (input.aftermarket) {
    return { status: 'excluded', reason: 'aftermarket' };
  }

  const cost = input.costUsd;
  if (cost == null || !(cost > 0) || !Number.isFinite(cost)) {
    return { status: 'no_cost' };
  }

  return { status: 'priced', retailUsd: retailForWatch(cost, input.stockRef) };
}
