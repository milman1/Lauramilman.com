import { BACKVAULT } from '../../config/pricing.js';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Retail for a Back Vault item with no competitor match: cost plus the flat
 * markup from config/pricing.ts. Change the number there, never here.
 */
export function backVaultRetailFromCost(costUsd: number): number {
  if (!Number.isFinite(costUsd) || costUsd < 0) {
    throw new Error(`Back Vault pricing: invalid cost ${costUsd}`);
  }
  return round2(costUsd + BACKVAULT.markupUsd);
}

/**
 * Retail for a Back Vault item. With a competitor price the ticket is the
 * midpoint between our cost (the supplier price) and the competitor's
 * price, floored at cost + markup so a competitor who under-prices the
 * supplier can never push us below the flat rule. Without a match, the
 * flat rule.
 */
export function backVaultRetail(costUsd: number, competitorPriceUsd?: number | null): number {
  const flat = backVaultRetailFromCost(costUsd);
  if (competitorPriceUsd === undefined || competitorPriceUsd === null) return flat;
  if (!Number.isFinite(competitorPriceUsd) || competitorPriceUsd <= 0) return flat;
  const midpoint = round2((costUsd + competitorPriceUsd) / 2);
  return Math.max(midpoint, flat);
}
