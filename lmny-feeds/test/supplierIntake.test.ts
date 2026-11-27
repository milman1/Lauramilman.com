import { describe, expect, it } from 'vitest';
import { SUPPLIER_INTAKE, supplierRetailFromCost } from '../config/pricing.js';

describe('supplierRetailFromCost', () => {
  it('is wholesale cost times three, rounded up to the nearest $5', () => {
    expect(SUPPLIER_INTAKE.costMultiple).toBe(2);
    expect(SUPPLIER_INTAKE.roundUpToUsd).toBe(10);
    expect(supplierRetailFromCost(100)).toBe(200);
    expect(supplierRetailFromCost(101)).toBe(210);
    // Live chain SF050-18 (cost $1,312.40): $3,940 at × 3, $2,630 from 2 Dec 2026.
    expect(supplierRetailFromCost(1312.4)).toBe(2630);
    expect(supplierRetailFromCost(412.4)).toBe(830);
  });

  it('rejects a missing or zero cost', () => {
    expect(() => supplierRetailFromCost(0)).toThrow(/invalid cost/);
    expect(() => supplierRetailFromCost(Number.NaN)).toThrow(/invalid cost/);
  });
});
