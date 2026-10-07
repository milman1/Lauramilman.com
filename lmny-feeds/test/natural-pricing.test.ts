import { describe, expect, it } from 'vitest';
import { NATURAL_PRICING, toBps, validateNaturalPricingConfig } from '../config/pricing.js';
import { NullCompProvider } from '../src/compProvider.js';
import { naturalFloorCents, naturalFloorViolation, priceNatural, rapKBps } from '../src/markup.js';
import { naturalStone } from './fixtures.js';

// Neutral stone: k = 0.75 (no adjustment matches). 1.50ct G VS1 Very Good.
const base = (o = {}) =>
  naturalStone({ carat: 1.5, color: 'G', clarity: 'VS1', cut: 'Very Good', polish: 'Very Good', symmetry: 'Very Good', fluorescence: 'None', ...o });

const hold = (r: ReturnType<typeof priceNatural>) => (!r.ok ? r.hold.reason : null);

describe('natural pricing: holds', () => {
  it.each([[0], [-5], [Number.NaN], [undefined as unknown as number], ['abc' as unknown as number]])(
    'holds cost %s as natural_no_cost',
    (costUsd) => {
      expect(hold(priceNatural(base({ costUsd })))).toBe('natural_no_cost');
    },
  );

  it('holds when the anchor is below cost', () => {
    // Rap total 3000 × 0.75 = 2250 < cost 5000
    expect(hold(priceNatural(base({ costUsd: 5000, rapPriceUsd: 2000 })))).toBe('natural_below_floor');
  });

  it('holds when rounding down drops a just-above-floor anchor below the floor', () => {
    // cost 1000 → floor max(1150, 1250) = 1250. Rap total 1.5 × 1120 = 1680 × .75 = 1260 → rounds down to 1250 (ok).
    // Rap/ct 1119 → total 1678.5 × .75 = 1258.875 → 1250 still ok; use cost 1002: floor 1252 → anchor 1258 → rounds to 1250 < 1252.
    const r = priceNatural(base({ costUsd: 1002, rapPriceUsd: 1119 }));
    expect(hold(r)).toBe('natural_below_floor');
  });

  it('publishes exactly at the floor when the rounded anchor equals it', () => {
    const r = priceNatural(base({ costUsd: 1000, rapPriceUsd: 1120 })); // anchor 1260 → 1250 = floor
    expect(r.ok && r.priced.retailUsd).toBe(1250);
  });
});

describe('natural pricing: floor', () => {
  it('uses the larger of cost×1.15 and cost+$250', () => {
    expect(naturalFloorCents(100_000)).toBe(125_000); // +$250 wins on a $1,000 stone
    expect(naturalFloorCents(10_000_00)).toBe(11_500_00); // ×1.15 wins on $10,000
  });

  it('write-path check rejects a price at or below cost or floor', () => {
    const s = base({ costUsd: 1000 });
    expect(naturalFloorViolation(s, 1000)).not.toBeNull();
    expect(naturalFloorViolation(s, 1249.99)).not.toBeNull();
    expect(naturalFloorViolation(s, 1250)).toBeNull();
    expect(naturalFloorViolation(base({ costUsd: 0 }), 5000)).toBe('natural_no_cost');
  });
});

describe('natural pricing: k(segment)', () => {
  it('starts at 0.75', () => expect(rapKBps(base())).toBe(7500));

  it('clamps at the low end (0.55)', () => {
    // SI1 −.07, color J −.05, <1ct −.05, Good cut −.10, → 0.48 → 0.55
    expect(rapKBps(base({ clarity: 'SI1', color: 'J', carat: 0.8, cut: 'Good' }))).toBe(5500);
  });

  it('clamps at the high end (0.85)', () => {
    // 2ct +.05, EX/EX/EX +.05 → 0.85 exactly; stacking cannot exceed it
    expect(rapKBps(base({ carat: 2.5, cut: 'Excellent', polish: 'Excellent', symmetry: 'Excellent' }))).toBe(8500);
  });

  it('stacks SI + under-1ct', () => {
    expect(rapKBps(base({ clarity: 'SI2', carat: 0.9 }))).toBe(6300); // .75 −.07 −.05
  });

  it('applies fluorescence only on colors D-H', () => {
    expect(rapKBps(base({ fluorescence: 'Strong', color: 'F' }))).toBe(7000);
    expect(rapKBps(base({ fluorescence: 'Strong', color: 'I' }))).toBe(7000); // I: −.05 color only
  });

  it('reads k from config', () => {
    expect(toBps(NATURAL_PRICING.rapK.base)).toBe(7500);
  });
});

describe('natural pricing: tiers', () => {
  it('prices from Rap total (rap/ct × carat) × k, rounded down to $25', () => {
    // 1.5ct × 5000 = 7500 × .75 = 5625
    const r = priceNatural(base({ costUsd: 3000, rapPriceUsd: 5000 }));
    expect(r.ok && r.priced.retailUsd).toBe(5625);
    expect(r.ok && r.priced.priceSource).toBe('rap');
  });

  it('rounds down, never up', () => {
    const r = priceNatural(base({ costUsd: 3000, rapPriceUsd: 5003 })); // 5629.1 → 5625
    expect(r.ok && r.priced.retailUsd).toBe(5625);
  });

  it('with no Rap, uses cost × 1.5 and still respects the floor', () => {
    const ok = priceNatural(base({ costUsd: 4000, rapPriceUsd: undefined }));
    expect(ok.ok && ok.priced.retailUsd).toBe(6000);
    expect(ok.ok && ok.priced.priceSource).toBe('fallback');
  });

  it('uses cert comp × 0.98 when fresh, spec comp when thin cert missing', () => {
    const now = new Date('2026-10-07T00:00:00Z');
    const cert = { lowestCents: 600_000, sourceCount: 2, asOf: '2026-10-05T00:00:00Z' };
    const c = priceNatural(base({ costUsd: 3000 }), { cert }, now);
    expect(c.ok && c.priced.retailUsd).toBe(5875); // 5880 → 5875
    expect(c.ok && c.priced.priceSource).toBe('cert');
    const spec = { p25Cents: 600_000, count: 5, asOf: '2026-10-05T00:00:00Z' };
    const sp = priceNatural(base({ costUsd: 3000 }), { spec }, now);
    expect(sp.ok && sp.priced.priceSource).toBe('spec');
  });

  it('ignores stale comps and spec comps below the minimum count', () => {
    const now = new Date('2026-10-07T00:00:00Z');
    const stale = { lowestCents: 600_000, sourceCount: 2, asOf: '2026-09-29T00:00:00Z' };
    const thin = { p25Cents: 600_000, count: 4, asOf: '2026-10-06T00:00:00Z' };
    const r = priceNatural(base({ costUsd: 3000, rapPriceUsd: 5000 }), { cert: stale, spec: thin }, now);
    expect(r.ok && r.priced.priceSource).toBe('rap');
  });

  it('a comp below the floor holds rather than rounding up', () => {
    const now = new Date('2026-10-07T00:00:00Z');
    const cert = { lowestCents: 300_000, sourceCount: 1, asOf: '2026-10-06T00:00:00Z' };
    expect(hold(priceNatural(base({ costUsd: 3000 }), { cert }, now))).toBe('natural_below_floor');
  });

  it('keeps integer cents: no float drift on 1.15 / 0.98 / 0.07 products', () => {
    // 1.15 × 100 = 114.99999999999999 in floats; ceil on cents must not be off by one.
    expect(naturalFloorCents(10_000)).toBe(35_000); // $100 → +$250 wins
    expect(naturalFloorCents(100_000_00)).toBe(115_000_00);
    expect(naturalFloorCents(87_00)).toBe(25_000 + 87_00);
    expect(toBps(1.15)).toBe(11_500);
    expect(toBps(0.98)).toBe(9_800);
    expect(toBps(-0.07)).toBe(-700);
    for (const cost of [1234.56, 987.65, 55555.55]) {
      const r = priceNatural(base({ costUsd: cost, rapPriceUsd: undefined }));
      if (r.ok) expect(Number.isInteger(Math.round(r.priced.retailUsd * 100)) && r.priced.retailUsd % 25).toBe(0);
    }
  });
});

describe('natural pricing: config + provider', () => {
  it('refuses to run on an unsafe config', () => {
    expect(() => validateNaturalPricingConfig({ ...NATURAL_PRICING, floorMult: 1.0 })).toThrow(/NATURAL_FLOOR_MULT/);
    expect(() => validateNaturalPricingConfig({ ...NATURAL_PRICING, floorMult: 0.9 })).toThrow();
    expect(() => validateNaturalPricingConfig({ ...NATURAL_PRICING, floorAbsCents: 0 })).toThrow(/NATURAL_FLOOR_ABS/);
    expect(() => validateNaturalPricingConfig()).not.toThrow();
  });

  it('null provider always returns null', async () => {
    const p = new NullCompProvider();
    expect(await p.getCertComp()).toBeNull();
    expect(await p.getSpecComps()).toBeNull();
  });
});
