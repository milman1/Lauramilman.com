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

## Part 2 — collections for the new homepage

### 4. Create `under-2500`

- After: automated "Under $2,500" (`gid://shopify/Collection/349097361479`),
  all of: price < 2500; type not Natural Diamond, Lab-Grown Diamond, Watch,
  Watches; tag not `backvault-feed`, `Estate Jewelry`, `Pre-Owned`,
  `Vintage`; title not containing Wedding, Engagement, Kid's. Newest first.
  Published to Online Store and Shop. Verified: 140 active members; draft
  4,372 and archived 953 unchanged.

### 5. Create `all-bracelets` and `all-pendants`

- Before: `bracelets` and `pendants-1` are manual collections (29 bracelets
  hand-picked; about 220 active bracelets exist). Manual collections cannot
  take rules, so rule-based copies were created and left the originals
  untouched.
- After: "Bracelets" at `all-bracelets` (`gid://shopify/Collection/349097590855`),
  any of type Bracelet, Bracelets, Bangle, Tennis Bracelet; "Pendants" at
  `all-pendants` (`gid://shopify/Collection/349097623623`), any of type
  Pendant, Pendants. Both newest first, published to Online Store and Shop.
  Member counts not yet verified.

### 6. `rings` matches by product type

- Before: id `gid://shopify/Collection/168312406087`, all of: title contains
  `ring`, title does not contain `ear`, title does not contain `engagement`.
  This pulled in "Draw String" bracelets and dropped rings named Pear, Pearl
  or Heart.
- After: any of type Ring, Rings, Solitaire Ring. Member count not yet
  verified.

### Decision: inactive products (2026-09-27)

Rule-based collections list draft and archived products in the admin; the
storefront, sitemap, search, and every sales channel and feed show only
active, published products, so inactive members do not affect the website,
Google or AI search. Merchant decision: leave as is. No tag rule, no
rollback.
