import { describe, expect, it } from 'vitest';
import { BACKVAULT } from '../../config/pricing.js';
import { backVaultCostFromListed, backVaultRetail, backVaultRetailFromListed } from '../../src/backvault/pricing.js';

describe('Back Vault pricing (merchant decision 2026-11-11)', () => {
  it('sells at the price the supplier lists', () => {
    expect(BACKVAULT.markupOverListedUsd).toBe(0);
    expect(backVaultRetailFromListed(22700)).toBe(22700);
    expect(backVaultRetailFromListed(1234.56)).toBe(1234.56);
    expect(backVaultRetailFromListed(0)).toBe(0);
  });

  it('records the cost at one third off the listed price', () => {
    expect(BACKVAULT.tradeDiscount).toBeCloseTo(1 / 3, 10);
    expect(backVaultCostFromListed(22700)).toBe(15133.33);
    expect(backVaultCostFromListed(67600)).toBe(45066.67);
    expect(backVaultCostFromListed(3000)).toBe(2000);
  });

  it('ignores a competitor price while the comparison is off', () => {
    expect(BACKVAULT.competitor.enabled).toBe(false);
    expect(backVaultRetail(22700, 26000)).toBe(22700);
    expect(backVaultRetail(22700)).toBe(22700);
  });

  it('rejects a missing or negative supplier price instead of publishing a bad ticket', () => {
    expect(() => backVaultRetailFromListed(Number.NaN)).toThrow(/invalid supplier price/);
    expect(() => backVaultRetailFromListed(-1)).toThrow(/invalid supplier price/);
    expect(() => backVaultCostFromListed(Number.NaN)).toThrow(/invalid supplier price/);
  });
});
