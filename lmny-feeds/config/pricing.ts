/**
 * LMNY pricing configuration.
 *
 * This file is the single source of truth for markup rules. Pricing changes
 * happen via pull request against this file — never via database pokes or
 * ad-hoc edits in Shopify admin.
 *
 * Every source has its own rule and its own constant; there is no
 * store-wide multiplier. The full matrix (including the sources that are
 * merchant-set and deliberately not in code) is AGENTS.md section 2a.
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
 * Hours comps are not used. Aftermarket, no-papers, iced-out, naked-comment,
 * Power Watch LLC, and Uncle Manny LLC rows are excluded at normalize.
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

/**
 * The Back Vault (estate / vintage designer jewelry, src/backvault/).
 *
 * The supplier's listed price is LMNY's cost. Retail is a flat markup over
 * that cost, and the cost is written to Shopify **Cost per item**
 * (`inventoryItem.cost`) so margin shows next to Price in Admin.
 *
 *   matched on a competitor:  retail = max((cost + competitor) / 2, cost + $500)
 *   no competitor match:      retail = cost + $500
 *
 * The competitor is Robinson's Jewelers, which stocks the same supplier
 * pieces; the match key is the supplier stock number
 * (src/backvault/competitor.ts). Never a fuzzy title match.
 */
export const BACKVAULT = {
  /** Flat dollar markup added to the supplier's listed (cost) price. */
  markupUsd: 500,
  competitor: {
    name: "Robinson's Jewelers",
    baseUrl: 'https://robinsonsjewelers.com',
  },
} as const;

/**
 * Royal Chain basic chains ONLY (AGENTS.md section 2a and recipe H).
 * Retail is a straight multiple of the wholesale cost read from the
 * merchant's Royal Chain trade account. Only trending items are imported,
 * never a whole category.
 *
 *   retail = roundUpTo5(cost × 3)
 *
 * This multiple applies to no other source. Watches, loose stones, and
 * Back Vault pieces have their own rules above; Laura Milman fine
 * jewelry, Peaceful Diamonds lab-grown jewelry, and hand-imported estate
 * pieces are merchant-set and have no automated rule. A new supplier gets
 * its own constant here, never this one.
 */
export const SUPPLIER_INTAKE = {
  supplier: 'Royal Chain',
  costMultiple: 3,
  roundUpToUsd: 5,
} as const;

export function supplierRetailFromCost(costUsd: number): number {
  if (!Number.isFinite(costUsd) || costUsd <= 0) {
    throw new Error(`Supplier pricing: invalid cost ${costUsd}`);
  }
  const raw = costUsd * SUPPLIER_INTAKE.costMultiple;
  return Math.ceil(raw / SUPPLIER_INTAKE.roundUpToUsd) * SUPPLIER_INTAKE.roundUpToUsd;
}
