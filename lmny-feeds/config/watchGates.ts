/**
 * Watch catalog gates applied at normalize (before pricing).
 *
 * Held watches are never created; already-live ones archive as
 * `held_in_feed` so they can return if the feed row later qualifies.
 *
 * Partner we publish from the ROMAN allowlist: Belgium Watch.
 * TLV Watches (`TLV WATCHES LLC`) are imported by a separate stock list in
 * normalize: same papers and condition gates, no `ebay` tag. Vivid Watches
 * and every other book stay held out. The ROMAN allowlist is not a SKU-prefix
 * guess, so a future stock number from another book is not inferred in.
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

/**
 * Website branch for TLV Watches. Stocks on this branch are imported into
 * Shopify and may carry `uploadify_active`. They are not added to
 * `ALLOWED_WATCH_PARTNER_BRANCHES`, so Vivid and every other book stay out,
 * and they are not given the `ebay` tag.
 */
export const TLV_WATCH_PARTNER_BRANCH = 'TLV WATCHES LLC';

/** Power Watch `P####`, Uncle Manny `U####` / `M####` (memo). */
export const EXCLUDED_WATCH_STOCK_RE = /^(?:P|U|M)\d+/i;
