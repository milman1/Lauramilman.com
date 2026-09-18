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
 */
export const DIAMOND = {
  /** Natural-diamond retail floor above $4,000 Amount. 1.25× = 20% margin. */
  amountMultiple: 1.25,
  /** (retail − cost) / retail must be ≥ this, else the stone is held. */
  minMarginPct: 0.2,
} as const;

/** @deprecated Use the Amount column as cost — no extra share. */
export function lmnyStoneCost(amountUsd: number): number {
  return Math.round(amountUsd * 100) / 100;
}

/** Naturals use the tiered STONE_TIERS chart. */
export const NATURAL = DIAMOND;

export interface LabTier {
  /** Tier applies when total costUsd ≤ maxCostUsd. First matching tier wins. */
  maxCostUsd: number;
  /** retail = total cost × multiplier */
  multiplier: number;
}

/**
 * Natural-diamond markup on **Amount** (invoice cost). First match wins.
 *
 *   ≤ $4,000   1.40×  ~29% margin
 *   above      1.25×  20% margin
 *
 * Merchant decision 2026-09-17: collapse the old 1.35× / 1.30× bands into
 * 1.40× through $4,000 (typical 1ct tickets). Stones above $4,000 stay at
 * 1.25× so large-carat naturals do not jump with the small-stone lift.
 */
export const STONE_TIERS: LabTier[] = [
  { maxCostUsd: 4000, multiplier: 1.4 },
  { maxCostUsd: Number.POSITIVE_INFINITY, multiplier: DIAMOND.amountMultiple },
];

/**
 * Loose lab-grown diamonds: 2.50× when invoice cost is ≤ $500, otherwise
 * the 1.50× default. Fail-closed $/ct guards still apply.
 *
 * The storefront's 10% welcome discount remains eligible. Realized revenue
 * is 2.25× cost on the small band (55.6% gross before fees) and 1.35× cost
 * above $500 (25.9% gross before fees).
 *
 * Merchant decision 2026-09-17: raise only cheap labs (cost ≤ $500). Larger
 * lab tickets stay at 1.50× so high-carat stones do not reprice with the
 * small-stone lift.
 */
export const LOOSE_LAB_GROWN = {
  costMultiple: 1.5,
  smallCostMaxUsd: 500,
  smallCostMultiple: 2.5,
  welcomeDiscountPct: 0.1,
} as const;

/** Invoice-cost multiple for a loose lab stone. First matching LAB_TIERS row. */
export function labRetailMultipleFromCost(costUsd: number): number {
  return costUsd <= LOOSE_LAB_GROWN.smallCostMaxUsd
    ? LOOSE_LAB_GROWN.smallCostMultiple
    : LOOSE_LAB_GROWN.costMultiple;
}

/** @deprecated Use labRetailMultipleFromCost for loose lab stones. */
export const LAB_TIERS: LabTier[] = [
  { maxCostUsd: LOOSE_LAB_GROWN.smallCostMaxUsd, multiplier: LOOSE_LAB_GROWN.smallCostMultiple },
  { maxCostUsd: Number.POSITIVE_INFINITY, multiplier: LOOSE_LAB_GROWN.costMultiple },
];

/**
 * Fail-closed floors for lab stones. A mapping bug that treats $/ct as total
 * lands every size in ~$50–$200 cost and trips these immediately.
 */
export const LAB_GUARDS = {
  /**
   * Absolute site-price floor for stones ≥ minCaratForRetailFloor.
   * Catches the live bug ($96–$170 tickets when Buy_Price was used as a
   * total). 1ct Amount $70 → $175 is held; Amount $72 → $180 publishes.
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
 * Watches from the Belgium Dia / deal API (product type `Watch`, handle `w-`).
 * Retail from supplier unit cost only. Hours comps are not used.
 * Aftermarket, no-papers, iced-out, naked-comment, Power Watch LLC, and
 * Uncle Manny LLC rows are excluded at normalize. Missing cost → hold with
 * tag `pricing-review`; existing Shopify price is left alone.
 *
 * Chart (first matching band wins); applied in `src/watchPricing.ts`:
 *   Under $5,000          1.30×  round up to $100
 *   $5,000 – $15,000      1.20×  round up to $100, min $6,500
 *   $15,001 – $40,000     1.12×  round up to $100, min $18,000
 *   Above $40,000         1.08×  round up to $100, min $44,800
 */
export const WATCH_COST_TIERS = [
  { maxCostUsd: 5_000, maxInclusive: false, multiplier: 1.3, minRetailUsd: 0 },
  { maxCostUsd: 15_000, maxInclusive: true, multiplier: 1.2, minRetailUsd: 6_500 },
  { maxCostUsd: 40_000, maxInclusive: true, multiplier: 1.12, minRetailUsd: 18_000 },
  { maxCostUsd: Number.POSITIVE_INFINITY, maxInclusive: true, multiplier: 1.08, minRetailUsd: 44_800 },
] as const;

export type WatchCostTier = (typeof WATCH_COST_TIERS)[number];

export const WATCH = {
  /** Tag applied when pricing returns no_cost. */
  reviewTag: 'pricing-review',
  costTiers: WATCH_COST_TIERS,
} as const;

/**
 * Lab-grown jewelry (finished pieces — Peaceful Diamonds / lab-tagged SKUs).
 * Distinct from loose Lab-Grown Diamond feed items priced by
 * `LOOSE_LAB_GROWN`.
 * Not sourced from the Belgium Dia diamond API.
 *
 *   retail = round(cost × 4)
 *
 * Cost is the merchant's wholesale / invoice cost on the piece (Shopify
 * Cost per item when recorded). Do not apply stone, watch, Back Vault,
 * Royal Chain, or Skylab rules to these products.
 */
export const LAB_GROWN_JEWELRY = {
  vendors: ['Peaceful Diamonds'] as const,
  /** Common Peaceful Diamonds SKU prefixes observed on the store. */
  skuPrefixes: ['BC14', 'NK14'] as const,
  /** retail = cost × this. */
  costMultiple: 4,
} as const;

/** Retail for lab-grown jewelry from recorded wholesale cost. */
export function labGrownJewelryRetailFromCost(costUsd: number): number {
  if (!Number.isFinite(costUsd) || costUsd <= 0) {
    throw new Error(`Lab-grown jewelry pricing: invalid cost ${costUsd}`);
  }
  return Math.round(costUsd * LAB_GROWN_JEWELRY.costMultiple);
}

/**
 * Skylab bridal intake (complete engagement rings and the smaller settings
 * book). Merchant decision 2026-09-18.
 *
 *   retail = round(cost × 3)
 *
 * Own constant: do not call `supplierRetailFromCost` (Royal Chain, round up
 * to $5) or `labGrownJewelryRetailFromCost` (Peaceful Diamonds, ×4).
 * Storefront vendor is the house brand. Origin (lab-grown vs natural) is a
 * listing fact copied from the supplier page — most complete rings are lab
 * and labeled there; never assume every SKU is lab. Skip any piece with no
 * recorded cost. Supplier name never appears on the store.
 */
export const SKYLAB = {
  supplier: 'Skylab',
  houseVendor: 'Laura Milman New York',
  costMultiple: 3,
} as const;

/** Retail for a Skylab complete ring or setting from recorded wholesale cost. */
export function skylabRetailFromCost(costUsd: number): number {
  if (!Number.isFinite(costUsd) || costUsd <= 0) {
    throw new Error(`Skylab pricing: invalid cost ${costUsd}`);
  }
  return Math.round(costUsd * SKYLAB.costMultiple);
}

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
 * jewelry and hand-imported estate pieces are merchant-set and have no
 * automated rule. Lab-grown jewelry uses `LAB_GROWN_JEWELRY` (×4). Skylab
 * bridal uses `SKYLAB` (×3, nearest dollar). A new supplier gets its own
 * constant here, never this one.
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
