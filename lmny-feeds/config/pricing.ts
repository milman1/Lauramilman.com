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
  /** Lab-grown margin floor multiple (naturals use NATURAL_PRICING). */
  amountMultiple: 1.25,
  /** Lab: (retail − cost) / retail must be ≥ this, else the stone is held. */
  minMarginPct: 0.2,
} as const;

/** @deprecated Use the Amount column as cost — no extra share. */
export function lmnyStoneCost(amountUsd: number): number {
  return Math.round(amountUsd * 100) / 100;
}

export interface LabTier {
  /** Tier applies when total costUsd ≤ maxCostUsd. First matching tier wins. */
  maxCostUsd: number;
  /** retail = total cost × multiplier */
  multiplier: number;
}

/**
 * Natural-diamond pricing: market-anchored, with a hard floor over cost.
 * Everything is integer cents (rates are integer basis points, 10000 = 1.0)
 * so no float ever reaches a price. Source: merchant decision 2026-10-07.
 *
 *   floor  = max(cost × floorMult, cost + floorAbs)
 *   anchor = certComp × undercut → specComp p25 × undercut
 *            → Rap total × k(segment) → cost × fallbackMultiple (no Rap)
 *   retail = anchor rounded DOWN to roundDownCents
 *   retail < floor → HOLD (natural_below_floor). Never rounded up to rescue.
 *
 * Hard rule: no natural ever sells at or below cost. Cost missing, zero,
 * negative or unparseable → HOLD (natural_no_cost). The floor is enforced in
 * `priceNatural` and asserted again at the write path (`assertNaturalFloor`).
 * Compare-at is never set from Rap or from a comp.
 */
export const NATURAL_PRICING = {
  /** NATURAL_FLOOR_MULT: floor is at least cost × this. Must be > 1.0. */
  floorMult: 1.15,
  /** NATURAL_FLOOR_ABS in cents ($250): floor is at least cost + this. Must be > 0. */
  floorAbsCents: 25_000,
  /** COMP_UNDERCUT applied to a cert comp's lowest live retail and a spec comp's p25. */
  compUndercut: 0.98,
  /** SPEC_COMP_MIN_COUNT: a spec comp with fewer comps is ignored. */
  specCompMinCount: 5,
  /** COMP_MAX_AGE_DAYS: older comps are ignored. */
  compMaxAgeDays: 7,
  /** NATURAL_FALLBACK_MULTIPLE: no Rap on the stone → cost × this. */
  fallbackMultiple: 1.5,
  /** Retail is rounded DOWN to a multiple of this ($25). */
  roundDownCents: 2_500,
  /**
   * k(segment) for the Rap fallback: start at `base`, add every matching
   * adjustment, clamp to [min, max]. Recalibrate here, not in code.
   */
  rapK: {
    base: 0.75,
    min: 0.55,
    max: 0.85,
    si1OrSi2: -0.07,
    colorIJKL: -0.05,
    caratUnder1: -0.05,
    carat2Plus: 0.05,
    excellentCutPolishSymmetry: 0.05,
    goodOrFairCut: -0.1,
    fluorMediumPlusOnColorDH: -0.05,
  },
} as const;

/** Rate (e.g. 1.15, 0.98, -0.07) → integer basis points, so math stays integer. */
export function toBps(rate: number): number {
  return Math.round(rate * 10_000);
}

/** Startup validation. Throws (the run refuses to start) on an unsafe config. */
export function validateNaturalPricingConfig(c: typeof NATURAL_PRICING = NATURAL_PRICING): void {
  const bad: string[] = [];
  if (!(Number.isFinite(c.floorMult) && c.floorMult > 1.0)) {
    bad.push(`NATURAL_FLOOR_MULT must be > 1.0 (got ${c.floorMult})`);
  }
  if (!(Number.isInteger(c.floorAbsCents) && c.floorAbsCents > 0)) {
    bad.push(`NATURAL_FLOOR_ABS must be a positive integer of cents (got ${c.floorAbsCents})`);
  }
  if (!(Number.isInteger(c.roundDownCents) && c.roundDownCents > 0)) {
    bad.push(`roundDownCents must be a positive integer (got ${c.roundDownCents})`);
  }
  if (!(c.compUndercut > 0 && c.compUndercut <= 1)) bad.push(`compUndercut must be in (0, 1] (got ${c.compUndercut})`);
  if (!(c.fallbackMultiple > 0)) bad.push(`fallbackMultiple must be > 0 (got ${c.fallbackMultiple})`);
  if (!(c.rapK.min > 0 && c.rapK.min <= c.rapK.max)) bad.push('rapK clamp must satisfy 0 < min <= max');
  if (bad.length > 0) throw new Error(`Natural pricing config invalid: ${bad.join('; ')}`);
}

/**
 * Loose lab-grown diamonds: 3× invoice cost at every size. Fail-closed
 * $/ct guards still apply.
 *
 * The storefront's 10% welcome discount remains eligible. Realized revenue
 * is 2.70× cost (63.0% gross before fees).
 *
 * Merchant decision 2026-09-27: replace the 2.50× / 1.50× split (2.50× only
 * at Amount ≤ $500) with a flat 3×. The old split left high-carat stones,
 * which cross $500 on weight alone, at a thinner markup than small stones.
 */
export const LOOSE_LAB_GROWN = {
  costMultiple: 3,
  welcomeDiscountPct: 0.1,
} as const;

/** Invoice-cost multiple for a loose lab stone. Flat 3× at every size. */
export function labRetailMultipleFromCost(_costUsd: number): number {
  return LOOSE_LAB_GROWN.costMultiple;
}

/** @deprecated Use labRetailMultipleFromCost for loose lab stones. */
export const LAB_TIERS: LabTier[] = [
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
   * total). Scaled with the multiple so the same invoices stay held:
   * at 3×, 1ct Amount $70 → $210 is held; Amount $72 → $216 publishes.
   */
  minRetailUsd: 216,
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
 * Retail is the lowest $100 price that still leaves a share of the selling
 * price after `EBAY_WATCH_FEE` and seller-paid shipping. Shipping is free to
 * the buyer: postage, signature, and packing are the flat amount, and jewelry
 * insurance is the rate times the sale. Carriers cap ordinary watch coverage
 * near $1,000, so the insurance is a third-party policy at about 1% of the sale.
 *
 * A price of $10,000 or under leaves 10% of the sale. Above $10,000 it leaves
 * 5%. The price does not step down as cost rises, so it can sit at $10,000
 * while that leftover eases from 10% to 5%.
 *
 * A stock-number ceiling in `WATCH_RETAIL_CAP_BY_STOCK` may lower that price
 * only while the eBay sale still nets at least cost after shipping. A ceiling
 * that would lose money is ignored.
 */
export const EBAY_WATCH_FEE = {
  perOrderUsd: 0.4,
  /** Each rate applies only to the slice of the price inside the band. */
  bands: [
    { upToUsd: 1_000, rate: 0.15 },
    { upToUsd: 7_500, rate: 0.065 },
    { upToUsd: Number.POSITIVE_INFINITY, rate: 0.03 },
  ],
} as const;

export const WATCH_SALE = {
  /**
   * Share of the selling price left after cost, the eBay watch fee, and
   * shipping, once the price is above `higherMarginMaxPriceUsd`.
   */
  minNetMarginOfPrice: 0.05,
  /** A selling price at or under this keeps the higher margin. */
  higherMarginMaxPriceUsd: 10_000,
  /** Share left when the selling price is at or under $10,000. */
  higherMinNetMarginOfPrice: 0.1,
  /** Seller-paid postage, signature, and packing. The buyer is not charged. */
  shippingFlatUsd: 120,
  /** Third-party jewelry insurance as a share of the selling price. */
  shippingInsuranceRate: 0.01,
} as const;

/**
 * Retail ceiling, in USD, for feed stock numbers whose chart price sits above
 * the highest comparable ask on record, whose cost still fits under that ask,
 * and whose ceiling still nets at least cost after `EBAY_WATCH_FEE` and
 * seller-paid shipping. Rounded down to $100 so the site price is at or under
 * the ask. 114200 (RW3087) and 126234 (T3691) stay on the chart: the ask there
 * is under cost once the fee and shipping are taken out.
 * Keyed by stock number, not reference: a sibling of the same reference that
 * is already under the ask keeps the chart.
 */
export const WATCH_RETAIL_CAP_BY_STOCK: Readonly<Record<string, number>> = {
  T3489: 10_600, // 116234
  T3559: 14_900, // 124060
  T3652: 15_800, // 116713LN
  T3690: 15_900, // 116613LN
  RW3084: 16_500, // 116613LB
  RW3103: 16_500, // 116613LB
  T3590: 26_400, // 116610LV
  RW3100: 49_000, // 126618LB
};

export const WATCH = {
  /** Tag applied when pricing returns no_cost. */
  reviewTag: 'pricing-review',
  sale: WATCH_SALE,
  retailCapByStock: WATCH_RETAIL_CAP_BY_STOCK,
} as const;

/**
 * Lab-grown jewelry (finished pieces — Peaceful Diamonds / lab-tagged SKUs).
 * Distinct from loose Lab-Grown Diamond feed items priced by
 * `LOOSE_LAB_GROWN`.
 * Not sourced from the Belgium Dia diamond API.
 *
 *   retail = cost × 2 (rounded to cents)
 *
 * Cost is the merchant's wholesale / invoice cost on the piece (Shopify
 * Cost per item when recorded). Do not apply stone, watch, Back Vault, or
 * Royal Chain rules to these products.
 */
export const LAB_GROWN_JEWELRY = {
  vendors: ['Peaceful Diamonds'] as const,
  /** Common Peaceful Diamonds SKU prefixes observed on the store. */
  skuPrefixes: ['BC14', 'NK14'] as const,
  /** retail = cost × this. */
  costMultiple: 2,
} as const;

/** Retail for lab-grown jewelry from recorded wholesale cost. */
export function labGrownJewelryRetailFromCost(costUsd: number): number {
  if (!Number.isFinite(costUsd) || costUsd <= 0) {
    throw new Error(`Lab-grown jewelry pricing: invalid cost ${costUsd}`);
  }
  return Math.round(costUsd * LAB_GROWN_JEWELRY.costMultiple * 100) / 100;
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
 * automated rule. Lab-grown jewelry uses `LAB_GROWN_JEWELRY` (×2). A new
 * supplier gets its own constant here, never this one.
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

/**
 * Engagement-ring settings sold without a center stone, for a shopper who
 * pairs the ring with a loose diamond (theme: snippets/ring-diamond-pairing,
 * one hidden "setting-only" variant per ring, SKU SET-<ring handle>).
 * Merchant decision 2026-10-02: retail = setting cost × 3, labor to set the
 * shopper's diamond included in that price. Rounded to the nearest dollar;
 * no other rounding was specified.
 *
 *   retail = round(cost × 3)
 *
 * Settings only. It is not the Royal Chain rule above, even though both are
 * × 3, and it never prices a complete ring with its own center stone.
 */
export const SETTING_ONLY = {
  costMultiple: 3,
  /** Flat add-on in USD for the 18K option on a setting listed in 14K. */
  upcharge18kUsd: 250,
} as const;

export function setting18kRetailFrom14kRetail(retail14kUsd: number): number {
  if (!Number.isFinite(retail14kUsd) || retail14kUsd <= 0) {
    throw new Error(`Setting 18K pricing: invalid 14K retail ${retail14kUsd}`);
  }
  return retail14kUsd + SETTING_ONLY.upcharge18kUsd;
}

export function settingOnlyRetailFromCost(costUsd: number): number {
  if (!Number.isFinite(costUsd) || costUsd <= 0) {
    throw new Error(`Setting-only pricing: invalid cost ${costUsd}`);
  }
  return Math.round(costUsd * SETTING_ONLY.costMultiple);
}
