# SEO & GEO Copy — Laura Milman New York

Single reference for **search-engine optimization (SEO)** and **generative-engine optimization (GEO)** copy across lauramilman.com, Shopify Admin, and eBay (Marketplace Connect).

**Related docs (implementation detail):**

| Doc | Scope |
|---|---|
| [`lmny-feeds/docs/seo-title-formulas.md`](../lmny-feeds/docs/seo-title-formulas.md) | SEO title formulas only |
| [`lmny-feeds/docs/watch-listing-schema.md`](../lmny-feeds/docs/watch-listing-schema.md) | Feed watch titles, body, SEO, metafields |
| [`SHOPIFY_SETUP.md`](../SHOPIFY_SETUP.md) | Estate metafield definitions, import scrub rules |
| [`snippets/structured-data-product.liquid`](../snippets/structured-data-product.liquid) | Product JSON-LD on PDPs |
| [`layout/theme.liquid`](../layout/theme.liquid) | Homepage / collection / blog meta defaults |

---

## Principles

1. **Lead with what people search for** — brand, reference, carat, shape, color/clarity, condition, product type.
2. **Never invent facts** — copy must come from feed data, supplier specs, or confirmed LMNY claims.
3. **Separate concerns** — product title, SEO title, body HTML, specs grid, and JSON-LD each have a job; avoid duplicating full spec tables in the body.
4. **GEO = cite-able facts** — write sentences AI can quote: who offers it, what it is, condition, certification, box/papers, year, metal, reference.
5. **eBay-safe language** — never “New with box and papers” on pre-owned stock; use `custom.ebay_condition` (`3000` / `1000`) and `custom.features` (`With Box`, `With Papers`).

---

## Character limits

| Field | Max | Notes |
|---|---:|---|
| SEO title (`seo.title`) | **60** | Theme appends ` – Laura Milman New York`; do **not** repeat store name in sync-written titles |
| SEO description (`seo.description`) | **160** | Truncate at word boundary |
| JSON-LD description | **500** | Theme strips HTML from `product.description` |
| Product title | No hard cap | Watches: include full reference even if long |

---

## Product types & who writes copy

| Segment | Product title / SEO / body | Source |
|---|---|---|
| Feed watches (`w-*`, `tag:lmny-feed`) | API sync | `lmny-feeds/src/watchListingBuilder.ts` |
| Feed diamonds (`nd-*`, `lg-*`) | API sync | `lmny-feeds/src/product.ts` |
| Back Vault estate (`bv-*`, `tag:backvault-feed`) | API sync | `lmny-feeds/src/backvault/listing.ts` |
| Legacy estate / manual jewelry | Shopify Admin | Formulas below |
| eBay listing body | Marketplace Connect | Syncs Shopify description + mapped metafields |

After schema changes, bump `PRODUCT_SCHEMA_VERSION` in `lmny-feeds/src/product.ts` so the hourly feed refreshes active products once.

---

## SEO title formulas

### Loose diamonds (feed)

- **Product title:** `{carat}ct {shape} {Natural|Lab-Grown} Diamond — {color} {clarity}, {lab} Certified`
- **SEO title:** `{carat}ct {shape} {Natural|Lab-Grown} Diamond — {color} {clarity} | {lab}`

Example: `2.01ct Round Natural Diamond — F VS1 | GIA`

Always keep the lab suffix when truncating.

### Watches (feed)

- **Product title:** `{Pre-Owned|Unworn} {Brand} {Model} {reference}`
- **SEO title:** `{Brand} {Model} {reference} – {Pre-Owned|Unworn} Watch`

If condition is unclassified: `{Brand} {Model} {reference} Watch` (no invented Pre-Owned/Unworn).

### Estate jewelry & watches (Back Vault)

- **Product title:** `{Brand} {normalized identifying details}`
- **SEO title (jewelry):** `{lead} | Estate Jewelry` (≤ 60 chars, suffix reserved)
- **SEO title (watch):** `{lead} | Pre-Owned Watch`

### Manual LMNY jewelry (Admin)

- **Product title:** `{design/model} {primary gemstone} {product type} in {metal}`
- **SEO title:** `{design/model} {gemstone} {product type} | Laura Milman`

Avoid: “Beautiful”, stock numbers, price, duplicate category words, promotional fluff.

---

## SEO description formulas

All feed SEO descriptions end with **Authenticated by Laura Milman New York.** where the schema specifies it.

| Segment | Formula |
|---|---|
| **Watch (classified)** | `Shop this {pre-owned\|unworn} {Brand} {Model} {reference}{, grade if present}. Authenticated by Laura Milman New York.` |
| **Watch (unclassified)** | `Explore this {Brand} {Model} {reference} watch from Laura Milman New York.` |
| **Natural / lab diamond** | `Shop this {carat}ct {shape} {natural\|lab-grown} diamond, graded {color} {clarity}{, cut if present} and certified by {lab}.` |
| **Estate jewelry** | `Shop this {Brand} estate {noun}{metal/era/grade clauses}. Authenticated by Laura Milman New York.` |

---

## Body copy (HTML description)

### Feed watches

Implemented in `watchListingBuilder.ts`. One opening `<p>` plus optional comment/trust paragraphs.

**Template:**

```html
<p>This {Pre-Owned|Unworn} {Brand} {Model} {reference}{ from Year} is offered by Laura Milman New York{ box/papers clause}.{ link sentence}{ grade sentence}</p>
<p>{supplier comment — omitted when redundant, e.g. NAKED + no box/papers}</p>
```

**Box/papers clauses (eBay-safe):**

| Box | Papers | Copy |
|---|---|---|
| Yes | Yes | with its original box and papers |
| Yes | No | with its original box, but without papers |
| No | Yes | with its papers, but without the original box |
| No | No | on its own, without box or papers |

**Link sentence** (feed `Links` field):

| Value | Copy |
|---|---|
| `n` > 0 | It includes {n} additional bracelet link(s). |
| `-n` | The bracelet is {n} link(s) short of a full set. |

**Never in body:** price, “New with box and papers”, “full set with box and papers”, HTML spec tables (specs live in metafields + PDP grid).

**Trust line (optional, off by default for feed):**  
`Authenticated and hand-inspected by Laura Milman New York.`  
Enable in `watchListingBuilder.ts` `CONFIG.trustLine` only after confirming it applies to supplier stock.

### Estate (Back Vault)

```html
<p>This {Pre-Owned Brand… | Brand estate {noun}…} is offered by Laura Milman New York.{ condition phrase}</p>
<p>Authenticated and hand-inspected by Laura Milman New York.</p>
```

### Planned enrichment (feed watches)

After eBay takedown, consider a second factual sentence weaving **case size, metal, dial, bezel, bracelet** when present — specs stay in the grid; prose aids GEO citations.

---

## Specs grid vs description (GEO)

**Storefront:** `sections/main-product.liquid` renders `custom.*` metafields in a **Specifications** block (watches, estate, diamonds).

| Data | Body prose | Specs grid | JSON-LD |
|---|---|---|---|
| Brand, model, reference | Title + opening sentence | Yes | `brand`, `mpn` |
| Condition | Opening / grade sentence | Yes | `itemCondition` |
| Box / papers | Opening sentence | Yes | — |
| Link count | Link sentence (feed) | Yes (`Link: -5`) | — |
| Dial, bezel, bracelet, metal, MM | Optional future prose | Yes | `material` (metal) |
| Diamond 4Cs | SEO + diamond template | Yes (stones) | — |

AI engines cite **complete sentences** in the body and **structured fields** in JSON-LD. Both matter for GEO.

---

## Theme & structured data (GEO)

### Every product PDP

`snippets/structured-data-product.liquid` outputs:

- **Product** — name, stripped description (500 chars), images, brand, SKU, category, `itemCondition`, Offer (price, availability)
- **BreadcrumbList** — Home → Collection (if any) → Product

`itemCondition` is `UsedCondition` when vintage tag, or `custom.condition` contains pre-owned/used; otherwise `NewCondition`.

### Site-wide (`layout/theme.liquid`)

- **WebSite** + **SearchAction**
- **Organization** + `sameAs` social profiles
- **CollectionPage** / **ItemList** on collection templates
- **Article** schema on blog posts (`dateModified`, canonical `@id`)

### Social / SERP meta

`snippets/meta-tags.liquid` — Open Graph + Twitter from `seo_page_title` / `seo_meta_description`.

**Homepage defaults:**

- Title: `Fine Jewelry, Diamonds & Estate Pieces`
- Description: certified diamonds, Peaceful Diamonds, authenticated maison pieces, pre-owned timepieces, shipping/returns

**Blank collection descriptions:** auto-filled with collection title + expertise line.

---

## eBay & Marketplace Connect

| Shopify field | eBay use |
|---|---|
| Product description HTML | Listing body (`{EbayDescription}` in `snippets/ebay-default.liquid`) |
| `custom.ebay_condition` | Condition ID (`3000` pre-owned, `1000` unworn) |
| `custom.features` | Features aspect — **not** body copy |
| `custom.model`, `case_size`, `band_material`, etc. | Item specifics when mapped once in Connect |

**Branded eBay template:** `snippets/ebay-default.liquid` + `assets/ebay-styles.css` (LMNY espresso styling). Publish template `default` in Connect after Shopify theme deploy.

---

## Manual checklist (new products)

- [ ] SEO title ≤ 60 chars; intent suffix preserved (`| Estate Jewelry`, `| Pre-Owned Watch`, `| GIA`)
- [ ] SEO description ≤ 160 chars; ends with authentication line where applicable
- [ ] Body: factual, no Back Vault references, no price
- [ ] All relevant `custom.*` metafields filled (specs grid + JSON-LD)
- [ ] Image alt text describes the piece (brand, type, metal/gem), not “image 1”
- [ ] Vendor = maison brand (not supplier name)
- [ ] For watches on eBay: `ebay_condition` + `features` set; never map box/papers onto Condition

---

## Scrub & forbidden copy

Per `SHOPIFY_SETUP.md` §3 — must not appear on any LMNY product:

- The Back Vault / back-vault / supplier branding
- “New with box and papers” on pre-owned listings
- Generic openers (“Beautiful”, “Stunning”)
- Stock numbers in customer-facing titles (SKU stays on variant)

---

## Verification

```bash
# Theme JSON-LD + meta integration
cd lmny-feeds && npm test -- theme-seo

# Watch listing copy rules
cd lmny-feeds && npm test -- watchListingBuilder

# Full feed test suite
cd lmny-feeds && npm test
```

Spot-check live PDP: View Source → search for `application/ld+json`, `itemCondition`, `og:description`.

---

## Roadmap (copy improvements)

1. **Richer feed watch body** — weave dial / case / metal / bracelet when API provides them (post–eBay takedown).
2. **Unify feed + estate voice** — optional authentication paragraph for feed watches once confirmed.
3. **eBay specs block** — map `custom.link`, `custom.dial`, etc. in Connect so eBay “Product specification” matches Shopify grid.
4. **Blog / FAQ GEO** — entity pages for “authenticated pre-owned Rolex”, “estate Cartier”, etc. (content strategy, not sync).

---

*Last updated: 2026-09-07. When formulas change, update this file and the implementing source files in the same PR.*
