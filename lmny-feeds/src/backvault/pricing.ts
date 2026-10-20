import { BACKVAULT } from '../../config/pricing.js';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Retail for a Back Vault item: 10% under the supplier's listed price.
 * The factor lives in config/pricing.ts. Change it there, never here.
 * A competitor price does not change the ticket.
 */
export function backVaultRetailFromCost(costUsd: number): number {
  if (!Number.isFinite(costUsd) || costUsd < 0) {
    throw new Error(`Back Vault pricing: invalid cost ${costUsd}`);
  }
  return round2(costUsd * BACKVAULT.listedPriceFactor);
}

/**
 * Retail for a Back Vault item. The second argument is the competitor
 * price when one was found; it is recorded on the product and does not
 * change this number.
 */
export function backVaultRetail(costUsd: number, _competitorPriceUsd?: number | null): number {
  return backVaultRetailFromCost(costUsd);
}
