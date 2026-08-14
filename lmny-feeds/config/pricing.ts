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
 * Watches: retail from supplier cost tiers (see src/watchPricing.ts).
 *
 * Comps are audit / review-gate only — never enter the retail calculation.
 * Aftermarket rows are excluded at normalize (and again in the pricing
 * function if the flag is passed). Missing cost or retail >40% under mid
 * → hold with tag `pricing-review`; existing Shopify price is left alone.
 *
 * Historical note: through 2026-08 live prices were round(comp_mid × 0.97),
 * which could land under cost (e.g. some Audemars Piguet rows). Replaced by
 * cost-tier markup on 2026-08-14.
 */
export const WATCH = {
  /** Tag applied when pricing returns needs_review or no_cost. */
  reviewTag: 'pricing-review',
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
