import { describe, expect, it } from 'vitest';
import { BACKVAULT } from '../../config/pricing.js';
import { backVaultRetailFromCost } from '../../src/backvault/pricing.js';

describe('backVaultRetailFromCost', () => {
  it('is a flat $200 over the supplier price', () => {
    expect(BACKVAULT.markupUsd).toBe(200);
    expect(backVaultRetailFromCost(67600)).toBe(67800);
    expect(backVaultRetailFromCost(0)).toBe(200);
    expect(backVaultRetailFromCost(1234.56)).toBe(1434.56);
  });

  it('rounds to cents', () => {
    expect(backVaultRetailFromCost(0.1 + 0.2)).toBe(200.3);
  });

  it('rejects a missing or negative cost instead of publishing a bad ticket', () => {
    expect(() => backVaultRetailFromCost(Number.NaN)).toThrow(/invalid cost/);
    expect(() => backVaultRetailFromCost(-1)).toThrow(/invalid cost/);
  });
});
