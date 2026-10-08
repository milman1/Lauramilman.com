import { describe, expect, it } from 'vitest';
import { SETTING_ONLY, setting18kRetailFrom14kRetail, settingOnlyRetailFromCost } from '../config/pricing.js';

describe('settingOnlyRetailFromCost', () => {
  it('prices a setting without its center stone at 2.25× cost, to the dollar', () => {
    expect(SETTING_ONLY.costMultiple).toBe(2.25);
    expect(settingOnlyRetailFromCost(600)).toBe(1350);
    expect(settingOnlyRetailFromCost(750)).toBe(1688);
    expect(settingOnlyRetailFromCost(900)).toBe(2025);
    expect(settingOnlyRetailFromCost(1100)).toBe(2475);
  });

  it('refuses a missing or zero cost instead of inventing a price', () => {
    expect(() => settingOnlyRetailFromCost(0)).toThrow(/invalid cost/);
    expect(() => settingOnlyRetailFromCost(-5)).toThrow(/invalid cost/);
    expect(() => settingOnlyRetailFromCost(Number.NaN)).toThrow(/invalid cost/);
  });
});

describe('setting18kRetailFrom14kRetail', () => {
  it('adds a flat $250 to the 14K setting price', () => {
    expect(SETTING_ONLY.upcharge18kUsd).toBe(250);
    expect(setting18kRetailFrom14kRetail(1350)).toBe(1600);
    expect(() => setting18kRetailFrom14kRetail(0)).toThrow();
  });
});
