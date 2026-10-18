/**
 * Sales channels the feed syncs publish to.
 *
 * `SALES_CHANNELS` is the ordered list of Shopify publication names that
 * every ACTIVE product written by a feed sync must be published to. Before
 * the 2026-09-10 merchant decision both syncs published to Online Store
 * alone, which left the 732 estate pieces and 138 of the 173 watches — the
 * highest-ticket, most-searched inventory in the store — invisible on
 * Google Shopping, Instagram and Facebook Shops, and Pinterest
 * (`docs/audits/2026-09-09-site-audit.md` section 6).
 *
 * Loose diamonds keep the narrow base list below. Google is an explicit
 * curated exception reconciled in src/googleLoose.ts, configured in
 * config/googleLoose.ts (merchant authorization 2026-10-18). It does not
 * grant Meta, Pinterest, eBay, or Uploadify eligibility.
 *
 * Changing this list is a pull request against this file — never a
 * hardcoded publication name in a sync, and never a one-off publish in
 * Shopify admin, the same discipline `config/pricing.ts` has for markup.
 *
 * Marketplace Connect (eBay) is NOT a publication and is not listed here.
 * That app selects products on its own side; the store's rule is the
 * `ebay` tag plus `custom.ebay_condition` (AGENTS.md section 2 rule 8).
 * Adding 'eBay' to this list would do nothing but log a missing channel.
 *
 * Names must match the publication names Shopify returns exactly. The
 * store's publication list, as the API returns it (2026-09-09), is:
 * Online Store, Facebook & Instagram, Google & YouTube, Pinterest, Shop,
 * TikTok, Inbox, Microsoft Channel, Faire: Sell Wholesale, Buy Button.
 * Note "Faire: Sell Wholesale", not "Faire". A configured name that does
 * not resolve against that list is a run error, not a warning: the sync
 * records it and, when Online Store itself is missing, refuses to write.
 */
export const SALES_CHANNELS = [
  'Online Store',
  'Shop',
  'Google & YouTube',
  'Facebook & Instagram',
  'Pinterest',
] as const;

/**
 * Base channels for loose stones. The curated Google pilot is reconciled
 * independently so hash-skipped products and withdrawals are covered.
 */
export const LOOSE_DIAMOND_CHANNELS = ['Online Store', 'Shop'] as const;

/** What a feed product is, for channel purposes. */
export type ChannelKind = 'diamond' | 'watch' | 'estate';

/**
 * The channel list for a feed product. Diamonds get the two-channel list;
 * watches (Belgium Dia) and estate pieces (Back Vault) get all five.
 */
export function channelsFor(kind: ChannelKind): readonly string[] {
  return kind === 'diamond' ? LOOSE_DIAMOND_CHANNELS : SALES_CHANNELS;
}

/**
 * Shopify renamed the storefront publication once. Both names mean the same
 * channel, and a store can return either, so every comparison between a
 * configured channel and a publication name goes through
 * `publicationMatchesChannel` — the client resolving ids and the catalog
 * read computing missing channels must agree on this.
 */
export const ONLINE_STORE_ALIASES: readonly string[] = ['Online Store', 'Online Store 2.0'];

/** True when a Shopify publication name is the configured channel. */
export function publicationMatchesChannel(channel: string, publicationName: string): boolean {
  if (channel === 'Online Store') return ONLINE_STORE_ALIASES.includes(publicationName);
  return channel === publicationName;
}

