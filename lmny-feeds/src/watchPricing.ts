/**
 * Watch retail pricing from supplier unit cost.
 *
 * Comps (Hours mid) are NEVER used to set price — only to flag suspicious
 * supplier cost data for manual review when the computed retail sits more
 * than 40% below mid.
 *
 * Tiers (cost → multiplier), then round UP to nearest $100, then floor each
 * tier at the previous tier's rounded ceiling so a higher cost never retail
 * for less than a lower one (boundary inversion).
 */

export const WATCH_COST_TIERS = [
  { maxExclusive: 5_000, multiplier: 1.3 },
  { maxExclusive: 15_000, multiplier: 1.2 },
  { maxExclusive: 40_000, multiplier: 1.12 },
  { maxExclusive: Number.POSITIVE_INFINITY, multiplier: 1.08 },
] as const;

/** Hold for review when retail < comp_mid × (1 − this). */
export const COMP_REVIEW_DISCOUNT = 0.4;

export type WatchPricingOutcome =
  | { status: 'priced'; retailUsd: number }
  | { status: 'excluded'; reason: 'aftermarket' }
  | { status: 'no_cost' }
  | {
      status: 'needs_review';
      reason: 'below_comp_mid';
      retailUsd: number;
      costUsd: number;
      compMidUsd: number;
    };

export interface WatchPricingInput {
  /** Supplier unit cost in USD. Missing / ≤0 → no_cost. */
  costUsd?: number | null;
  /** Hours / market mid — audit + review gate only; never enters retail math. */
  compMidUsd?: number | null;
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

function tierIndexForCost(costUsd: number): number {
  for (let i = 0; i < WATCH_COST_TIERS.length; i++) {
    if (costUsd < WATCH_COST_TIERS[i]!.maxExclusive) return i;
  }
  return WATCH_COST_TIERS.length - 1;
}

/**
 * Floor for tier `index`: previous tier's rounded ceiling at its cost boundary.
 * Tier 0 has no floor. Using the boundary × previous multiplier (not the
 * open-ended max-cost) is what kills the $4,999→$5,000 inversion.
 */
export function tierFloorUsd(tierIndex: number): number {
  if (tierIndex <= 0) return 0;
  const prev = WATCH_COST_TIERS[tierIndex - 1]!;
  return roundUpTo100(prev.maxExclusive * prev.multiplier);
}

/**
 * Pure retail from cost alone — no comps. Exported for tests / backfill
 * diagnostics that want the number before the review gate.
 */
export function retailFromCost(costUsd: number): number {
  const idx = tierIndexForCost(costUsd);
  const tier = WATCH_COST_TIERS[idx]!;
  const raw = roundUpTo100(costUsd * tier.multiplier);
  return Math.max(raw, tierFloorUsd(idx));
}

/**
 * Price a feed watch from supplier cost.
 *
 * Outcomes:
 *  - priced        → safe to publish / update variant price
 *  - excluded      → aftermarket; do not import
 *  - no_cost       → missing cost; do not publish / do not overwrite price
 *  - needs_review  → retail >40% under mid; hold, tag, leave existing price
 */
export function priceWatchFromCost(input: WatchPricingInput): WatchPricingOutcome {
  if (input.aftermarket) {
    return { status: 'excluded', reason: 'aftermarket' };
  }

  const cost = input.costUsd;
  if (cost == null || !(cost > 0) || !Number.isFinite(cost)) {
    return { status: 'no_cost' };
  }

  const retailUsd = retailFromCost(cost);
  const mid = input.compMidUsd;
  if (mid != null && mid > 0 && retailUsd < mid * (1 - COMP_REVIEW_DISCOUNT)) {
    return {
      status: 'needs_review',
      reason: 'below_comp_mid',
      retailUsd,
      costUsd: cost,
      compMidUsd: mid,
    };
  }

  return { status: 'priced', retailUsd };
}
