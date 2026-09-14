# Product page standards

This is the storefront product-page contract for Laura Milman New York.
Every Active product must match it. Copy voice, GEO scoring, and video
rules live in `docs/seo/listing-seo-geo.md`. Title character budgets live
in `lmny-feeds/docs/seo-title-formulas.md`. This file is the **page**: what
the customer sees, which Admin fields feed each block, and what must never
appear.

Reference jewelry PDP (shape to copy, defects not to copy):
https://www.lauramilman.com/products/lab-grown-round-diamond-station-bracelet-065-ct-14k-yellow-gold-bc2423

Theme source: `sections/main-product.liquid` (jewelry, watches, estate,
house chains). Loose diamonds use `sections/main-product-diamond.liquid`
and template suffix `diamond`.

---

## 1. Page anatomy (top to bottom)

The default product template (`templates/product.json`) renders in this
order. Do not paste extra HTML into the description to recreate any of
these blocks.

| # | Block | Source | Notes |
|---|---|---|---|
| 1 | Breadcrumb | Theme | Home / collection / truncated title |
| 2 | Gallery | Product media | Native/external **video first**, then images. Alt on every file |
| 3 | Title | Product title | Identity-first. No price, no hype, no supplier |
| 4 | Price and installments | Variant price | Theme prints price. Body never does |
| 5 | Trust strip | Theme | Free insured shipping; lifetime warranty; **14-day returns** on jewelry, **Exchanges only** on watches |
| 6 | Badges | Tags | Lab-grown / estate / pre-owned / vintage / metal pills when those tags exist |
| 7 | Options and add to cart | Variants | Length, metal, size as real variants — not a sentence in the body |
| 8 | Inquiry | Theme snippet | Leave in place |
| 9 | Specifications | `custom.*` metafields | Empty keys are hidden. Do not duplicate as a Details list in the body |
| 10 | Description accordion | `descriptionHtml` | One short factual paragraph (estate may add the authentication sentence) |
| 11 | Education | Theme, by tag/title | Lab-grown cards, estate cards, or house heritage cards |
| 12 | Reviews | Theme section | Do not invent ratings in copy or schema |
| 13 | Recommendations | Theme | Related products |

JSON-LD (`snippets/structured-data-product.liquid`) is automatic: name,
brand, SKU, offer, availability, material, item condition. Structured
data may only restate facts on the product record.

---

## 2. What “done” looks like

A listing may go Active only when all of these are true:

1. Title answers what the object is (type, primary spec, metal; origin or
   condition only when known).
2. SEO title ≤ 60 characters; SEO description ≤ 160; closer matches live
   policy (jewelry: “Free insured shipping and 14-day returns.” Estate
   schemas that require it may use “Authenticated by Laura Milman New
   York.” Watches: no 14-day-return promise).
3. Body is **one `<p>` of facts**. No `<h2>Details</h2>`, no spec `<ul>`
   or `<table>`, no `<video>`, no iframe, no price, no cost, no supplier
   name, no hype (“stunning”, “must-have”).
4. Every fact in the body also lives on a `custom.*` metafield the theme
   can print. Missing facts stay empty; they are never inferred.
5. Product type is set (`Bracelets`, `Necklaces`, `Watch`, … — never
   blank). Marketplace pieces have a Product Category.
6. At least three images for one-of-one and house jewelry going to
   marketplaces; four is the target (hero, detail, on-body or scale,
   lifestyle) where recipe I allows generated frames.
7. Video, if any, is Shopify media and the first gallery item. Description
   has no player.
8. Score ≥ 8/10 on the table in `docs/seo/listing-seo-geo.md`.

---

## 3. Body template (all finished jewelry)

Use this shape. Lab-grown jewelry is the reference.

```html
<p>This {primary spec} {design} {type} is {set in / crafted in} {metal}. {two or three verified specs}.</p>
```

Examples:

- Lab-grown: `This 0.65 CT round lab-grown diamond station bracelet is set in 14K yellow gold. E-F color, VS clarity.`
- House chain: `This 3.9mm Cuban chain necklace is crafted in 14K yellow gold. Polished finish, box with figure 8 clasp, available in 18, 20, 22, 24, and 26 in.`
- Estate: first paragraph as in `lmny-feeds/src/backvault/listing.ts`, plus the second paragraph “Authenticated and hand-inspected by Laura Milman New York.” when the schema requires it.
- New / house-made / boutique unworn: **omit** the authenticated paragraph.

Loose diamonds use the diamond template (`sections/main-product-diamond.liquid`)
with the same inquiry pills, **Specifications** heading, 2-column grid, and
Description accordion. Gemology facts stay in `lmny_feed.*` / `custom.*`
metafields; the body is one paragraph.

Feed watches follow `lmny-feeds/docs/watch-listing-schema.md` (no jewelry
return promise; condition from source facts only). The body is one prose
paragraph; Case size, Year, and bracelet links belong in the spec grid.

---

## 4. Specification grid

The theme prints rows from `custom.*` only. Keys with no value do not
render, so a chain will not show Dial and a watch will not show Width
unless those fields are filled.

Jewelry listings should write **`custom.metal`** (the lab-grown reference
key). `custom.metal_type` is the CSV/setup alias; the theme skips it when
`custom.metal` is already set so Metal is not printed twice.

### Lab-grown and fine jewelry

| Metafield | Grid label | Example |
|---|---|---|
| `custom.metal` | Metal | 14K Yellow Gold |
| `custom.diamond_shape` | Diamond Shape | Round |
| `custom.carat_weight` | Carat Weight | 0.65 |
| `custom.clarity` | Clarity | VS |
| `custom.color` | Color | E-F |
| `custom.setting_style` | Setting Style | Station |
| `custom.condition` | Condition | New |

### House gold chains

| Metafield | Grid label | Example |
|---|---|---|
| `custom.metal` | Metal | 14K Yellow Gold |
| `custom.link` | Chain Style (when the product carries tag `chains`) | Cuban |
| `custom.width` | Width | 3.9 mm |
| `custom.clasp` | Clasp | Box with Figure 8 |
| `custom.finish` | Finish | Polished |
| `custom.construction` | Construction | Semi-solid |
| `custom.length` | Length | 18, 20, 22, 24, 26 in |
| `custom.condition` | Condition | New |

On watches, `custom.link` still means bracelet **Link** (link count).
Never store a chain style in `link` unless the product is tagged `chains`.

### Watches

Use the watch keys the theme already maps: brand, model, reference, year,
case size, metal, dial, bezel, bracelet, condition, box, papers. Condition
ID (`custom.ebay_condition`) is for marketplaces, not a storefront prose
claim. `1000` only for source-confirmed Unworn with box and papers.

### Estate jewelry

| Metafield | Grid label | Example |
|---|---|---|
| `custom.metal_type` | Metal (when `custom.metal` is empty) | 18K Yellow Gold |
| `custom.metal_weight` | Metal Weight | 32.5 g |
| `custom.diamond_weight` | Diamond Weight | 2.10 ct |
| `custom.measurements` | Measurements | 7 in |
| `custom.gemstones` | Gemstones | Emerald |
| `custom.era` | Era | Art Deco |
| `custom.condition` | Condition | Pre-owned |

Brand, metal, measurements, gemstones, era, condition as known. Empty
cells stay empty.

Do not put cost, supplier names, or SKU-as-marketing in any `custom.*`
field that the storefront prints.

---

## 5. Media

- **Hero first** among stills. Video, when present, is first among all
  media.
- Alt text: product title; later stills append “view 2”, “view 3”.
- Real photos only for estate, watches, Jacob & Co., and any one-of-one.
  Generated stills are allowed only for house chains, Peaceful Diamonds
  jewelry, and made-to-order, per recipe I in `AGENTS.md`.
- Never hotlink a supplier CDN in the description.
- Do not paste `<video>` into `descriptionHtml`. If Shopify video quota
  blocks native media, that is a temporary exception documented in
  `docs/seo/listing-seo-geo.md`, not the standard.

---

## 6. Variants, type, and channels

- Lengths, metals, and sizes are **variants**, not body copy.
- Product type is plural for jewelry (`Necklaces`, `Bracelets`, `Rings`,
  `Earrings`, `Pendants`) and singular `Watch`. Loose stones use
  `Natural Diamond` / `Lab-Grown Diamond`.
- House chains: lengths under 14 in are Bracelets; 14 in and above are
  Necklaces. Do not mix those types on one product.
- Online Store publication is required or the PDP 404s / collections show
  “coming soon” even when Admin is Active.
- eBay is a separate surface (`snippets/ebay-default.liquid` in
  Marketplace Connect). Storefront copy standards still apply to the
  Shopify product; the eBay template is not the PDP.

---

## 7. Education block (do not override in the body)

`sections/product-education.liquid` picks a mode from tags and title:

| Mode | When | Customer sees |
|---|---|---|
| Lab | Title or tags contain lab-grown / lab created | Lab-grown education cards |
| Estate | Tags contain estate, pre-owned, or vintage | Authentication / condition cards |
| Heritage | Everything else (house jewelry, chains) | Designed in New York / crafted in Italy |

Do not paste those claims into `descriptionHtml`. House chains stay on
heritage unless they are actually lab-grown or pre-owned.

---

## 8. Never on the page

- Supplier names: The Back Vault, Royal Chain, Bucherer, Exquisite
  Timepieces, or any future source (`lmny-feeds/src/backvault/scrub.ts`).
- Cost, wholesale, or margin.
- Hype, invented provenance, celebrity ownership, fake reviews.
- A 30-day return promise (store policy is 14-day jewelry returns).
- Duplicate spec tables in the description accordion.
- Watch “Link” labeling on chain products (use Chain Style via tag
  `chains`).

---

## 9. Per-source builders

A listing formula is code, not a one-off prompt.

| Source | Builder / schema |
|---|---|
| Lab-grown jewelry (Peaceful Diamonds) | This file + `docs/seo/listing-seo-geo.md` |
| House gold chains | `lmny-feeds/src/royalchain/listing.ts`, `lmny-feeds/docs/royal-chain-listing-schema.md` |
| Estate (Back Vault feed) | `lmny-feeds/src/backvault/listing.ts` |
| Feed watches | `lmny-feeds/src/watchListingBuilder.ts`, `lmny-feeds/docs/watch-listing-schema.md` |
| Loose diamonds | Belgium sync + diamond product template |
| Jacob & Co. | Recipe G2 in `AGENTS.md` |

---

## 10. Acceptance before Active

- [ ] Title, SEO title, SEO description, body, alt, tags, handle: scrub
      passes (`lmny-feeds/src/backvault/scrub.ts`).
- [ ] SEO title ≤ 60, SEO description ≤ 160, policy closer is true.
- [ ] Body is one paragraph; specs are metafields; no Details heading.
- [ ] Spec grid on a preview matches the body (no extra invented rows).
- [ ] Product type and (if marketplace) category are set.
- [ ] Images meet the gate; video is first if present.
- [ ] Product is published to Online Store; public URL loads.
- [ ] Listing-seo-geo scorecard ≥ 8/10.

Related: `docs/seo/listing-seo-geo.md`, `SHOPIFY_SETUP.md` §1 (metafield
definitions), `snippets/structured-data-product.liquid`.
