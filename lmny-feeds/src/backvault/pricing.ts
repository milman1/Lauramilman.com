import { BACKVAULT } from '../../config/pricing.js';

/**
 * Retail for a Back Vault item from its cost (the supplier's listed price).
 * Flat markup from config/pricing.ts — change the number there, never here.
 */
export function backVaultRetailFromCost(costUsd: number): number {
  if (!Number.isFinite(costUsd) || costUsd < 0) {
    throw new Error(`Back Vault pricing: invalid cost ${costUsd}`);
  }
  return Math.round((costUsd + BACKVAULT.markupUsd) * 100) / 100;
}
