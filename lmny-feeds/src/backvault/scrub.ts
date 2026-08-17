/**
 * Strip every reference to the supplier out of text pulled from The Back
 * Vault before it can reach a Laura Milman product. Rule and variant list
 * are SHOPIFY_SETUP.md §3 ("Pre-Import Content Scrub"): "The Back Vault",
 * "Back Vault", "back-vault", "thebackvault" must not appear anywhere on a
 * live product — title, description, vendor, tags, SEO fields, image alt
 * text, metafields, or the URL handle.
 *
 * Matches are whitespace/hyphen/case-insensitive ("the back vault",
 * "THE-BACK-VAULT", "TheBackVault" all hit) so a supplier copy tweak can't
 * quietly reintroduce the phrase in a form the literal §3b grep would miss.
 */
// `back[\s-]+vault` requires at least one separator so our own internal tag
// "backvault-feed" (no separator) is not a false positive. "thebackvault"
// is still an explicit alternative to catch that domain form.
const BACK_VAULT_PATTERN = /the[\s-]+back[\s-]+vault|\bback[\s-]+vault\b|thebackvault/gi;

/** True if the text contains any Back Vault branding in any of its forms. */
export function containsBackVaultReference(text: string | null | undefined): boolean {
  if (!text) return false;
  // Fresh RegExp per call: BACK_VAULT_PATTERN is also used with .replace()
  // elsewhere, and a shared global-flag instance's mutable lastIndex would
  // make .test() results depend on call order.
  return new RegExp(BACK_VAULT_PATTERN.source, 'i').test(text);
}

/**
 * Remove Back Vault branding from a string, collapsing the whitespace left
 * behind so "Sold by The Back Vault, authenticated" doesn't become
 * "Sold by , authenticated". Returns '' unchanged for null/undefined input.
 */
export function scrubText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(BACK_VAULT_PATTERN, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+([.,;:])/g, '$1')
    .trim();
}

/** Scrub every string leaf of an object/array in place (returns a new value). */
export function scrubDeep<T>(value: T): T {
  if (typeof value === 'string') return scrubText(value) as unknown as T;
  if (Array.isArray(value)) return value.map(scrubDeep) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubDeep(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Final gate before a product ever reaches buildProductInput's caller: throw
 * rather than publish if any of the fields the §3a audit checks still carry
 * the phrase after scrubbing. A throw here fails the sync run loudly instead
 * of quietly shipping a Back Vault reference to the live storefront.
 */
export function assertScrubbed(fields: Record<string, string | null | undefined>): void {
  const hits = Object.entries(fields).filter(([, v]) => containsBackVaultReference(v));
  if (hits.length > 0) {
    throw new Error(
      `Back Vault reference survived scrubbing in: ${hits.map(([k]) => k).join(', ')}`,
    );
  }
}
