import { describe, expect, it } from 'vitest';
import { buildProductSetInput } from '../src/product.js';
import { assertHouseSettingSkuNotInFeed, SETTING_CENTER_SHAPES, settingCenterShapeForSku, settingShapeIssues } from '../src/settingCenterShape.js';
import { naturalStone, priced } from './fixtures.js';

describe('house setting center shapes', () => {
  it('maps the four supplier SKUs and their size suffixes', () => {
    expect(settingCenterShapeForSku('RG18YSO__PNS')?.shape).toBe('Oval');
    expect(settingCenterShapeForSku('RG18YSO__PNS-8.5')?.title).toBe('Oval Four-Prong Solitaire Setting, 18K Yellow Gold');
    expect(settingCenterShapeForSku('RG18YHH_5PNS-4')?.shape).toBe('Oval');
    expect(settingCenterShapeForSku('RG18YHHRD10PNS')?.shape).toBe('Oval');
    expect(settingCenterShapeForSku('RG18YHHRD10PNS-6.25')?.shape).toBe('Oval');
    expect(settingCenterShapeForSku('RG18YSO__BNS')?.shape).toBe('Cushion');
    expect(settingCenterShapeForSku('RG18YSO__BNS-7')?.display).toBe('elongated cushion');
  });

  it('does not treat a neighboring SKU, or the RD10 substring, as a different shape', () => {
    expect(settingCenterShapeForSku('RG18YSO__PN')).toBeNull();
    expect(settingCenterShapeForSku('RG18YSO__PNSX')).toBeNull();
    expect(settingCenterShapeForSku('RG18YHH_5PN')).toBeNull();
    expect(settingCenterShapeForSku('RG18YHHRD10')?.shape).toBeUndefined();
    expect(SETTING_CENTER_SHAPES.find(row => row.sku === 'RG18YHHRD10PNS')?.shape).toBe('Oval');
    expect(settingShapeIssues({
      skus: ['RG18YHHRD10PNS-5'],
      title: 'Oval Hidden Halo Setting, 18K Yellow Gold, 0.11 CT',
      diamondShape: 'Round',
      tags: ['Oval'],
      copy: 'Sold without a center stone.',
    }).join(' ')).toMatch(/must be Oval/);
  });

  it('rejects a wrong title, the opposite shape tag, and copy that names another center', () => {
    const issues = settingShapeIssues({
      skus: ['RG18YSO__BNS-4'],
      title: 'Oval Bezel Setting',
      diamondShape: 'Oval',
      tags: ['Oval'],
      copy: 'This oval setting is sold without a center stone.',
    });
    expect(issues.join(' ')).toMatch(/title must be/);
    expect(issues.join(' ')).toMatch(/must be Cushion/);
    expect(issues.join(' ')).toMatch(/needs the Cushion tag/);
    expect(issues.join(' ')).toMatch(/must not carry the Oval tag/);
    expect(issues.join(' ')).toMatch(/must not call the center Oval/);
  });

  it('accepts the mapped title, canonical shape, and a separate center stone', () => {
    expect(settingShapeIssues({
      skus: ['RG18YSO__PNS-4', 'RG18YSO__PNS-8.5'],
      title: 'Oval Four-Prong Solitaire Setting, 18K Yellow Gold',
      diamondShape: 'Oval',
      tags: ['ring-setting', 'Oval', '18K Yellow Gold'],
      copy: 'Sold without a center stone. The center stone is sold separately.',
    })).toEqual([]);
  });

  it('keeps these SKUs out of the loose-stone feed', () => {
    expect(() => assertHouseSettingSkuNotInFeed('RG18YSO__BNS')).toThrow(/Cushion/);
    expect(() => buildProductSetInput(naturalStone({ stockRef: 'RG18YHH_5PNS' }), priced(), '2026-10-11T00:00:00Z')).toThrow(/RG18YHH_5PNS/);
  });
});
