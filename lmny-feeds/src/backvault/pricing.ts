import { BACKVAULT } from '../../config/pricing.js';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function assertListed(listedPriceUsd: number): void {
  if (!Number.isFinite(listedPriceUsd) || listedPriceUsd < 0) {
    throw new Error(`Back Vault pricing: invalid supplier price ${listedPriceUsd}`);
  }
}

/**
 * What LMNY pays for a Back Vault item: the supplier's listed price less the
 * trade discount in config/pricing.ts. Change the number there, never here.
 */
export function backVaultCostFromListed(listedPriceUsd: number): number {
  assertListed(listedPriceUsd);
  return round2(listedPriceUsd * (1 - BACKVAULT.tradeDiscount));
}

/**
 * Retail for a Back Vault item with no competitor comparison: the supplier's
 * listed price plus the markup in config/pricing.ts (0, so the store matches
 * the supplier).
 */
export function backVaultRetailFromListed(listedPriceUsd: number): number {
  assertListed(listedPriceUsd);
  return round2(listedPriceUsd + BACKVAULT.markupOverListedUsd);
}

/**
 * Retail for a Back Vault item. The competitor comparison is off
 * (BACKVAULT.competitor.enabled), so this is the flat rule. With it on, a
 * competitor price moves the ticket to the midpoint between the supplier's
 * listed price and the competitor's, floored at the flat rule so a competitor
 * who under-prices the supplier can never push us below it.
 */
export function backVaultRetail(listedPriceUsd: number, competitorPriceUsd?: number | null): number {
  const flat = backVaultRetailFromListed(listedPriceUsd);
  if (!BACKVAULT.competitor.enabled) return flat;
  if (competitorPriceUsd === undefined || competitorPriceUsd === null) return flat;
  if (!Number.isFinite(competitorPriceUsd) || competitorPriceUsd <= 0) return flat;
  const midpoint = round2((listedPriceUsd + competitorPriceUsd) / 2);
  return Math.max(midpoint, flat);
}
