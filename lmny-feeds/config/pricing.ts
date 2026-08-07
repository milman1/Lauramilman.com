/**
 * LMNY pricing configuration.
 *
 * This file is the single source of truth for markup rules. Pricing changes
 * happen via pull request against this file — never via database pokes or
 * ad-hoc edits in Shopify admin.
 *
 * Lab tiers key off **total cost** (not carat). Inventory is virtual (memo),
 * so multiples stay aggressive below market. Guards in markup.ts fail closed
 * if the Belgium Dia cost mapping regresses (e.g. treating $/ct as total).
 */

/**
 * Natural diamonds: retail = Rapaport list × rapDiscount, held if margin <
 * minMarginPct.
 *
 * `minMarginPct` is a **filter, not a floor**: a stone under it is held out of
 * the catalogue entirely (`natural_margin_floor`), never repriced up to reach
 * it. Retail is always exactly Rap × 0.75 — confirmed against all 2,961 live
 * rows on 2026-08-06.
 *
 * It reads as a 25% markup in the data because the 20% is margin-on-retail:
 * retail ≥ cost / (1 − 0.20) = cost × 1.25. Nothing published sits below
 * cost × 1.25 for that reason, and the gate runs at pricing time — a stone
 * whose Rap-implied margin recovers is published on the next run.
 */
export const NATURAL = {
  rapDiscount: 0.75,
  /** (retail − cost) / retail must be ≥ this, else the stone is held. */
  minMarginPct: 0.2,
} as const;

export interface LabTier {
  /** Tier applies when total costUsd ≤ maxCostUsd. First matching tier wins. */
  maxCostUsd: number;
  /** retail = total cost × multiplier */
  multiplier: number;
}

/**
 * Lab-grown markup tiers on **total** feed cost (Buy_Price × carat).
 * Imported by markup.ts as its FALLBACK_RULES.
 *
 * Live on 2026-08-06: retail = round(cost × tier) reproduced 20,847 of 21,764
 * rows exactly. Rounding is `Math.round`, not ceil. The remainder are rows
 * last written before the 2026-08-02 Buy_Price × carat fix, which the schema
 * bump sweeps up on their next update.
 */
export const LAB_TIERS: LabTier[] = [
  { maxCostUsd: 500, multiplier: 1.7 },
  { maxCostUsd: 1500, multiplier: 1.62 },
  { maxCostUsd: 4000, multiplier: 1.55 },
  { maxCostUsd: 10000, multiplier: 1.5 },
  { maxCostUsd: Number.POSITIVE_INFINITY, multiplier: 1.45 },
];

/**
 * Fail-closed floors for lab stones. A mapping bug that treats $/ct as total
 * lands every size in ~$50–$200 cost and trips these immediately.
 */
export const LAB_GUARDS = {
  /**
   * Absolute retail floor for stones ≥ minCaratForRetailFloor.
   * Catches the live bug ($96–$170 retails) without blocking aggressive
   * 1ct memo pricing (~$200 after 1.7× on ~$120/ct).
   */
  minRetailUsd: 180,
  minCaratForRetailFloor: 1.0,
  /**
   * Minimum acceptable Buy_Price ($/ct) by carat band. First match wins.
   * Tuned below live wholesale p10 so real cheap large stones pass, but a
   * double-divided or zeroed cost cannot.
   */
  minCostPerCarat: [
    { maxCarat: 1.0, minUsd: 35 },
    { maxCarat: 2.0, minUsd: 25 },
    { maxCarat: 3.0, minUsd: 18 },
    { maxCarat: 5.0, minUsd: 12 },
    { maxCarat: 10.0, minUsd: 8 },
    { maxCarat: Number.POSITIVE_INFINITY, minUsd: 5 },
  ],
} as const;

/**
 * Watches: retail = round(comp_mid_usd × compDiscount).
 *
 * Confirmed against every feed watch last synced on or before 2026-08-02.
 * Runs from 2026-08-03 onward briefly priced off a low→mid blend + accessory
 * haircut, which put live prices 9–30% under mid × 0.97 with no constant
 * multiple of either cost or mid. Policy is back to mid minus 3%.
 *
 * When Hours returns no mid, fall back to cost × noCompMultiple rather than
 * holding the piece out of the catalogue. Feed rows whose condition is
 * "aftermarket" are excluded at normalize time and never reach pricing.
 */
export const WATCH = {
  /** Market-comp discount: retail = round(mid × this). */
  compDiscount: 0.97,
  /** When no market mid is available: retail = round(cost × this). */
  noCompMultiple: 1.1,
} as const;

/** Quality gates for stones (natural and lab). Worst grade allowed through. */
export const STONE_GATES = {
  worstColor: 'L',
  worstClarity: 'SI2',
} as const;

/**
 * Watch brands that are merchandised under their own storefront collections /
 * Timepieces nav links. Brands outside this list still import (priced the
 * same way) but are tagged `other-watch-brand` and land in the automated
 * "Other Watch Brands" collection.
 *
 * Case-insensitive match.
 */
export const WATCH_BRANDS: string[] = [
  'Rolex',
  'Patek Philippe',
  'Audemars Piguet',
  'Vacheron Constantin',
  'A. Lange & Söhne',
  'Cartier',
  'Omega',
  'Jaeger-LeCoultre',
  'IWC',
  'Breguet',
  'Piaget',
  'Panerai',
  'Hublot',
  'Richard Mille',
  'Tudor',
  'Breitling',
  'Chopard',
  'Girard-Perregaux',
  'Zenith',
  'Ulysse Nardin',
];
