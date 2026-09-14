/**
 * Watch catalog gates applied at normalize (before pricing).
 *
 * Held watches are never created; already-live ones archive as
 * `held_in_feed` so they can return if the feed row later qualifies.
 *
 * Partner we publish: Belgium Watch (ROMAN).
 * All other partner books are held out, including TLV Watches and Vivid
 * Watches. The sync derives an allowlist from the ROMAN branch so the rule
 * also applies to future stock numbers without relying on SKU prefixes.
 *
 * Also required: papers (Paper = YES). Held out: aftermarket *condition*,
 * comment containing "naked", comment containing "iced out".
 * A Comment of "DIAL AFTERMARKET" on a Retail Ready piece is not held
 * (`8114` GMT 116718LN). That book is 115 watches to sell.
 */

/** Partner books that never publish. Match is case-insensitive / substring. */
export const EXCLUDED_WATCH_PARTNERS = [
  'tlv watches llc',
  'tlv watches',
  'vivid watches llc',
  'vivid watches',
  'power watch llc',
  'power watch',
  'uncle manny llc',
  'uncle manny',
] as const;

/**
 * Website Branch values for the books we do publish. Used to build a stock
 * allowlist because the developer API often omits Branch, and Uncle Manny's
 * numeric stock numbers look like Belgium Watch's.
 */
export const ALLOWED_WATCH_PARTNER_BRANCHES = [
  'ROMAN',
] as const;

/** Power Watch `P####`, Uncle Manny `U####` / `M####` (memo). */
export const EXCLUDED_WATCH_STOCK_RE = /^(?:P|U|M)\d+/i;
