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
 * Belgium Dia Amount $ is portal asking wholesale. LMNY's invoice on stock
 * 350393 (5.01ct Emerald, Amount $106,463) was ~$71k — exactly Amount × 2/3
 * (one-third of Rapaport list, or 17 extra Rap points past the listed −50).
 * That share is the cost basis for every natural and lab-grown stone.
 */
export const DIAMOND = {
  /** LMNY pays this fraction of the Amount column (portal asking wholesale). */
  supplierAmountShare: 2 / 3,
} as const;

export function lmnyStoneCost(listAmountUsd: number): number {
  return Math.round(listAmountUsd * DIAMOND.supplierAmountShare * 100) / 100;
}

/**
 * Natural diamonds: ticket = round(LMNY cost × amountMultiple).
 * Cost is Amount × 2/3, so 1.5× puts retail on the Amount column
 * (33% margin-on-retail). Stock 350393: cost $70,975.33 → retail $106,463.
 *
 * Rap ($) is per carat, not a total. Old retail Rap × 0.75 = $31,875 on
 * this stone was below wholesale. `minMarginPct` is a safety filter if
 * the multiple is lowered later.
 */
export const NATURAL = {
  /** retail = round(LMNY cost × this). With 2/3 cost, 1.5× ≈ Amount. */
  amountMultiple: 1.5,
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
 * Lab-grown markup tiers on **LMNY cost** (Amount × 2/3, else Buy_Price × carat × 2/3).
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
   * Absolute retail floor for stones ≥ minCaratForRetailFloor, quoted on
   * **portal Amount** dollars. markup.ts scales by `DIAMOND.supplierAmountShare`
   * because LMNY cost (and therefore retail) is 2/3 of Amount.
   * Catches the live bug ($96–$170 listed retails) without blocking
   * aggressive 1ct memo pricing (~$200 after 1.7× on ~$120/ct listed).
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
 * Hours comps are not used. Aftermarket rows are excluded at normalize.
 * Missing cost → hold with tag `pricing-review`; existing Shopify price
 * is left alone.
 *
 *   Under $5,000          1.30×  round up to $100
 *   $5,000 – $15,000      1.20×  round up to $100, min $6,500
 *   $15,001 – $40,000     1.12×  round up to $100, min $18,000
 *   Above $40,000         1.08×  round up to $100, min $44,800
 */
export const WATCH = {
  /** Tag applied when pricing returns no_cost. */
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
