import { describe, expect, it } from 'vitest';
import {
  ENGAGEMENT_RING,
  SETTING_ONLY,
  engagementRing18kRetailFrom14kRetail,
  engagementRingRetailFromCost,
  setting18kRetailFrom14kRetail,
  settingOnlyRetailFromCost,
} from '../config/pricing.js';

describe('settingOnlyRetailFromCost', () => {
  it('prices a setting without its center stone at 2.5× cost, to the dollar', () => {
    expect(SETTING_ONLY.costMultiple).toBe(2.5);
    expect(settingOnlyRetailFromCost(600)).toBe(1500);
    expect(settingOnlyRetailFromCost(750)).toBe(1875);
    expect(settingOnlyRetailFromCost(900)).toBe(2250);
    expect(settingOnlyRetailFromCost(1100)).toBe(2750);
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
    expect(setting18kRetailFrom14kRetail(settingOnlyRetailFromCost(800))).toBe(2250);
    expect(() => setting18kRetailFrom14kRetail(0)).toThrow();
  });
});

describe('engagementRingRetailFromCost', () => {
  it('prices a lab-grown engagement ring with its own stone at 2.5× cost, to the dollar', () => {
    expect(ENGAGEMENT_RING.costMultiple).toBe(2.5);
    expect(engagementRingRetailFromCost(850)).toBe(2125);
    expect(engagementRingRetailFromCost(1450)).toBe(3625);
    expect(engagementRingRetailFromCost(333)).toBe(833);
    expect(() => engagementRingRetailFromCost(0)).toThrow(/invalid cost/);
  });

  it('prices the 18K option at the 14K price + $250', () => {
    expect(ENGAGEMENT_RING.upcharge18kUsd).toBe(250);
    expect(engagementRing18kRetailFrom14kRetail(engagementRingRetailFromCost(650))).toBe(1875);
    expect(() => engagementRing18kRetailFrom14kRetail(-1)).toThrow();
  });
});
