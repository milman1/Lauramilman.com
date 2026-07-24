/**
 * LMNY pricing configuration.
 *
 * This file is the single source of truth for markup rules. Pricing changes
 * happen via pull request against this file — never via database pokes or
 * ad-hoc edits in Shopify admin.
 *
 * ⚠️ RECONSTRUCTION NOTICE: the original `markup_rules` seed from the
 * pre-Shopify prototype was lost (the lmny-feeds folder was never pushed).
 * The lab tiers below are a reconstruction that averages ~1.55x per the
 * confirmed business rules. Review and correct before the first live sync.
 */

/** Natural diamonds: retail = Rapaport list × rapDiscount, held if margin < minMarginPct. */
export const NATURAL = {
  rapDiscount: 0.75,
  /** (retail − cost) / retail must be ≥ this, else the stone is held. */
  minMarginPct: 0.2,
} as const;

export interface LabTier {
  /** Tier applies to carat weights ≤ maxCarat. First matching tier wins. */
  maxCarat: number;
  /** retail = feed cost × multiplier */
  multiplier: number;
}

/**
 * Lab-grown markup tiers, applied to feed cost by carat weight.
 * Imported by markup.ts as its FALLBACK_RULES.
 */
export const LAB_TIERS: LabTier[] = [
  { maxCarat: 0.5, multiplier: 1.7 },
  { maxCarat: 1.0, multiplier: 1.62 },
  { maxCarat: 2.0, multiplier: 1.55 },
  { maxCarat: 3.0, multiplier: 1.5 },
  { maxCarat: Number.POSITIVE_INFINITY, multiplier: 1.45 },
];

/** Watches: retail = Hours comp mid × compDiscount, floored at cost × minCostMultiple. */
export const WATCH = {
  compDiscount: 0.97,
  minCostMultiple: 1.05,
} as const;

/** Quality gates for stones (natural and lab). Worst grade allowed through. */
export const STONE_GATES = {
  worstColor: 'L',
  worstClarity: 'SI2',
} as const;

/**
 * Watch curation: only these brands are considered for listing.
 * ⚠️ Reconstruction — the original curated list lived in the lost normalize.ts.
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
