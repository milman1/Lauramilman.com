import { describe, expect, it } from 'vitest';
import { SUPPLIER_INTAKE, supplierRetailFromCost } from '../config/pricing.js';

describe('supplierRetailFromCost', () => {
  it('is wholesale cost times three, rounded up to the nearest $5', () => {
    expect(SUPPLIER_INTAKE.costMultiple).toBe(3);
    expect(supplierRetailFromCost(100)).toBe(300);
    expect(supplierRetailFromCost(101)).toBe(305);
    expect(supplierRetailFromCost(412.4)).toBe(1240);
  });

  it('rejects a missing or zero cost', () => {
    expect(() => supplierRetailFromCost(0)).toThrow(/invalid cost/);
    expect(() => supplierRetailFromCost(Number.NaN)).toThrow(/invalid cost/);
  });
});
