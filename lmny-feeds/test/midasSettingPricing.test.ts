import { describe, expect, it } from 'vitest';
import { MIDAS_SETTINGS, SETTING_ONLY, midasSettingRetailFromCost } from '../config/pricing.js';

describe('Midas mountings use the settings rule', () => {
  it('prices at cost × 2.25, rounded to the dollar', () => {
    expect(SETTING_ONLY.costMultiple).toBe(2.25);
    expect(midasSettingRetailFromCost(600)).toBe(1350);
    expect(midasSettingRetailFromCost(433.33)).toBe(975);
  });
  it('rejects a missing cost', () => {
    expect(() => midasSettingRetailFromCost(0)).toThrow();
  });
  it('uses a tag and SKU prefix that do not name the supplier', () => {
    expect(MIDAS_SETTINGS.tag.toLowerCase()).not.toContain('midas');
    expect(MIDAS_SETTINGS.skuPrefix.toLowerCase()).not.toContain('midas');
  });
});
