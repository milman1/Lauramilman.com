# Chain listing schema (house-brand basic chains)

## Purpose

This is the listing style for the store's house-brand basic gold chains: what
the title, body, SEO fields, specifications, tags, and variants must contain,
and what they must never contain. It exists so a chain listing written by hand
matches one written by the generator, and so both match the way the storefront
theme renders a product page. The formulas here are implemented in
`src/royalchain/listing.ts`; this document is the readable statement of them,
not a second source of truth. Everything below states facts that came from the
supplier record or the merchant — a fact nobody supplied is left empty, never
inferred.

## Product page anatomy

`sections/main-product.liquid` renders a product page in two separate places:

- **The body.** `product.descriptionHtml` is printed as prose. It is the only
  place a sentence belongs.
- **The Specifications grid.** The section builds the grid from
  `product.metafields.custom.<key>` for a fixed key list (`spec_defs`):
  `brand, model, reference, year, diamond_shape, carat_weight, case_size,
  metal, dial, bezel, bracelet, clarity, color, condition, condition_grade,
  setting_style, length, box, papers, original_tag, link, width, clasp,
  finish, stock_number`. A key with no value renders no row, so a chain never
  shows Dial or Carat Weight and a watch never shows Clasp.

A spec placed in the body instead of a metafield is invisible to the grid, and
a metafield whose key is not in that list is invisible to the page. The
reference product for this style is
`lab-grown-round-diamond-station-bracelet-065-ct-14k-yellow-gold-bc2423`: its
body is a single `<p>`, and its grid shows Metal, Diamond Shape, Carat Weight,
Clarity, Color, and Setting Style.

## Title

```
{width}mm {Style} Chain {Necklace|Bracelet} in {metal}
```

`Necklace` for lengths from 14 in, `Bracelet` below 14 in; a source whose
lengths cross that boundary becomes two products. Example:
`3.9mm Cuban Chain Necklace in 14K Yellow Gold`.

## Body

Exactly one paragraph. No heading, no list, no `<section>` wrapper, no specs.

```
<p>This {width}mm {style lowercase} chain {necklace|bracelet} is crafted in
{metal} and offered by Laura Milman New York.{ closing sentence }</p>
```

The closing sentence is written only from known facts: with both a finish and a
clasp, ` Finished {finish lowercase} and closed with a {clasp lowercase}
clasp.`; with only one of them, only that one (` Finished polished.` or
` Closed with a lobster clasp.`); with neither, nothing. `&`, `<`, and `>` are
escaped.

Example:

```html
<p>This 3.9mm cuban chain necklace is crafted in 14K Yellow Gold and offered by Laura Milman New York. Finished polished and closed with a box with figure 8 clasp.</p>
```

## Specifications

Namespace `custom`, type `single_line_text_field`. Write a key only when the
fact is known; leave it empty when it is not, and the theme hides the row.

| key | value | example |
|---|---|---|
| `metal` | metal name | `14K Yellow Gold` |
| `link` | chain style, Title Case | `Cuban` |
| `width` | `{n} mm` | `3.9 mm` |
| `length` | every available length, comma-joined, unit once at the end; a single length is just the one value | `18, 20, 22, 24, 26 in` / `8.5 in` |
| `clasp` | closure as given by the source | `Box with Figure 8` |
| `finish` | finish as given by the source | `Polished` |
| `condition` | `New`, only when the source record states a condition and its evidence is kept | `New` |
| `ebay_condition` | eBay condition ID under the same gate: `1500` for a source-confirmed new item, `1000` only with explicit original-packaging evidence, `3000` pre-owned | `1500` |

`custom.metal_type` and `custom.measurements` are not used. Neither has a live
metafield definition and neither is in `spec_defs`, so anything written there
never reaches the page. Construction (solid, semi-solid, lite) is not published:
it has no grid key and does not go in the body.

## SEO

**Title** — the product title with the intent suffix reserved, 60 characters or
fewer, truncated at a word boundary:

```
{title} | Laura Milman
```

`3.9mm Cuban Chain Necklace in 14K Yellow Gold | Laura Milman`

**Description** — 160 characters or fewer, truncated at a word boundary. More
than one length is stated as a span, a single length as itself:

```
Shop the {width}mm {style lowercase} chain {necklace|bracelet} in {metal},
available in {18 to 26 in | 8.5 in}, from Laura Milman New York.
```

`Shop the 3.9mm cuban chain necklace in 14K Yellow Gold, available in 18 to 26 in, from Laura Milman New York.`

Chains are house-brand new goods, so they carry no authentication sentence in
the body and no "Authenticated by Laura Milman New York." in the SEO
description; that closing belongs to pre-owned and estate schemas.

## Tags, type, vendor, category

Vendor is `Laura Milman New York` — the house brand, never the supplier.
Product type is `Necklaces` from 14 in and `Bracelets` below it, plural per the
store convention, never blank; the Shopify category is the taxonomy id for that
type. Tags are the vendor and the product type, plus `media-missing` while
fewer than three images have been imported. A draft never carries `ebay`:
marketplace activation is a separate, reviewed step.

## Variants

One option, `Metal and Length`, with values such as `14K Yellow - 18 in`; every
available length is a variant. SKU is the supplier item number plus the length
suffix (`NMC120-18`) — a parent item number is never reused as a marketplace
SKU, and every variant's SKU is unique. Each variant carries the exact
supplier-reported gram weight, is inventory-tracked with the `DENY` policy, and
is planned with no positive quantity, so a draft cannot be sold. Variants below
14 in and from 14 in never share a product.

## Media

Four images are the target and three the gate: hero, detail, on-body,
lifestyle. Supplier photographs are the product images; generation is only for
lifestyle or on-body frames. Source URLs are proposed media only — Shopify
imports them and serves the result from its CDN, and only post-import
`cdn.shopify.com` URLs count. Fewer than three verified CDN images means the
product stays DRAFT and carries `media-missing`. Alt text is the product title,
with `— view 2`, `— detail view`, `— on-body view` appended for later images.

## Marketplace readiness

The private plan's `ebay` object is a readiness record, not a Shopify field and
never an instruction to publish. It carries an eBay title of 80 characters or
fewer, bracelet- or necklace-correct item specifics, and the Marketplace Connect
mapping (`Metal → custom.metal`, `Style → custom.link`, `Width → custom.width`,
`Length → custom.length`, `Closure → custom.clasp`, `Finish → custom.finish`,
`Condition → custom.condition`, `Condition ID → custom.ebay_condition`). It
becomes eligible only with three imported CDN images, complete copy (`metal`,
`link`, `width`, and `length` all present), source-backed condition evidence, a
unique child SKU, an exact positive gram weight, and explicit supplier
availability for every variant. Any gap is listed as a blocker instead.

## Never

- The supplier's name or domain, in any field: title, body, SEO, tags, alt
  text, handle, metafield, or variant value. The scrub is fail-closed and a hit
  throws rather than being edited around.
- Cost or any price language in public copy. Cost lives in Cost per item and in
  the private plan only.
- A Details list, a spec table, or any spec sentence in the body.
- An invented spec: width, length, finish, clasp, construction, or condition
  that the source did not state.
- `custom.metal_type` or `custom.measurements`.
- Care, fulfillment, packaging, provenance, or authentication claims; hype
  words; an `ebay` tag on a draft; ACTIVE set by a job.

## Pricing

Retail is cost × 3, rounded up to $5, and that rule is Royal Chain's alone.
The numbers live in `config/pricing.ts` (`SUPPLIER_INTAKE`) and are changed only
by pull request against that file; never restate or hardcode them elsewhere.
Cost and retail appear only in the private execution plan, which is written
outside the repository because it contains Cost per item.

## How to run

Generate the DRAFT intake plan from the reviewed shortlist and the private cost
CSV (joined by exact item number and URL; the reviewed width facts override the
shortlist only for `PCLIP095` at 4.1mm and `HSR018` at 2.7mm, and a non-numeric
width fails the plan):

```sh
npx tsx scripts/generate-royalchain-product-plan.ts \
  --shortlist=../docs/suppliers/royal-chain-shortlist-2026-09.csv \
  --private=/approved/private/93-royal-chain-costs-2026-09.csv \
  --output-dir=/approved/private/royalchain-product-plan
```

Recompute body, SEO, and Specifications metafields for chains that already
exist in the store, from a saved catalog snapshot:

```sh
npx tsx scripts/royalchain-pdp-plan.ts \
  --catalog=<catalog-snapshot.json> \
  --output=<rc-plan.jsonl>
```

It prints the product count, the per-key metafield fill, and any product
missing `metal`, `link`, `width`, or `length`. Both commands write plan files
only: no Shopify client, no network, no live catalog operation. Applying a plan
is a separate, reviewed step, and the products stay DRAFT until a person
approves the batch.
