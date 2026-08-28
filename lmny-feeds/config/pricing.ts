/**
 * LMNY pricing configuration.
 *
 * This file is the single source of truth for markup rules. Pricing changes
 * happen via pull request against this file — never via database pokes or
 * ad-hoc edits in Shopify admin.
 *
 * Guards in markup.ts fail closed if the Belgium Dia cost mapping regresses
 * (e.g. treating $/ct as total).
 */

/**
 * Belgium Dia Amount $ is portal asking wholesale. LMNY's invoice on stock
 * 350393 (5.01ct Emerald, Amount $106,463) was ~$71k — exactly Amount × 2/3
 * (one-third of Rapaport list, or 17 extra Rap points past the listed −50).
 * That share is the cost basis for every natural and lab-grown stone.
 *
 * Ticket for both kinds is cost × 1.25 (20% margin-on-retail).
 */
export const DIAMOND = {
  /** LMNY pays this fraction of the Amount column (portal asking wholesale). */
  supplierAmountShare: 2 / 3,
  /** retail = round(LMNY cost × this) for lab and natural. 1.25× = 20% margin. */
  amountMultiple: 1.25,
  /** (retail − cost) / retail must be ≥ this, else the stone is held. */
  minMarginPct: 0.2,
} as const;

export function lmnyStoneCost(listAmountUsd: number): number {
  return Math.round(listAmountUsd * DIAMOND.supplierAmountShare * 100) / 100;
}

/** @deprecated Use DIAMOND — lab and natural share the same markup. */
export const NATURAL = DIAMOND;

export interface LabTier {
  /** Tier applies when total costUsd ≤ maxCostUsd. First matching tier wins. */
  maxCostUsd: number;
  /** retail = total cost × multiplier */
  multiplier: number;
}

/**
 * Lab used to have cost-band multipliers (1.45×–1.70×). Lab and natural now
 * share `DIAMOND.amountMultiple`. One unbounded row keeps FALLBACK_RULES /
 * lab-analysis working.
 */
export const LAB_TIERS: LabTier[] = [
  { maxCostUsd: Number.POSITIVE_INFINITY, multiplier: DIAMOND.amountMultiple },
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
   * aggressive 1ct memo pricing (~$150 after 1.25× on ~$120/ct listed).
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
