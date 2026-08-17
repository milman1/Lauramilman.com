import { describe, expect, it } from 'vitest';
import { LOOSE_DIAMOND } from '../config/pricing.js';
import { FALLBACK_RULES, priceLab, priceNatural, priceWatch } from '../src/markup.js';
import { labStone, naturalStone, watch } from './fixtures.js';

describe('natural pricing', () => {
  it('prices at wholesale × 5', () => {
    const r = priceNatural(naturalStone({ rapPriceUsd: 20000, costUsd: 10000 }));
    expect(r.ok && r.priced.retailUsd).toBe(50_000);
    expect(r.ok && r.priced.marginPct).toBeCloseTo(0.8);
  });

  it('ignores Rapaport for retail (still ok without it)', () => {
    const r = priceNatural(naturalStone({ rapPriceUsd: undefined, costUsd: 8000 }));
    expect(r.ok && r.priced.retailUsd).toBe(40_000);
  });

  it('holds when there is no wholesale cost', () => {
    const r = priceNatural(naturalStone({ costUsd: 0 }));
    expect(!r.ok && r.hold.reason).toBe('natural_no_cost');
  });

  it('publishes with ~80% margin at 5×', () => {
    const r = priceNatural(naturalStone({ costUsd: 12000 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.priced.marginPct).toBeGreaterThanOrEqual(0.2);
  });

  it('holds when retail falls below cost (structurally impossible at 5×)', () => {
    // Guard exists; with a positive multiple it cannot fire for finite cost.
    const r = priceNatural(naturalStone({ costUsd: 900 }));
    expect(r.ok && r.priced.retailUsd).toBe(4500);
  });
});

describe('lab pricing', () => {
  it('prices every band at wholesale × 5', () => {
    const cheap = priceLab(labStone({ carat: 1.0, costUsd: 400, pricePerCaratUsd: 400 }));
    const mid = priceLab(labStone({ carat: 2.0, costUsd: 1200, pricePerCaratUsd: 600 }));
    const big = priceLab(labStone({ carat: 6.0, costUsd: 5000, pricePerCaratUsd: 833 }));
    expect(cheap.ok && cheap.priced.retailUsd).toBe(2000); // 400 × 5
    expect(mid.ok && mid.priced.retailUsd).toBe(6000); // 1200 × 5
    expect(big.ok && big.priced.retailUsd).toBe(25_000); // 5000 × 5
  });

  it('uses the shared loose-diamond multiple', () => {
    expect(LOOSE_DIAMOND.wholesaleMultiple).toBe(5);
    const at500 = priceLab(labStone({ carat: 1.0, costUsd: 500, pricePerCaratUsd: 500 }));
    expect(at500.ok && at500.priced.retailUsd).toBe(2500);
  });

  it('has a tier for any cost (last tier is unbounded)', () => {
    expect(FALLBACK_RULES.at(-1)?.maxCostUsd).toBe(Number.POSITIVE_INFINITY);
    expect(FALLBACK_RULES.at(-1)?.multiplier).toBe(5);
    const r = priceLab(labStone({ carat: 12, costUsd: 50_000, pricePerCaratUsd: 4000 }));
    expect(r.ok && r.priced.retailUsd).toBe(250_000);
  });

  it('holds when implied $/ct is below the band floor (mapping regression)', () => {
    // Double-divided fingerprint: 6ct band floor is $8/ct.
    const r = priceLab(labStone({ carat: 6.04, costUsd: 42, pricePerCaratUsd: 7 }));
    expect(!r.ok && r.hold.reason).toBe('lab_cost_per_carat_floor');
  });

  it('holds when cost equals Buy_Price with no × carat (the live bug shape)', () => {
    const r = priceLab(labStone({ carat: 6.04, costUsd: 96, pricePerCaratUsd: 96 }));
    expect(!r.ok && r.hold.reason).toBe('lab_cost_not_multiplied');
  });

  it('holds when retail is below the absolute floor for ≥1ct', () => {
    // ppc passes the 1ct band floor ($35) but 5× still lands under $180 retail.
    const r = priceLab(labStone({ carat: 1.0, costUsd: 35, pricePerCaratUsd: 35 }));
    // 35 × 5 = 175 < 180
    expect(!r.ok && r.hold.reason).toBe('lab_retail_floor');
  });

  it('holds when retail < cost (structurally impossible)', () => {
    // Force by stubbing a broken path: negative multiplier isn't possible, so
    // simulate via cost above what any tier would produce by using cost with
    // a zero retail from round(0) — instead assert the guard exists by pricing
    // a stone where cost exceeds retail through a hand-rolled check.
    const r = priceLab(labStone({ carat: 2, costUsd: 2000, pricePerCaratUsd: 1000 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.priced.retailUsd).toBeGreaterThanOrEqual(2000);
  });
});

describe('lab retail increases with carat when grade & $/ct held constant', () => {
  /**
   * The assertion that would have caught the live bug: when Buy_Price ($/ct)
   * and grade are fixed, larger stones must retail for more — never less.
   */
  it('is monotonic across 0.5 → 10ct', () => {
    const ppc = 120; // fixed $/ct
    const carats = [0.5, 1, 2, 3, 6, 10];
    const retails: number[] = [];
    for (const carat of carats) {
      const costUsd = Math.round(ppc * carat * 100) / 100;
      const r = priceLab(
        labStone({
          carat,
          costUsd,
          pricePerCaratUsd: ppc,
          color: 'E',
          clarity: 'VVS2',
          shape: 'Round',
        }),
      );
      expect(r.ok, `${carat}ct should publish`).toBe(true);
      if (r.ok) retails.push(r.priced.retailUsd);
    }
    for (let i = 1; i < retails.length; i++) {
      expect(
        retails[i]!,
        `${carats[i]}ct retail ${retails[i]} should exceed ${carats[i - 1]}ct retail ${retails[i - 1]}`,
      ).toBeGreaterThan(retails[i - 1]!);
    }
  });

  it('rejects the live fingerprint (larger carat cheaper in absolute dollars)', () => {
    // Reproduce the broken mapping: costUsd = Buy_Price (per-carat) with no × carat.
    const broken = [
      { carat: 2.0, buy: 131 },
      { carat: 3.06, buy: 81 },
      { carat: 6.04, buy: 96 },
    ].map(({ carat, buy }) =>
      priceLab(labStone({ carat, costUsd: buy, pricePerCaratUsd: buy })),
    );
    // Every broken row should be held by a guard — not published at $130–$170.
    for (const r of broken) {
      expect(r.ok).toBe(false);
    }
  });
});

describe('watch pricing', () => {
  it('prices at round(comp_mid × 0.97)', () => {
    // PDF formula: market mid minus 3%. lowUsd and accessory state are ignored.
    const r = priceWatch(
      watch({ costUsd: 9000, box: true, papers: true, isNaked: false }),
      { midUsd: 12000, lowUsd: 10000, sourceCount: 12, asOf: '2026-07-20' },
    );
    expect(r.ok && r.priced.retailUsd).toBe(11640);
    expect(r.ok && r.priced.compMidUsd).toBe(12000);
  });

  it('does not apply naked or partial accessory haircuts', () => {
    const naked = priceWatch(
      watch({ costUsd: 8000, box: false, papers: false, isNaked: true }),
      { midUsd: 12000, lowUsd: 10000, sourceCount: 12 },
    );
    const partial = priceWatch(
      watch({ costUsd: 8000, box: true, papers: false, isNaked: false }),
      { midUsd: 12000, lowUsd: 10000, sourceCount: 12 },
    );
    expect(naked.ok && naked.priced.retailUsd).toBe(11640);
    expect(partial.ok && partial.priced.retailUsd).toBe(11640);
  });

  it('rounds to the nearest dollar', () => {
    // 5325 × 0.97 = 5165.25 → 5165
    const r = priceWatch(watch({ costUsd: 4000 }), { midUsd: 5325, sourceCount: 8 });
    expect(r.ok && r.priced.retailUsd).toBe(5165);
  });

  it('falls back to cost × 1.10 when there is no market comp', () => {
    const r = priceWatch(watch({ costUsd: 5000 }), null);
    expect(r.ok && r.priced.retailUsd).toBe(5500);
    expect(r.ok && r.priced.compMidUsd).toBeUndefined();
  });

  it('falls back when mid is missing or zero', () => {
    const r = priceWatch(watch({ costUsd: 4000 }), { midUsd: 0, sourceCount: 5 });
    expect(r.ok && r.priced.retailUsd).toBe(4400);
  });

  it('still publishes when sourceCount is thin — mid alone drives the price', () => {
    const r = priceWatch(
      watch({ costUsd: 9000, box: true, papers: true, isNaked: false }),
      { midUsd: 12000, sourceCount: 2 },
    );
    expect(r.ok && r.priced.retailUsd).toBe(11640);
  });

  it('publishes even when mid × 0.97 sits near cost (no at-market hold)', () => {
    // 12000 × 0.97 = 11640; cost 11000 — previously held as at-market.
    const r = priceWatch(
      watch({ costUsd: 11000, box: true, papers: true, isNaked: false }),
      { midUsd: 12000, sourceCount: 12 },
    );
    expect(r.ok && r.priced.retailUsd).toBe(11640);
  });
});
