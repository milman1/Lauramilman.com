# Admin change log — 2026-09-27 audit fixes

Shopify Admin changes made while implementing
`2026-09-27-ux-seo-geo-audit.md`. Each entry lists the state before the
change so it can be reversed by hand.

## Part 1 — collections

### 1. Create `earrings` (fixes sitewide 404)

- Before: no collection with handle `earrings`; header, homepage grid,
  collection chips and the earrings CTA all linked to it.
- After: the `earrings` handle is held by a collection the Admin API cannot
  see (create returned "handle has already been taken"; no collection, search
  hit or redirect exists for it). Created automated collection "Earrings" at
  `all-earrings` (`gid://shopify/Collection/349096902727`), any of: type =
  `Earrings`, type = `Earring`; sort newest first; published to Online Store
  and Shop. Added URL redirect `/collections/earrings` →
  `/collections/all-earrings` (`gid://shopify/UrlRedirect/409735823431`).

### 2. `estate-jewelry` becomes the single estate hub

- Before: id `gid://shopify/Collection/276068401223`, title "Estate
  (Pre-Owned) Jewelry", template suffix "", sort BEST_SELLING, rule any of:
  tag = `Estate Jewelry`. SEO title "Estate Jewelry | Laura Milman", SEO
  description "Signed pre-owned jewelry authenticated by Laura Milman New
  York. David Webb, Cartier, Van Cleef, and Tiffany." Body: legacy
  "Authenticated Luxury at Exceptional Value… at a fraction of the original
  price…" copy.
- After: title "Pre-Owned & Estate Jewelry", template `estate`, sort newest
  first, rule any of: tag = `Estate Jewelry`, tag = `backvault-feed`, tag =
  `Pre-Owned`. Feed Rolex listings carry `Pre-Owned Watches`, not
  `Pre-Owned`, so they stay out. Fact-only body and SEO fields.

### 3. `all` becomes All Jewelry

- Before: id `gid://shopify/Collection/296441184327`, title "Shop All
  Jewelry & Watches", sort BEST_SELLING, rules all of: type ≠ `Lab-Grown
  Diamond`, type ≠ `Natural Diamond`. SEO title "Shop All Jewelry & Watches
  | Laura Milman". Body "The complete Laura Milman New York collection —
  fine jewelry, engagement rings, estate pieces, and timepieces."
- After: title "All Jewelry", rules add type ≠ `Watch` and type ≠
  `Watches`. The theme then paginates and filters it like any collection
  instead of the 48-item hand-built grid.

### Verification (fresh read after the changes)

| Check | Before | After |
|---|---|---|
| Draft products (store) | 4,372 | 4,372 |
| Archived products (store) | 953 | 953 |
| `all-earrings` active / non-active members | — | 285 / 51 |
| `estate-jewelry` active / non-active members | 84-tag rule | 808 / 282 (63 active signed watches) |
| `all` active members / watches | 2,448 incl. watches | 1,259 / 0 |

No product status or product publication was changed. Non-active members of
a smart collection are never shown on the storefront.
