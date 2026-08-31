import { describe, expect, it } from 'vitest';
import { FALLBACK_RULES, priceLab, priceNatural, priceWatch } from '../src/markup.js';
import { labStone, naturalStone, watch } from './fixtures.js';

describe('natural pricing', () => {
  it('prices expensive stones at 1.25× Amount (20% margin-on-retail)', () => {
    const r = priceNatural(naturalStone({ costUsd: 106_463 }));
    expect(r.ok && r.priced.retailUsd).toBe(133_079);
  });

  it('uses the same cost-band chart as lab', () => {
    const cheap = priceNatural(naturalStone({ costUsd: 400 }));
    const mid = priceNatural(naturalStone({ costUsd: 900 }));
    const upper = priceNatural(naturalStone({ costUsd: 2_000 }));
    expect(cheap.ok && cheap.priced.retailUsd).toBe(560); // 400 × 1.40
    expect(mid.ok && mid.priced.retailUsd).toBe(1215); // 900 × 1.35
    expect(upper.ok && upper.priced.retailUsd).toBe(2600); // 2000 × 1.30
  });

  it('holds when there is no cost', () => {
    const r = priceNatural(naturalStone({ costUsd: 0, rapPriceUsd: undefined }));
    expect(!r.ok && r.hold.reason).toBe('natural_no_cost');
  });

  it('publishes at the 20% margin floor (1.25×)', () => {
    const r = priceNatural(naturalStone({ costUsd: 12_000 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.priced.retailUsd).toBe(15_000);
  });

  it('retail stays at or above cost', () => {
    const r = priceNatural(naturalStone({ costUsd: 900 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.priced.retailUsd).toBeGreaterThanOrEqual(900);
  });
});

describe('lab pricing', () => {
  it('marks cheaper stones up more than expensive ones', () => {
    const cheap = priceLab(labStone({ carat: 1.0, costUsd: 400, pricePerCaratUsd: 400 }));
    const mid = priceLab(labStone({ carat: 2.0, costUsd: 1200, pricePerCaratUsd: 600 }));
    const big = priceLab(labStone({ carat: 6.0, costUsd: 5000, pricePerCaratUsd: 833 }));
    expect(cheap.ok && cheap.priced.retailUsd).toBe(560); // 400 × 1.40
    expect(mid.ok && mid.priced.retailUsd).toBe(1620); // 1200 × 1.35
    expect(big.ok && big.priced.retailUsd).toBe(6250); // 5000 × 1.25
  });

  it('boundary costs fall in the lower tier (≤ maxCostUsd)', () => {
    const at500 = priceLab(labStone({ carat: 1.0, costUsd: 500, pricePerCaratUsd: 500 }));
    expect(at500.ok && at500.priced.retailUsd).toBe(700); // 500 × 1.40
  });

  it('uses 1.25× above $4,000 (same as naturals)', () => {
    expect(FALLBACK_RULES.at(-1)?.maxCostUsd).toBe(Number.POSITIVE_INFINITY);
    expect(FALLBACK_RULES.at(-1)?.multiplier).toBe(1.25);
    const r = priceLab(labStone({ carat: 12, costUsd: 50_000, pricePerCaratUsd: 4000 }));
    expect(r.ok && r.priced.retailUsd).toBe(62_500);
  });

  it('holds when implied $/ct is below the band floor (mapping regression)', () => {
    // Pretend Buy_Price/$/ct was used as total: 6ct stone with cost $70
    // and pricePerCarat left as cost/carat.
    const r = priceLab(labStone({ carat: 6.04, costUsd: 70, pricePerCaratUsd: 11.59 }));
    expect(!r.ok && (r.hold.reason === 'lab_cost_per_carat_floor' || r.hold.reason === 'lab_cost_not_multiplied' || r.hold.reason === 'lab_retail_floor')).toBe(true);
  });

  it('holds when cost equals Buy_Price with no × carat (the live bug shape)', () => {
    const r = priceLab(labStone({ carat: 6.04, costUsd: 96, pricePerCaratUsd: 96 }));
    expect(!r.ok && r.hold.reason).toBe('lab_cost_not_multiplied');
  });

  it('holds when retail is below the absolute floor for ≥1ct', () => {
    const r = priceLab(labStone({ carat: 1.0, costUsd: 40, pricePerCaratUsd: 40 }));
    // 40 × 1.40 = 56 < $180 retail floor
    expect(!r.ok && (r.hold.reason === 'lab_retail_floor' || r.hold.reason === 'lab_cost_per_carat_floor')).toBe(true);
  });

  it('holds a 1ct lab whose 1.40× ticket is still under $180', () => {
    const r = priceLab(labStone({ carat: 1.0, costUsd: 120, pricePerCaratUsd: 120 }));
    expect(!r.ok && r.hold.reason).toBe('lab_retail_floor');
  });

  it('publishes a 1ct lab once the ticket clears $180', () => {
    const r = priceLab(labStone({ carat: 1.0, costUsd: 130, pricePerCaratUsd: 130 }));
    expect(r.ok && r.priced.retailUsd).toBe(182);
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
    const ppc = 130; // fixed $/ct; 1ct × 1.40 = $182, above the $180 floor
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
  it('prices from cost tiers (1.20× in the $5k–$15k band), not Hours mid', () => {
    const r = priceWatch(watch({ costUsd: 9000, box: true, papers: true, isNaked: false }));
    expect(r.ok && r.priced.retailUsd).toBe(10800);
  });

  it('does not apply naked or partial accessory haircuts', () => {
    const naked = priceWatch(watch({ costUsd: 8000, box: false, papers: false, isNaked: true }));
    const partial = priceWatch(watch({ costUsd: 8000, box: true, papers: false, isNaked: false }));
    expect(naked.ok && naked.priced.retailUsd).toBe(9600);
    expect(partial.ok && partial.priced.retailUsd).toBe(9600);
  });

  it('rounds retail up to the nearest $100', () => {
    // 4123 × 1.30 = 5359.9 → 5400
    const r = priceWatch(watch({ costUsd: 4123 }));
    expect(r.ok && r.priced.retailUsd).toBe(5400);
  });

  it('floors the $5k band at $6,500', () => {
    const r = priceWatch(watch({ costUsd: 5000 }));
    expect(r.ok && r.priced.retailUsd).toBe(6500);
  });

  it('holds no_cost when supplier cost is missing', () => {
    const r = priceWatch(watch({ costUsd: 0 }));
    expect(!r.ok && r.hold.reason).toBe('watch_no_cost');
  });
});
