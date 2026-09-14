/**
 * Watch retail from supplier unit cost only. No Hours / market mid.
 *
 * Tier chart lives in `config/pricing.ts` (`WATCH_COST_TIERS`) — the single
 * source of truth. This module applies the chart (round up to $100, band floors).
 *
 * Band mins are the previous band's ceiling so retail never drops as cost
 * crosses a boundary.
 */

import { WATCH_COST_TIERS, type WatchCostTier } from '../config/pricing.js';

export { WATCH_COST_TIERS, type WatchCostTier };

export type WatchPricingOutcome =
  | { status: 'priced'; retailUsd: number }
  | { status: 'excluded'; reason: 'aftermarket' }
  | { status: 'no_cost' };

export interface WatchPricingInput {
  /** Supplier unit cost in USD. Missing / ≤0 → no_cost. */
  costUsd?: number | null;
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

  return { status: 'priced', retailUsd: retailFromCost(cost) };
}
