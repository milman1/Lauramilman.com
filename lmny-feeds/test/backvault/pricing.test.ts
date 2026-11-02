import { describe, expect, it } from 'vitest';
import { BACKVAULT } from '../../config/pricing.js';
import { backVaultCostFromListed, backVaultRetailFromCost } from '../../src/backvault/pricing.js';

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

describe('backVaultCostFromListed', () => {
  it('is the supplier listed price divided by 1.3, to the cent', () => {
    expect(BACKVAULT.costDivisor).toBe(1.3);
    expect(backVaultCostFromListed(5000)).toBe(3846.15);
    expect(backVaultCostFromListed(67600)).toBe(52000);
    expect(backVaultCostFromListed(0)).toBe(0);
  });

  it('leaves a margin of about 23% at the listed-price ticket', () => {
    const listed = 5000;
    const margin = (backVaultRetailFromCost(listed) - backVaultCostFromListed(listed)) / backVaultRetailFromCost(listed);
    expect(margin).toBeCloseTo(0.2308, 3);
  });

  it('rejects a missing or negative listed price', () => {
    expect(() => backVaultCostFromListed(Number.NaN)).toThrow(/invalid listed price/);
    expect(() => backVaultCostFromListed(-1)).toThrow(/invalid listed price/);
  });
});
