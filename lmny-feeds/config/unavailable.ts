/**
 * Handles the merchant has confirmed sold / no longer available.
 *
 * These are not Belgium `w-<stock>` SKUs, so the feed diff would otherwise
 * leave them on the storefront. Both the original estate listing and the
 * Back Vault `bv-` copy (when one exists) are listed.
 *
 * Matching is by exact handle, or the same handle with a `bv-` prefix.
 */
export const UNAVAILABLE_PRODUCT_HANDLES = [
  // Hermès Kelly PM Double Tour — estate + Back Vault duplicate
  'hermes-stainless-steel-kelly-pm-double-tour-gold-tone-blue-watch-rr2954',
  // Hermès Mother of Pearl dial — estate + Back Vault duplicate
  'hermes-stainless-steel-mother-of-pearl-dial-watch-rr2613',
] as const;

const UNAVAILABLE_SET = new Set<string>(UNAVAILABLE_PRODUCT_HANDLES);

export function isUnavailableProductHandle(handle: string): boolean {
  const h = handle.toLowerCase();
  const bare = h.startsWith('bv-') ? h.slice(3) : h;
  return UNAVAILABLE_SET.has(bare);
}
