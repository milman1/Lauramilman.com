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
 * Belgium Dia Amount $ is LMNY's invoice cost for every natural and
 * lab-grown stone. Stock 350393 (5.01ct Emerald): Amount $106,463.
 *
 * Ticket follows the same cost chart for both kinds.
 */
export const DIAMOND = {
  /** Natural and lab retail floor above $4,000 Amount. 1.25× = 20% margin. */
  amountMultiple: 1.25,
  /** (retail − cost) / retail must be ≥ this, else the stone is held. */
  minMarginPct: 0.2,
} as const;

/** @deprecated Use the Amount column as cost — no extra share. */
export function lmnyStoneCost(amountUsd: number): number {
  return Math.round(amountUsd * 100) / 100;
}

/** Naturals use the same STONE_TIERS chart as lab. */
export const NATURAL = DIAMOND;

export interface LabTier {
  /** Tier applies when total costUsd ≤ maxCostUsd. First matching tier wins. */
  maxCostUsd: number;
  /** retail = total cost × multiplier */
  multiplier: number;
}

/**
 * Lab and natural markup on **Amount** (invoice cost). First match wins.
 *
 *   ≤ $500     1.40×  ~29% margin
 *   ≤ $1,500   1.35×  ~26% margin
 *   ≤ $4,000   1.30×  ~23% margin
 *   above      1.25×  20% margin
 */
export const STONE_TIERS: LabTier[] = [
  { maxCostUsd: 500, multiplier: 1.4 },
  { maxCostUsd: 1500, multiplier: 1.35 },
  { maxCostUsd: 4000, multiplier: 1.3 },
  { maxCostUsd: Number.POSITIVE_INFINITY, multiplier: DIAMOND.amountMultiple },
];

/** @deprecated Use STONE_TIERS — lab and natural share the chart. */
export const LAB_TIERS = STONE_TIERS;

/**
 * Fail-closed floors for lab stones. A mapping bug that treats $/ct as total
 * lands every size in ~$50–$200 cost and trips these immediately.
 */
export const LAB_GUARDS = {
  /**
   * Absolute site-price floor for stones ≥ minCaratForRetailFloor.
   * Catches the live bug ($96–$170 tickets when Buy_Price was used as a
   * total). 1ct Amount $120 → $168 is held; Amount $130 → $182 publishes.
   */
  minRetailUsd: 180,
  minCaratForRetailFloor: 1.0,
  /**
   * Minimum acceptable Amount $/ct by carat band. First match wins.
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

/** Quality gates for natural stones. Worst grade allowed through. */
export const STONE_GATES = {
  worstColor: 'L',
  worstClarity: 'SI2',
} as const;

/**
 * Lab-grown loose diamonds are merchandised as fine jewelry, not commercial
 * melee. Anything past these floors is held at normalize, unpublished from
 * the storefront API, and deleted from Shopify on the next successful lab
 * sync so it cannot come back.
 */
export const LAB_GATES = {
  worstColor: 'G',
  worstClarity: 'VS2',
  /** Ungraded fancy shapes pass; known Good/Fair/Poor do not. */
  worstCut: 'Very Good',
  certLabs: ['IGI', 'GIA', 'GCAL', 'HRD', 'AGS'] as const,
} as const;

/** Sidestone / novelty shapes — not solitaire loose diamonds. */
export const LAB_SIDESTONE_SHAPES: readonly string[] = [
  'Baguette',
  'Trapezoid',
  'Bullet',
  'Halfmoon',
  'Shield',
  'Kite',
  'Kite Step Cut',
  'Triangle',
  'Trilliant',
  'Hexagonal',
  'Hexagon Step',
  'Hexagonal Modified Brill',
  'Lozenge',
  'Lozenge Step Cut',
  'Capsule',
  'Pentagonal',
  'Pentagonal Step',
  'Pentagonal Modified Bril',
  'Octagonal',
  'Octagonal Step Cut',
  'Cadillac',
  'Star',
  'Round Star',
  'Horse Head',
  'Lily',
  'Butterfly',
  'Briolette',
  'Lady Heart',
];

export const LAB_QUALITY_HOLD_REASONS = new Set([
  'lab_color_below_floor',
  'lab_clarity_below_floor',
  'lab_cut_below_floor',
  'lab_uncertified',
  'lab_sidestone_shape',
]);

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
