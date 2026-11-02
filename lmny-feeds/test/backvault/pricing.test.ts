import { describe, expect, it } from 'vitest';
import { BACKVAULT } from '../../config/pricing.js';
import { backVaultRetailFromCost } from '../../src/backvault/pricing.js';

describe('backVaultRetailFromCost', () => {
  it('is the supplier listed price, no markup', () => {
    expect(BACKVAULT.listedPriceFactor).toBe(1);
    expect(backVaultRetailFromCost(67600)).toBe(67600);
    expect(backVaultRetailFromCost(0)).toBe(0);
    expect(backVaultRetailFromCost(1234.56)).toBe(1234.56);
  });

  it('rounds to cents', () => {
    expect(backVaultRetailFromCost(0.1 + 0.2)).toBe(0.3);
  });

  it('rejects a missing or negative cost instead of publishing a bad ticket', () => {
    expect(() => backVaultRetailFromCost(Number.NaN)).toThrow(/invalid cost/);
    expect(() => backVaultRetailFromCost(-1)).toThrow(/invalid cost/);
  });
});
