/**
 * Watch retail from supplier unit cost only. No Hours / market mid.
 *
 * Chart (first matching band wins):
 *   Under $5,000          1.30×  round up to $100
 *   $5,000 – $15,000      1.20×  round up to $100, min $6,500
 *   $15,001 – $40,000     1.12×  round up to $100, min $18,000
 *   Above $40,000         1.08×  round up to $100, min $44,800
 *
 * Band mins are the previous band's ceiling so retail never drops as cost
 * crosses a boundary.
 */

export const WATCH_COST_TIERS = [
  { maxCostUsd: 5_000, maxInclusive: false, multiplier: 1.3, minRetailUsd: 0 },
  { maxCostUsd: 15_000, maxInclusive: true, multiplier: 1.2, minRetailUsd: 6_500 },
  { maxCostUsd: 40_000, maxInclusive: true, multiplier: 1.12, minRetailUsd: 18_000 },
  { maxCostUsd: Number.POSITIVE_INFINITY, maxInclusive: true, multiplier: 1.08, minRetailUsd: 44_800 },
] as const;

export type WatchCostTier = (typeof WATCH_COST_TIERS)[number];

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
