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

## Part 3 — answer-first collection intros

Body (`descriptionHtml`) only; SEO title and description unchanged. Copy uses
facts already stated on the site and in the refund and shipping policies.

| Collection | Before |
|---|---|
| `david-webb` | "Pre-owned David Webb jewelry, authenticated and hand-inspected by Laura Milman New York. Enamel, hammered gold, and other signed designs are listed with the measurements and condition on each product page. Missing facts stay blank." |
| `cartier` | "Pre-owned Cartier jewelry and watches selected by Laura Milman New York. Love, Juste un Clou, Tank, and other documented models are listed with metal, size, and condition from the product record. Era and provenance are stated only when documented." |
| `van-cleef-arpels` | "Pre-owned Van Cleef & Arpels jewelry offered by Laura Milman New York. Alhambra and other signed designs appear here when the piece is in hand. Stone, metal, and measurements stay on the product page; unknown facts are left empty." |
| `tiffany` | "Pre-owned Tiffany & Co. jewelry authenticated by Laura Milman New York. Schlumberger, Paloma Picasso, and house designs are listed only when the attribution is on the piece or its paperwork." |
| `rolex-watches` | "Pre-owned Rolex watches selected by Laura Milman New York. Reference, case size, year, and box-and-papers facts come from the source record. Condition is never inferred from the title." |
| `chains` | "Gold chains at Laura Milman New York: 14K yellow, white, and rose gold in Franco, Cuban, rope, herringbone, and other classic links. Solid links and measured lengths for everyday wear.Each chain is authenticated by Laura Milman New York." |

After: each body now opens by answering the buyer's first question
(authenticated in New York; what the listing states; what is never guessed)
and closes with the shipping and return terms from the refund policy.
Applied 2026-09-27; all six updates returned no errors.

## Part 4 — menus, legacy copy, pages, legal contact

### 7. Shopify navigation menus

The theme hard-codes its header and footer, so these menus are not on the
storefront, but apps such as the Shop app can read them.

Before:
- `main-menu` (`gid://shopify/Menu/207127050`): Meet Laura → /pages/lauras-story;
  Diamonds (Natural Diamonds); Peaceful Diamonds (Lab-Grown Diamonds, Lab
  Grown Jewelry → /collections/lab-grown-jewelry); Timepieces (All, Rolex,
  Cartier, Bvlgari, Van Cleef & Arpels, Chopard, Audemars Piguet, Hermès,
  Patek Philippe, Jacob & Co.); Brands → /collections (Cartier, Tiffany & Co.,
  Van Cleef & Arpels, Bvlgari, Chopard, Hermès, Seaman Schepps, Verdura);
  Wedding (Engagement Rings, Wedding Bands, Men's Wedding Bands); Earrings →
  deleted collection 157096149063 (Chandelier, Drop, Hoop, Huggie, Stud);
  Bracelets → /collections/bracelets (Bangles); Rings (Stackable, Trendy,
  Men's); Necklaces (Chokers, Pendants → pendants-1); Estate Jewelry (Cartier,
  Chopard, Hermès, Tiffany & Co.); Vintage Jewelry; Journal.
- `footer-shop` (`gid://shopify/Menu/220497150023`): Rings, Necklaces,
  Bracelets → /collections/bracelets, Earrings → /collections/earrings,
  New Arrivals → /collections/all.
- `footer-about` (`gid://shopify/Menu/220497182791`): Our Story →
  /pages/our-story (missing), Sustainability → /pages/sustainability
  (missing), Press → /pages/press (missing), Contact.
- `footer-help` (`gid://shopify/Menu/220497313863`): FAQ, Shipping & Returns,
  Care Guide, Size Guide → /pages/size-guide (missing).
- `footer` and `customer-account-main-menu`: unchanged.

After (applied): `main-menu` mirrors the theme header (Under $2,500; Jewelry;
Lab-Grown Jewelry; Pre-Owned & Estate; Our Story; Loose Diamonds; Watches;
Bridal; Journal) with every link pointing at a live collection or page.
`footer-shop` adds Under $2,500 and uses `all-bracelets`, `all-earrings` and
"All Jewelry"; `footer-about` is Our Story → /pages/about, Estate
Authentication, Private Clients, Contact; `footer-help` points Ring Size Guide
at /pages/ring-size-guide. All four updates returned no errors.

### 8. Legacy collection copy

Before (exact `descriptionHtml`, editor `data-*` attributes omitted):
- `omega` (`gid://shopify/Collection/279237623879`): h3 "Pre-Owned Omega
  Collection – Legendary Swiss Timepieces"; "Explore pre-owned Omega watches
  like the Speedmaster and Seamaster—precision-engineered and fully
  authenticated for timeless style. **Keywords**: pre-owned Omega, Omega
  Speedmaster, Seamaster, Omega watch, vintage Omega, Swiss watches,
  authentic Omega."
- `chopard` (`gid://shopify/Collection/279237460039`): h3 "Pre-Owned Chopard
  Collection – Swiss Craftsmanship & Glamour"; "Discover our pre-owned Chopard
  pieces, including Happy Diamonds and Mille Miglia watches. Authenticated and
  expertly curated, these pieces offer classic luxury at unbeatable value."
- `hermes` (`gid://shopify/Collection/279237558343`): h3 "Pre-Owned Hermès
  Collection – Understated Luxury & Craftsmanship"; "From iconic bangles to
  rare timepieces, our pre-owned Hermès collection offers elegance rooted in
  French craftsmanship. Authenticated and curated with care."
- `vintage-jewelry` (`gid://shopify/Collection/276068368455`): h3 "Timeless
  Treasures from the Past"; "Discover our curated collection of vintage
  jewelry, featuring rare and iconic designs from renowned houses like Van
  Cleef & Arpels, Tiffany & Co., David Webb, and more. Each piece tells a
  story—crafted in a bygone era with exceptional artistry, precious
  gemstones, and enduring elegance. From Art Deco rings to bold mid-century
  bracelets, our vintage collection offers collectible and investment-worthy
  pieces with guaranteed authenticity and charm."

After (applied): all four bodies replaced with fact-only copy (reference,
condition, box and papers, shipping and return terms; vintage links to the
Pre-Owned & Estate hub). No errors. The theme's hard-coded intros for
`vintage-jewelry` and `hermes` were removed so this copy shows.

### 9. One founder page, no duplicate homepage

- Before: `/pages/lauras-story` (`gid://shopify/Page/253141396`) and
  `/pages/about` (`gid://shopify/Page/129922662471`) both published with
  different versions of Laura's story; `/pages/shop`
  (`gid://shopify/Page/134196330567`) published with a copy of the homepage.
- After: `lauras-story` and `shop` unpublished (not deleted; republish from
  Online Store → Pages to undo). Redirects `/pages/lauras-story` →
  `/pages/about` (`gid://shopify/UrlRedirect/409739722823`) and `/pages/shop`
  → `/` (`gid://shopify/UrlRedirect/409739755591`). Theme links to Our Story
  now go to /pages/about.

### 10. Logo, favicon and legal contact

- Organization logo in the theme falls back to the header file
  `LMNY-header-lockup.png` when no brand logo or favicon is set.
- Favicon: not set; needs a square image chosen by the merchant.
- Terms of service still list a personal email and an address as governing
  law; privacy policy names "Laura's Gems". Legal text left for the merchant
  to edit in Settings → Policies.

### 11. Delete redirects from deleted pages to the homepage

Merchant decision: delete them so the dead addresses return "not found" and
drop out of search, instead of sending shoppers to the homepage.

- Scope: every redirect whose path starts with `/products/` or
  `/collections/` and whose target is exactly `/` — 937 product and 18
  collection redirects, 955 in total. Every row was read back and checked
  before deletion.
- Snapshot for undo: `docs/audits/2026-09-27-deleted-redirects.csv`
  (redirect id, path, target). Any row can be recreated in Online Store →
  Navigation → URL Redirects, or pointed at a category instead.
- Kept: marketing short links `/h`, `/challenge`, `/lander`; `/pages/shop`
  → `/`; product redirects that point at other products; the new
  `/collections/earrings`, `/pages/lauras-story` redirects.
- Method: `urlRedirectBulkDeleteBySearch` with `path:/products/* AND
  target:/` (job 5165c91f-4caa-4d83-a353-e08a5a3c19d9) and
  `path:/collections/* AND target:/` (job 7b227fae-a2f5-4312-93c5-ca597d3da365).

## Part 5 — collections for the v2 homepage (gold chains, gold jewelry)

Before: none of these handles existed. All three are smart collections, so
only active, published products show on the storefront. No product status,
tag or listing was changed.

| Handle | Id | Rule | Sort |
| --- | --- | --- | --- |
| `gold-jewelry` | 349102145607 | tag = `gold-jewelry` | newest first |
| `chain-bracelets` | 349102178375 | tag = `chains` AND type = `Bracelets` | price, low to high |
| `chain-necklaces` | 349102211143 | tag = `chains` AND type = `Necklaces` | price, low to high |

Each has an answer-first description and an SEO title and description, and
is published to the Online Store.

- `gold-jewelry` is empty until products are tagged `gold-jewelry`. The theme
  hides its homepage section and its menu item while it is empty. Which
  pieces to tag is the merchant's call; nothing has been tagged yet.
- Undo: delete the collection in Products → Collections. The theme falls
  back cleanly (the homepage section and menu item hide themselves).

## Part 6 — admin menus follow the v2 site menu (2026-09-27)

The theme hard-codes its header and footer; these Shopify menus are read by
apps such as the Shop app.

- `main-menu` (`gid://shopify/Menu/207127050`). Before: Under $2,500 →
  /collections/under-2500; Jewelry (Gold Chains, Earrings, Bracelets,
  Necklaces, Pendants, Rings, All Jewelry); Lab-Grown Jewelry (Bracelets,
  Necklaces, Pendants, Rings, Earrings, Engagement Rings); Pre-Owned & Estate
  (David Webb, Cartier, Van Cleef & Arpels, Bvlgari, Tiffany & Co., Hermès,
  Chopard, Estate Authentication); Our Story; Loose Diamonds → natural-diamonds
  (Natural, Lab-Grown); Watches (All, Rolex, Cartier, Jacob & Co., Patek
  Philippe); Bridal (Engagement Rings, Wedding Bands, Men's Wedding Bands,
  Ring Builder); Journal.
  After: Gold Chains (Cuban, Rope, Paperclip, Herringbone, Curb via `?type=`;
  Chain Necklaces; Chain Bracelets; All Chains); Lab-Grown Jewelry (Tennis
  Bracelets, Huggies & Hoops, Stud Earrings, Station Necklaces, Engagement
  Rings, then the five categories and All); Loose Diamonds →
  lab-grown-diamonds (Round, Oval, Emerald, Pear via `?shape=`; Lab-Grown;
  Natural); Pre-Owned & Estate (houses in the site's popularity order,
  Estate Authentication, All); Our Story; Shop by Piece; Watches; Bridal;
  Journal; Private Clients. Gold Jewelry is left out until the
  `gold-jewelry` collection has pieces, as on the site.
- `footer-shop` (`gid://shopify/Menu/220497150023`). Before: Under $2,500,
  Rings, Necklaces, Bracelets, Earrings, All Jewelry. After: Gold Chains,
  Lab-Grown Jewelry, Loose Diamonds, Pre-Owned & Estate, Rings, Necklaces,
  Bracelets, Earrings, All Jewelry.

Both `menuUpdate` calls returned no user errors.

## Part 7 — remove "Peaceful Diamonds" mentions from the URL and site (2026-09-28)

Scope: strip the sub-brand name "Peaceful Diamonds" from every customer-facing
surface — the collection URL, page titles/descriptions, SEO metadata,
navigation menus, theme section names, and 72 product descriptions that
carried the phrase verbatim. The `vendor` field value `Peaceful Diamonds`
itself was left untouched — it is a pricing-automation key (Cost×4 rule,
Uploadify feed logic, documented in `AGENTS.md`) and renaming it is a
separate, larger task, out of scope here. The theme's existing
vendor-redaction logic (which replaces the literal string `Peaceful Diamonds`
with `Laura Milman New York` wherever a vendor is displayed to a shopper —
`sections/main-product.liquid`, `sections/main-cart-items.liquid`,
`sections/cart-notification-product.liquid`, `sections/predictive-search.liquid`,
`sections/featured-product.liquid`, `snippets/structured-data-product.liquid`,
`snippets/lab-grown-tag.liquid`) still matches on that literal string by
design and was not changed.

### 1. Collection rename

`gid://shopify/Collection/295877705799`. Before: handle
`peaceful-diamonds-by-laura-milman-new-york`, title "Peaceful Diamonds by
Laura Milman New York", `templateSuffix` `peaceful`, descriptionHtml
mentioning "Peaceful Diamonds by Laura Milman New York". After: handle
`lab-grown-diamond-jewelry`, title "Lab-Grown Diamond Jewelry",
`templateSuffix` `lab-grown`, descriptionHtml rewritten to describe the
line without the sub-brand name. SEO title/description were already clean
and untouched. `lab-grown-jewelry` was not available as a handle — it is
already used by an unrelated, much larger (24,416-product) collection — so
`lab-grown-diamond-jewelry` was used instead.

The 6 sub-collections (`lab-grown-bracelets` 296544075847,
`lab-grown-necklaces` 296544108615, `lab-grown-pendants` 296544141383,
`lab-grown-earrings` 296544174151, `lab-grown-rings` 296544206919,
`lab-grown-engagement-rings` 296544239687) had `templateSuffix` changed from
`peaceful-category` to `lab-grown-category` to match. Their handles were
already clean and unchanged.

- Undo: `collectionUpdate` back to the old handle/title/templateSuffix/
  descriptionHtml above. Delete the redirect below first, or it will
  conflict with the restored handle.

### 2. Redirect

Created `gid://shopify/UrlRedirect/409763250247`: path
`/collections/peaceful-diamonds-by-laura-milman-new-york` → target
`/collections/lab-grown-diamond-jewelry`. Undo: delete this redirect.

### 3. Menus

- `main-menu` (`gid://shopify/Menu/207127050`). The "Lab-Grown Jewelry" item
  and its "All Lab-Grown Jewelry" sub-item pointed at
  `/collections/peaceful-diamonds-by-laura-milman-new-york`; both now point
  at `/collections/lab-grown-diamond-jewelry`. Every other item was
  resubmitted unchanged.
- `footer-shop` (`gid://shopify/Menu/220497150023`). Same fix on its
  "Lab-Grown Jewelry" item.

### 4. Collection content (descriptionHtml + SEO)

These collections had "Peaceful Diamonds" in their live description and/or
SEO title: `necklaces` (269851328583), `lab-grown-bracelets`,
`lab-grown-necklaces`, `lab-grown-pendants`, `lab-grown-earrings`,
`lab-grown-rings`, `lab-grown-engagement-rings` (ids above). Before: e.g.
SEO title "Lab-Grown Diamond Bracelets | Peaceful Diamonds"; descriptionHtml
naming "Peaceful Diamonds by Laura Milman New York". After: "Peaceful
Diamonds" replaced with "Laura Milman New York" (or removed where redundant)
in each. Undo: restore the old descriptionHtml/SEO text (not recorded
verbatim here — re-derive from "Peaceful Diamonds" phrasing if reverting).

### 5. Product descriptions (72 products)

72 of the ~104 products with vendor `Peaceful Diamonds` had this sentence
verbatim in `descriptionHtml`, inside a "Why Choose Lab Grown Diamonds?"
paragraph: "Every Peaceful Diamonds piece is crafted with the same
brilliance, fire, and scintillation you expect from the finest diamonds —
because they are." Fixed with a straightforward, reversible string
substitution: `descriptionHtml.replace('Peaceful Diamonds', 'Laura Milman
New York')` (each description had exactly one occurrence). Verified via a
follow-up `vendor:'Peaceful Diamonds'` product query: 0 of 104 products now
contain the phrase. Undo: reverse the substitution per product id.

Flagged, not fixed (out of scope — a business policy question, not a
sub-brand-name issue): the same descriptions' "Our Promise" list advertises
"30-Day Money Back Guarantee" and "Lifetime Warranty", which is inconsistent
with the site's actual 7-day-returns policy. Left as-is pending a merchant
decision.

### 6. Theme files

Renamed section/template files so no merchant-facing schema label or file
name reads "Peaceful": `sections/peaceful-hero.liquid` →
`sections/lab-grown-hero.liquid`; `sections/peaceful-diamonds.liquid` →
`sections/lab-grown-diamonds-feature.liquid`;
`templates/collection.peaceful.json` → `templates/collection.lab-grown.json`;
`templates/collection.peaceful-category.json` →
`templates/collection.lab-grown-category.json`. Updated every reference to
the old collection handle and the old section/template names across the
theme (header, footer, breadcrumbs, filters, style bar, popular searches,
about page, google-reviews template, the shop page, `index.json`,
`list-collections.json`, `settings_data.json`, `settings_schema.json`).
CSS class names, setting `id`s (`peaceful_label`, `peaceful_url`,
`color_pd_blue`, `color_pd_ice`, etc.), and the `pop-peaceful`/`p-peaceful`
block keys were deliberately left unrenamed — they are invisible internal
identifiers, and renaming them would orphan saved merchant configuration in
`settings_data.json` for no visible benefit. Undo: `git revert`.
