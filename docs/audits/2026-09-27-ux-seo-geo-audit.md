# Layout, messaging, UX, SEO and GEO audit — 2026-09-27

Scope: the theme in this repository (`main` at `46ecbf2`) and read-only
Shopify Admin data for collections, pages, menus, redirects, articles and a
sample of products. This audit covers what the September 9 catalog audit
(`2026-09-09-site-audit.md`) and the SEO plan (`docs/seo/2026-09-plan.md`) do
not cover: page layout, navigation, positioning, on-site claims and GEO/AEO.

Limits. The sandbox cannot reach www.lauramilman.com (egress blocked), so
nothing here is a live visual or rendered-HTML check. Items that depend on
rendered output are marked **verify live**. No Search Console or analytics
data was available.

---

## Status update — 2026-09-27, later the same day

This audit drove a series of theme PRs and admin changes on 2026-09-27,
recorded in full in `docs/audits/2026-09-27-admin-change-log.md`. The
findings below are left as originally written (this is a point-in-time
audit, not a rewritten one); this section tracks what has since changed
against each finding. ✅ done, 🟡 partly done, ⬜ still open.

### Section 1 — Fix first

| # | Status | What changed |
|---|---|---|
| 1 | ✅ | `all-earrings` created (285 active); every link, including the header, repointed; `/collections/earrings` redirects there. |
| 2 | ✅ | `estate-jewelry` is the one estate hub (808 active), rule now `tag = Estate Jewelry OR backvault-feed OR Pre-Owned`. `vintage-jewelry` and its links are gone from nav, hero, footer and breadcrumbs. |
| 3 | ✅ | `/collections/all` (1,259 active) uses the collection directly with normal pagination and filters; the 48-item hand-built grid is removed. |
| 4 | ✅ | `sections/product-education.liquid` has a `watch` mode; Jacob & Co. and other watches no longer show the jewelry heritage claim. |
| 5 | ✅ | The invented testimonials ("Alexandra K.", "Catherine M.", "Victoria S.") are deleted from every template. A new `client-reviews` section takes only reviews entered word for word from Google and stays hidden until at least one exists, so nothing invented or empty is live. It is currently empty (see GEO item 3 below); the homepage keeps the existing Google reviews widget until real reviews are entered. |
| 6 | ✅ | Menu parents are `<button aria-expanded>`, open on `:focus-within`, close on Escape; a skip link is in `layout/theme.liquid`. |

### Section 2 — Positioning and messaging

| Finding | Status | What changed |
|---|---|---|
| 1. Lab-grown pushed 5x, estate once | 🟡 | The homepage was rebuilt around "gold, then diamonds, then estate": hero leads with gold and diamonds together, a four-tile mosaic gives gold, lab-grown, loose diamonds and estate equal billing, and estate and watches each have their own homepage section. Not literally "two doors in the hero," but the same imbalance is resolved. |
| 2. Jacob Arabo credential missing from homepage | ✅ | The brand-story section now states it: "working alongside her brother Jacob Arabo in the early years of what became Jacob & Co." `Organization` schema carries Laura as founder (name only, no bio). |
| 3. One concept, five names | ✅ | Every surface (nav, homepage, collection title) now says "Pre-Owned & Estate". |
| 4. Peaceful Diamonds sub-brand ambiguity | ⬜ | Unchanged. The nav says "Lab-Grown Jewelry" consistently, but the collection handle and title still read `peaceful-diamonds-by-laura-milman-new-york`. Still needs a merchant decision. |
| 5. Two competing founder stories | ✅ | `/pages/lauras-story` is unpublished and redirects to `/pages/about`, the one canonical page. |
| 6. Watch policy used as a trust badge | ✅ | The rebuilt homepage trust strip is 14K Gold · Certified Loose Diamonds · Free Insured Shipping · 7-Day Jewelry Returns; the watch exchange line is gone from it. |
| 7. `/pages/shop` duplicates the homepage | ✅ | Unpublished, redirects to `/`. |
| 8. Legacy promotional copy | ✅ | Omega, Chopard, Hermès and Vintage all have fact-only copy now. |
| 9. Boilerplate "Authenticated by…" suffix | ⬜ | Not reviewed this round. Still needs a pass over every collection's SEO description. |
| Claims to verify table | ⬜ | Not reviewed this round; still needs the merchant's confirmation of each claim. |

### Section 3 — Layout and UX

| Finding | Status | What changed |
|---|---|---|
| Homepage section count and order | 🟡 | Rebuilt twice since this audit (once to the "10-section" shape, then again to the current gold-led v2). The duplicate lab-grown grid and the closing CTA are gone. The homepage is currently 16 sections, not ~10: **new since this audit**, adding the Watches carousel means "Also From the House" now also carries a Pre-Owned Watches tile pointing at the same `time-pieces` collection, a small duplication worth trimming (drop that one tile, or fold Bridal into the Watches section). |
| Hero background | ✅ | The hero now shows a woman wearing diamond drop earrings, not an abstract texture. |
| Nav: parents aren't links | 🟡 | Still true (`Gold Chains`, `Lab-Grown Jewelry` etc. are toggle buttons, not links), but every dropdown now ends in a "Shop All X" link, so the landing page is one click away instead of unreachable. |
| Nav: no top-level route to Private Clients or About | ✅ | Our Story and Private Clients are both top-level items now. |
| Shopify admin menus stale/unused | ✅ | `main-menu`, `footer-shop`, `footer-about` and `footer-help` all rewritten to match the live site; the broken `/pages/our-story`, `/pages/sustainability`, `/pages/press`, `/pages/size-guide` links are gone. |
| `header-group.json` ignored settings | ⬜ | Unchanged; harmless but still confusing in the theme editor. |
| Logo `height="auto"` | ✅ | The header logo now computes a numeric height from the image's aspect ratio. |
| Collection rule risk (`bracelets`, `necklaces`, `rings`) | 🟡 | `all-bracelets` and `all-pendants` were added as rule-based collections; the legacy manual `bracelets`/`pendants-1` are untouched. `rings` was fixed to match by product type. `necklaces` was not reviewed. |
| `wedding-bands` / `mens-wedding-bands` imbalance | ⬜ | Not reviewed this round. |
| David Webb missing a buying-guide link | 🟡 | A "How to Authenticate a Pre-Owned David Webb Piece" Journal guide is drafted (unpublished) and links to `/collections/david-webb`, but `snippets/collection-guide.liquid` was not updated to surface it. |
| Product handles/titles (`necklace-2`…, "Diamond Snack Pendant") | ⬜ | Not reviewed this round. |
| Popup / footer accordion keyboard access | ⬜ | Not reviewed this round. |

### Section 4 — Technical SEO

| # | Status | What changed |
|---|---|---|
| 1 | ✅ | 955 redirects to `/` deleted; the stale `/collections` and `/collections/engagement-rings` rules removed. Undo list: `docs/audits/2026-09-27-deleted-redirects.csv`. |
| 2 | ⬜ | Still no favicon. Waiting on the merchant to upload one. |
| 3 | 🟡 | `Organization` now has founder, the 1185 6th Avenue address, the brand logo and `hasMerchantReturnPolicy`. Telephone, `foundingDate`, the Google Business Profile URL and a `JewelryStore` type are still not added. |
| 4 | ⬜ | Still needs the merchant to confirm or rename the Google Business Profile. |
| 5 | ✅ | Product JSON-LD now emits one `Offer` per variant (rather than a single `AggregateOffer`, but the same multi-variant intent), `shippingDetails`, `hasMerchantReturnPolicy` (7-day jewelry, exchange-only watches, none for loose diamonds), `additionalProperty` from the custom and feed metafields, and `mpn` from the reference on watches. |
| 6 | 🟡 | Article `author` is now typed `Organization` when the byline is the store name, not a fake `Person`. Featured-image alt text is still 0 of 9 (now 0 of 13, counting the four new drafts, which also have no image yet). |
| 7 | ⬜ | The new `client-reviews` section is crawlable server-rendered text, but it has no reviews in it yet (see GEO item 3). `/pages/google-reviews` itself is unchanged: still a JavaScript-only embed. |
| 8 | ⬜ | Not reviewed this round. |
| 9 | ⬜ | Not reviewed this round. |

### Section 5 — GEO / AEO

| # | Status | What changed |
|---|---|---|
| 1 | ⬜ | Not written this round. `/pages/about` is now the one canonical founder page, but its copy was not rewritten into short, quotable facts. |
| 2 | ✅ | Answer-first intros written for the 6 priority collections (David Webb, Cartier, Van Cleef & Arpels, Tiffany, Rolex, Chains) plus 3 new ones (Gold Jewelry, Chain Bracelets, Chain Necklaces). Other collections still carry their prior copy. |
| 3 | 🟡 | Four guides drafted and sitting **unpublished** in Shopify admin, covering David Webb authentication, Rolex box and papers, gold chain styles/widths, and lab-grown vs natural diamonds — the same ground as SEO plan P12's four guides. The weekly `journal-draft` GitHub Action has failed all 5 runs since 2026-09-11: its Shopify app is missing the `read_content`/`write_content` scopes, so it errors before calling the AI. That is a merchant-side fix (add the scopes in the Partner/Dev Dashboard, then approve). |
| 4 | ✅ | Same change as section 4, item 5. |
| 5 | 🟡 | Site nav and admin menus now use one name per line of business ("Pre-Owned & Estate", "Gold Chains", "Lab-Grown Jewelry"). The vendor merge (Laura's Gems / Milman New York), the Google Business Profile name, and the Peaceful Diamonds sub-brand decision are all still open. |
| 6 | ⬜ | The four new Journal drafts are not yet linked from any collection or PDP education block, and neither are the five existing ones ("lab-grown vs natural", "IGI vs GIA", "box and papers"). Worth doing once the drafts are reviewed and published. |

---

## 1. Fix first

| # | Finding | Evidence | Impact | Fix |
|---|---|---|---|---|
| 1 | **`/collections/earrings` does not exist** but is linked from the header (Jewelry → Earrings), the homepage "Shop by Jewelry Type" grid, the "Fine Jewelry Edit" CTA ("Explore All Earrings"), the collection chip row on every collection page, and the `/collections/all` source list. | `collectionByHandle("earrings")` returns null; no earrings hub in the 68-collection list. `sections/header.liquid:714`, `sections/main-collection.liquid:111`, `templates/index.json` (`collections-grid`, `fine-jewelry-editorial`). | Sitewide 404 on a core jewelry category; wasted internal link equity. | Create an automated `earrings` collection (product type = Earrings, plus the lab/estate earrings), or repoint all links to an existing handle. |
| 2 | **The estate hub holds 34 products.** "Pre-Owned Maison" / "Vintage & Estate" / "Explore the Maison Vault" / hero secondary CTA / footer / breadcrumb parent all point to `/collections/vintage-jewelry`, whose rule is `TITLE CONTAINS "vintage"`. The store has ~732 estate pieces (David Webb alone: 455). | Collection rule read via Admin API. `estate-jewelry` (tag `Estate Jewelry`) has 307; neither hub has everything. | The brand's highest-value, least-competed inventory is almost invisible from its own headline CTA. | One estate hub with a complete rule (tag `backvault-feed` OR `Estate Jewelry` OR `Pre-Owned`), one name, and every link pointed at it. Redirect the loser. |
| 3 | **"All Jewelry" shows at most 48 items, no pagination, no filters.** `/collections/all` (2,448 products) is rebuilt from a fixed handle list (including the missing `earrings` and the 34-item `vintage-jewelry`), capped at 48, and the filter drawer and pagination are switched off for it. | `sections/main-collection.liquid` (`jewelry_only`, `shown_count >= 48`, `paginate.pages > 1 and jewelry_only == false`, `unless jewelry_only` around `filter-drawer`). | A primary nav, homepage and footer destination dead-ends after 48 cards. | Use a real automated "All Jewelry" collection (everything except type Watch and loose stones) with normal pagination and filters. |
| 4 | **Wrong origin copy on watches.** PDPs with no lab/estate/pre-owned tag fall into "heritage" mode and show *Designed in New York · Crafted in Italy · Made to Be Inherited*. All Jacob & Co. watches (tags `jacob-co-boutique`, `Watch`) hit this. | `sections/product-education.liquid:16-21`; tags read via Admin API. | False country-of-origin statement on a third-party brand's watch. | Add a `watch` mode (or suppress the block) when `product-is-watch` is true; only show heritage copy for verified house-made pieces. |
| 5 | **Homepage testimonials look written, not collected.** "Alexandra K.", "Catherine M.", "Victoria S." repeat the site tagline almost word for word ("the week you work", "Midtown lunch to a 7pm reservation"). | `templates/index.json` → `reviews` (testimonials section). | If these are not verbatim quotes from real customers, the FTC's 2024 rule on fake reviews and testimonials applies, and they undermine trust with anyone who notices. | Confirm each quote's source. Otherwise replace with real Google reviews (the store has them) as crawlable text with the reviewer's first name and date. |
| 6 | **The desktop menu can't be used with a keyboard, and there is no skip link.** Top-level items are `<span>`s that open only on `:hover`: no `tabindex`, no `aria-expanded`, no `:focus-within`. `layout/theme.liquid` has no "skip to content" link (the backup layout does). | `sections/header.liquid` (nav markup + CSS), `layout/theme.liquid`. | Fails WCAG 2.1.1 (keyboard access), and jewelry e-commerce draws a lot of ADA demand letters. | Make parents `<button aria-expanded>` controls, open menus on `:focus-within`, and restore the skip link. |

## 2. Positioning and messaging

**What the site says it is.** Homepage `<title>`: *Lab-Grown & Estate Jewelry*.
Hero: *Jewelry for the week you actually live* → lab-grown first, "signed
pre-owned pieces when you want a house name" second. The catalog tells a
different story: 3,500 natural diamonds, ~24,000 lab stones, 690 Rolex
listings, 455 David Webb pieces, and 104 lab-grown jewelry pieces.

1. **Lab-grown is pushed five times, estate once.** Hero CTA, the Peaceful block,
   the first Shop Worlds card ("The largest jewelry edit", which is internal
   language), the "Pieces for the week" grid, and the closing CTA are all
   lab-grown. The segment with the least price competition and the strongest
   authority (signed estate, watches) gets one block. Recommendation: decide the
   lead deliberately. The strongest defensible position the evidence supports is
   *"New York jeweler, 30 years in the Diamond District: authenticated signed
   estate and watches, certified diamonds, and everyday lab-grown."* The hero
   can then carry two equal doors: Lab-Grown and Signed Estate.
2. **Laura's strongest credential never appears on the homepage.** Both story
   pages say she started in the trade working with her brother Jacob Arabo
   (Jacob & Co., then Diamond Quasar), and the store sells Jacob & Co. It is
   the single most distinctive, citable fact about the brand for search and
   AI engines. Surface it once, factually, in the brand-story block and in
   `Organization`/`Person` schema, if Laura is comfortable with that.
3. **One concept, five names.** Pre-Owned Maison, Maison Vault, Authenticated
   Estate, Vintage & Estate, Estate (Pre-Owned) Jewelry, plus handles
   `vintage-jewelry` and `estate-jewelry`. Shoppers search "pre-owned" and
   "estate", not "maison". Pick one visible label (suggest **Pre-Owned & Estate**)
   and use it in the nav, hero, footer, breadcrumbs and SEO titles.
4. **Sub-brand ambiguity: Peaceful Diamonds.** The nav and homepage say
   "Lab-Grown Jewelry"; the sub-collections' SEO titles say "| Peaceful
   Diamonds"; the collection title says "Peaceful Diamonds by Laura Milman New
   York"; product schema rewrites the Peaceful brand to Laura Milman New York.
   Decide whether Peaceful Diamonds is a customer-facing brand. If it is, name
   it consistently. If it is not, remove it from titles.
5. **Two competing founder stories.** `/pages/about` ("trained as a nurse… raised
   our family… drew at the kitchen table") and `/pages/lauras-story` ("studied to
   become a nurse, but that wasn't her passion… designed clothing… King of
   bling") tell different versions, and both are linked in the footer. Merge them
   into one canonical page and 301 the other.
6. **Watch policy used as a trust badge.** "Watches: Exchanges Only" sits in the
   homepage trust strip next to "Authenticity Guaranteed". It is a restriction,
   not a reassurance. Keep it on the PDP and the policy page and remove it from
   the strip.
7. **`/pages/shop` duplicates the homepage.** Its template has the same 12 sections.
   It is thin duplicate content. Redirect it to the homepage or to `/collections/all`.
8. **Legacy promotional copy is still live** on several collections: Omega ("Keywords:
   pre-owned Omega, Omega Speedmaster…"), Chopard ("unbeatable value"),
   `vintage-jewelry` ("investment-worthy", "Art Deco rings"), `estate-jewelry`
   ("at a fraction of the original price"). This contradicts the newer
   fact-only voice in `docs/seo/listing-seo-geo.md` and makes claims that
   aren't backed up.
9. **Boilerplate suffix.** Nearly every collection meta description ends "Authenticated
   by Laura Milman New York." That includes new house chains, men's wedding bands
   and stud earrings, where it doesn't apply. It reads as filler to people and
   as duplication to search engines. Keep it on estate and watch collections only.

### Claims to verify before they stay live

| Claim | Where | Question |
|---|---|---|
| "Every Laura Milman New York piece… brought to life by master goldsmiths in Italy" / "Crafted in Italy" | Brand story, footer bottom line and description, PDP heritage block, ring builder page, Peaceful collection description | True for Royal Chain chains (house vendor) and Peaceful Diamonds pieces? If not, scope the claim to the pieces it is true for. |
| "Every stone arrives with an independent grading certificate" | PDP lab-grown block | Melee in tennis bracelets usually has no per-stone certificate. Scope it to "centre stones" or "each piece". |
| "typically 40–60% less than comparable mined diamonds" | PDP lab-grown block | Lab-grown pricing in 2026 is usually far below mined. Use the current real number or drop it. |
| "our own authentication documentation ships either way" | PDP estate block | Is a document actually included with every estate order? |
| "Complimentary annual inspection for the life of the piece", "Complimentary resizing on most rings" | Care guide, ring size guide | Consistent with the 1-year warranty and the 7-day returns? |

## 3. Layout and UX

**Homepage (15 sections).** The order is Hero → Trust → Lab-grown → Estate →
Chains → Shop Worlds → Lab-grown grid → Private clients → Categories →
Watches → Fine jewelry → Diamonds → Quote → Story → Testimonials →
Newsletter → Closing CTA. That is long for mobile, and the lab-grown message
repeats. Suggested order (about 10 sections): Hero with two doors → Trust
strip → Category grid → Signed Estate (brands) → Lab-Grown → Watches →
Diamonds → Story (with the Jacob & Co. line) → Real reviews → Newsletter. Drop
the duplicate lab-grown grid, Shop Worlds (it repeats the nav) and the
closing CTA.

**Hero.** The background file is `lmny-hero-silk-espresso-wine.png` at 55%
opacity. From the name it is a texture, not jewelry (**verify live**). The
first screen should show a product or a person wearing one.

**Navigation.**
- Seven top-level items, and the parents aren't links: "Jewelry" and
  "Diamonds" can't be clicked through to a landing page on desktop.
- Engagement Rings appears under both Diamonds and Wedding.
- There is no top-level route to Private Clients or About. Private
  Clients (bespoke, appointments) is a high-value service that only appears
  in a homepage block and the footer.
- The header uses the hardcoded menu, so the Shopify `main-menu` and the
  `footer-*` menus are unused but still in admin. They still link to
  `/pages/our-story`, `/pages/sustainability`, `/pages/press` and
  `/pages/size-guide`, none of which exist, and `lab-grown-jewelry`. Anything
  that reads Shopify menus (the Shop app, PageFly) picks up those broken links.
  Clean them up or delete them.
- `header-group.json` settings (`menu_type_desktop: drawer` etc.) are ignored
  by the custom header. That's harmless but confusing in the theme editor.
- The logo `<img>` has `height="auto"`, which is not a valid attribute. That
  gives no aspect ratio and a small layout shift (CLS).

**Collections.**
- `bracelets` is a manual collection of 29 hand-picked items, while `bangles`
  (a sub-menu of Bracelets) has 56 and there are hundreds of estate and lab
  bracelets. The same risk applies to `necklaces`/`rings` (**verify their rules**).
  Category hubs should be automated by product type across every source.
- `wedding-bands` has 5 products and `mens-wedding-bands` has 48, so the women's
  bands are effectively missing.
- Several brand collections have 1–5 pieces (Asprey, Chaumet, Ilias
  Lalaounis, Chanel, Aletto Brothers, Omega). Keep them, but don't list them in
  the nav.
- `lab-grown-jewelry` has ~24,400 products because it contains the loose lab
  stones. It shares the SEO title "Lab-Grown Jewelry | Laura Milman" with the
  real lab jewelry collection, so the two compete for the same search. Restrict
  it to jewelry, or redirect it to the Peaceful collection.
- The hardcoded `collection_intro` in `main-collection.liquid` overrides the
  admin description for 8 handles, so edits in admin silently do nothing there.
  Move that copy into the admin descriptions.
- David Webb (455 pieces, the largest brand) has no buying guide link in
  `snippets/collection-guide.liquid`, while Cartier/VCA/Tiffany do.

**Product pages.**
- The order is good: gallery → title → price and installments → trust → badges
  → options → Add to Cart → concierge (Ask / Make an offer / Message) → specs →
  description → education → recommendations.
- Missing near the buy button: delivery estimate, return window per category
  (the watch exception is handled), and size guide links for rings and chains.
- House product handles such as `necklace`, `necklace-2`… `necklace-6`, and
  titles like "Diamond Snack Pendant" (probably "Snake"), hurt both search and
  trust. Rename the handles (with redirects) and fix typos.

**Popup.** A modal opens after 8 seconds on every first visit, including
product pages and mobile. The code (LMNYWELCOME) is also printed on the
homepage newsletter block, so the email gate captures nothing. Show it on
exit intent or scroll depth on desktop and as a small bottom bar on mobile,
and stop printing the code before signup if list growth is the goal.

**Footer.** Column titles are `<h5>`s used as accordion toggles on mobile.
They skip heading levels and aren't buttons, so they can't be operated with a
keyboard. There's no phone number, address or appointment line, even though
the story says "greeting clients in midtown Manhattan".

## 4. Technical SEO

1. **Redirects to the homepage.** There are 1,027 URL redirects. In a sample of 50,
   48 point to `/`, and a filter count suggests up to ~960 do. Google treats
   redirect-to-home as a soft 404, so the old product URLs pass no value.
   Repoint them to the closest category (anklets → bracelets/chains, earrings →
   the new earrings hub, and so on). Two stale rules also cover live pages:
   `/collections` → `fashion-jewelry-under-250` (which doesn't exist) and
   `/collections/engagement-rings` → `/`. Shopify ignores them while the pages
   exist, but they become traps if a page is ever removed. Delete them.
2. **No favicon is set**, so no `<link rel="icon">` is output and
   `Organization.logo` is omitted, because the schema uses the favicon as the
   logo. Upload a square favicon and point `Organization.logo` at the real
   lockup (`LMNY-header-lockup.png`) at least 112 px wide.
3. **Organization schema is thin.** It has city only, email only, and `sameAs`
   is Instagram only. Add the street address or "by appointment" showroom (if
   public), telephone, `founder` (Person: Laura Milman), `foundingDate`
   (verified), the Google Business Profile URL and other profiles in `sameAs`,
   and `hasMerchantReturnPolicy`. Consider `JewelryStore` (a LocalBusiness
   subtype) if clients are received in Midtown.
4. **The Google Business Profile name is probably still "Laura's Gems".** The
   reviews widget's injected schema names Laura's Gems, which suggests the
   profile itself still uses that name. The theme deletes that JSON-LD on the
   client side, which hides the symptom but not the name mismatch that Google
   and AI engines see. Rename the profile (or confirm it is correct) so the
   name, address and phone match across the site and the profile.
5. **Product schema gaps** (`snippets/structured-data-product.liquid`):
   - A single `Offer` from the selected variant. Multi-variant pieces (ring
     sizes, chain lengths) should output `AggregateOffer` or `ProductGroup` with
     `hasVariant`.
   - No `shippingDetails` or `hasMerchantReturnPolicy`. Google's merchant
     listings use both, and the 7-day / exchange-only rules are simple to
     express.
   - No `additionalProperty`. Diamonds (carat, colour, clarity, cut, lab,
     certificate number), watches (reference, case size, year, box/papers) and
     estate pieces (signature, era) all have the data in `custom.*`
     metafields. This is the highest-value GEO change, because AI shopping
     answers match on exactly these facts.
   - `gtin`/`mpn`: MPN only from a legacy global metafield. For watches, map
     the reference to `mpn`.
6. **Article schema.** `author` is typed `Person` with the name "Laura Milman New
   York", which is an organisation. Either publish as Laura Milman (Person, with a
   bio and a link to the story page) or type the author as Organization. No
   article featured image has alt text (0 of 9).
7. **Reviews page isn't crawlable.** `/pages/google-reviews` is a SociableKit
   JavaScript embed with an empty body, so search engines and AI crawlers see
   nothing. Put a few real reviews in the page body as text.
8. **Assets.** The editorial images served through `asset_url` (for example
   `fine-jewelry-model-earrings.jpg` at 365 KB, and the `shop-world-*` images)
   skip Shopify's responsive resizing. Move them to Files / `image_url` so
   they get a `srcset`. There are also 44 inline `<style>` blocks across
   sections. That's acceptable, but it adds up on the long homepage.
9. **Orphan templates.** `page.best-bars-nyc`, `page.hotel-bars-nyc` and
   `page.power-dressing-nyc` have no page using them. Either publish them
   (they fit the Journal's NYC lifestyle angle) or delete them.

## 5. GEO / AEO (being cited by AI answer engines)

What already works: `llms.txt` and agentic commerce endpoints (September 9
audit), the fact-only listing voice, Product, Breadcrumb and CollectionPage
JSON-LD, visible FAQs in the nine Journal articles, and the FAQ page with
matching `FAQPage` markup.

What would move citations:

1. **One quick-facts page about the business** (can be the merged About page).
   Put it in short, quotable sentences: who Laura Milman is, founding year,
   the Diamond District/Midtown location, the Jacob Arabo connection (if Laura
   approves), what is sold (house jewelry, certified loose diamonds, signed
   estate, pre-owned watches, lab-grown), how authentication works, and the
   policies. AI engines cite pages that state facts plainly. Today those facts
   are spread across hero copy and accordions.
2. **Answer-first intros on the priority collections.** Two or three sentences
   that answer the buyer's question before the grid. Examples: *"Is this David
   Webb signed? Every piece lists its signature and hallmark location…"* and
   *"Rolex listings state reference, case size, year and whether box and papers
   are included."* Most of the current intros describe the page ("Pre-owned X,
   authenticated…") rather than answer something.
3. **Journal coverage doesn't match the inventory.** 6 of 9 articles are
   lab-grown or styling. There's nothing on David Webb (455 pieces), Rolex (690
   listings) or natural diamonds (3,500 stones). The four guides in SEO plan P12
   are the right next pieces. Also, nothing has been published since
   2026-08-26, so check whether the `journal-draft` workflow is running.
4. **Attribute data in the schema** (section 4, item 5): this matters most for
   ChatGPT, Gemini and Perplexity shopping results.
5. **One name for the business everywhere.** Laura Milman New York vs Laura's
   Gems vs Milman New York vs Peaceful Diamonds splits the brand across
   several entities. Fix the vendors (September 9 audit, fix #4), the Google
   Business Profile, and the sub-brand decision in section 2.
6. **Comparison and policy answers on the pages people land on.**
   "Lab-grown vs natural", "IGI vs GIA" and "box and papers" are answered in
   the Journal. Link to them from the matching collection and PDP education
   blocks so the answer sits next to the product.

## 6. Relation to existing plans

Already tracked, not repeated here: missing product SEO fields, product
types, vendor merge, gallery alt text, era data and draft duplicates
(September 9 audit #2–#5, #10, #12; SEO plan P2–P4, P6, P9, P11). New in
this audit: items 1–6 in section 1, all of sections 2–3, and section 4
items 1–2, 4–6 and 8–9. Section 4 item 3 and section 5 extend plan P7, P8
and P12.

## 7. Suggested order of work

1. **This week (links and claims):** create or repoint `earrings`; one complete
   estate hub; real All Jewelry collection; Jacob & Co. education fix; testimonial
   verification; favicon and logo.
2. **Next (UX and accessibility):** keyboard-accessible nav and skip link; homepage
   trimmed to about 10 sections with two doors in the hero; estate naming; merged
   About page; `/pages/shop` redirect; trust strip.
3. **Then (search and AI):** repoint the homepage redirects; Organization/Person
   schema; product `additionalProperty`, shipping and returns data; answer-first
   collection intros; Google Business Profile name; estate and watch Journal guides.

Each theme change goes through git and a preview theme, per
`ORCHESTRATION.md` workflow D. Collection rules, redirects and the Business
Profile are admin changes that need the merchant's approval.
