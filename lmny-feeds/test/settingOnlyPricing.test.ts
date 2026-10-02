import { describe, expect, it } from 'vitest';
import { SETTING_ONLY, settingOnlyRetailFromCost } from '../config/pricing.js';

describe('settingOnlyRetailFromCost', () => {
  it('prices a setting without its center stone at 3× cost, to the dollar', () => {
    expect(SETTING_ONLY.costMultiple).toBe(3);
    expect(settingOnlyRetailFromCost(600)).toBe(1800);
    expect(settingOnlyRetailFromCost(412.4)).toBe(1237);
    expect(settingOnlyRetailFromCost(412.5)).toBe(1238);
  });

  it('refuses a missing or zero cost instead of inventing a price', () => {
    expect(() => settingOnlyRetailFromCost(0)).toThrow(/invalid cost/);
    expect(() => settingOnlyRetailFromCost(-5)).toThrow(/invalid cost/);
    expect(() => settingOnlyRetailFromCost(Number.NaN)).toThrow(/invalid cost/);
  });
});
