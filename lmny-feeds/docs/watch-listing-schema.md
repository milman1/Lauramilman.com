# Watch Listing Schema — LMNY

The single source of truth for how a raw feed record becomes a Shopify listing.
`src/watchListingBuilder.ts` is the live ingest path. The retired
`scripts/lmny_watches_backfill.py` must not overwrite this copy.

## Input

Every field present in the master tracking sheet, minus price and the two
image columns (Image, Pic — those stay as Shopify media, not description
text):

| Field | Sheet column | Example | Notes |
|---|---|---|---|
| `brand` | Brand | `ROLEX` | |
| `model` | Model | `SUBMARINER DATE` | |
| `reference` | Reference | `126610LN` | Case and punctuation preserved exactly — never re-cased. |
| `year` | Year | `2014` \| `FEB-2016` \| `APR-2026` | Optional. Two formats seen; both handled. |
| `conditionRaw` | Condition | `PRE OWNED` | See condition mapping below. |
| `box` | Box | `true` / `false` | Optional boolean. Undefined = not stated (omit from output); stated `false` is real information a buyer wants and is shown. |
| `paper` | Paper | `true` / `false` | Same rule as Box. |
| `ogTag` | OG Tag | `true` / `false` | Same rule as Box. Original hang tag present. Spec-table label: **Original Tag**. **Not present on the Belgium Dia developer API** as of 2026-08-09 — omit until a source exists. |
| `link` | Link / API `Links` | `19` \| `-5` | Optional. Belgium Dia developer API field is **`Links`** (plural); table label stays **Link**. Kept as a string so signed values are preserved. |
| `caseSizeMm` | MM | `36` | Optional. Rendered as "36mm". |
| `bracelet` | Bracelet | `AP BRACELET` \| `BLUE LEATHER STRAP` | Optional, free text, title-cased on output. |
| `dial` | Dial | `GREY TAPISSERIE` | Optional, free text, title-cased on output. |
| `bezel` | Bezel | `OCTAGON` | Optional, free text, title-cased on output. |
| `metal` | Metal | `18K YG & S/S` | Optional. Left as-given — these are industry shorthand (YG/WG/RG/S/S) that's more precise than a normalized version would be. |
| `stockNumber` | Stock# | `P5276` | LMNY's internal stock number. Distinct from `reference`, which is the manufacturer's reference number — do not conflate the two. |
| `comment` | Comment | `NAKED` | Optional, free text. Shown as a second sentence in the same body paragraph UNLESS it's exactly "NAKED" and Box/Paper are both already shown as No — in that case it's redundant and is dropped. |

**Superseded field:** the old single `accessories` free-text field (e.g.
"Full set (box and papers)") is replaced by the explicit `box` / `paper`
booleans above, which is what the source sheet actually tracks. The ~620
already-live watches only have the old combined string in Shopify today, not
these two booleans separately, so the backfill infers `box`/`paper` from the
old string as a bridge.

**Live ingest:** Dial, Bezel, Bracelet, Metal, MM, Links, Comment, and Year
are on the Belgium Dia `developer-api/watch` payload and are mapped through
`normalizeWatches` → `buildWatchListing`. Title, description, and SEO
description are already inside `contentHashFor`, so a builder change refreshes
already-live `w-*` products on the next sync without a schema-version bump.

**Backfill script:** `scripts/lmny_watches_backfill.py` only sees what's in
existing Shopify `descriptionHtml` and cannot recover those physical specs.
Prefer the feed resync path; flag the Python backfill for retirement once the
enriched sync has rewritten the live catalog.

## Condition mapping

Two axes, not one. Get this wrong and every title reads redundant.

**State** — drives the title word and the Google Shopping condition field:

| `condition_raw` | state | title word | Google Shopping `condition` |
|---|---|---|---|
| `PRE OWNED` | preowned | Pre-Owned | used |
| `UNWORN` | unworn | Unworn | new |

**Grade** — describes the condition of a pre-owned piece. Goes in the spec
table only, never the title:

| `condition_raw` | grade |
|---|---|
| `ULTRA MINT` | Ultra Mint |
| `MINT` | Mint |
| `RETAIL READY` | Retail Ready |
| `EXCELLENT` | Excellent |
| `VERY GOOD` | Very Good |
| `GOOD` | Good |
| `FAIR` | Fair |

A grade value implies state = preowned (grading only applies to something
that's been owned). Retail Ready and Ultra Mint are grades. A full box and
papers set does not change them to Unworn, and the eBay condition stays
`3000`. Hyphenated spellings (`PRE-OWNED`, `RETAIL-READY`) normalize to the
same row.

**Anything else** (`SLIDER`, `NEW`, blank, unrecognized text) must stay
unclassified. Do not infer a Pre-Owned or Unworn title. The eBay condition
still fails closed to `3000`. Those rows are not given `uploadify_active`,
because a raw dealer word must not be what Uploadify reads as the condition.
On the live
ingest path, still build the neutral brand/model/reference title, prose, and
physical-spec metafields so an active feed watch can use the current PDP
layout. Preserve a nonblank raw value in `custom.condition` and as a tag; omit
it when blank. The one-time legacy backfill still flags these rows for review
because it cannot recover the richer physical specs from old Shopify HTML.

## Output

### Title
```
{titleWord} {TitleCase(brand)} {TitleCase(model)} {reference} [{caseSize}] [{year}]
```
Condition, brand, and the complete reference are fixed. Preserve the full model
when it fits; otherwise shorten only the model, at a whole-word boundary, until
the fixed identity fits the 80-character limit. The full model remains in the
description and metafields. Case size and year are appended in that order only
while the title remains at or below 80 characters. If condition, brand,
reference, and at least one whole model word cannot fit, hold that watch for
review without blocking valid rows in the same sync. Never cut the reference.

Examples:
- `Pre-Owned Rolex Submariner Date 126610LN`
- `Unworn Audemars Piguet Royal Oak Selfwinding 26240BA.OO.1320BA.02`

### Description (HTML)

One `<p>`. The first sentence states the known source facts in order. Missing
case size, metal, dial, bezel, bracelet, year, grade, and link count are
omitted. The body never prints `Not specified`, a labeled spec block, or an
HTML table. When the known facts fill the sentence, it lands in the 40–60 word
GEO answer range. A thinner source stays shorter. Do not pad.

```html
<p>This {pre-owned|unworn} {Brand} {Model} reference {reference} is a {case size} {metal} watch with a {dial} dial, a {bezel} bezel, and a {bracelet} bracelet from {year} in {grade} condition, including {n} additional bracelet links, offered by Laura Milman New York {boxPaperClause}. {comment}</p>
```

An unclassified condition drops the condition word. Plain metals such as
`STEEL` are lowercased in the sentence. Industry shorthand such as
`18K YG & S/S` stays as given. Dial, bezel, and bracelet are lowercased. A
source value that already says bracelet, strap, or band is not labeled twice.
A supplier comment that is not a redundant `NAKED` is a second sentence in the
same paragraph.

Specs are written to storefront-readable `custom.*` metafields and rendered by
the theme’s jewelry-style `.product-specs` grid in `sections/main-product.liquid`
(same chrome as earrings / rings). All free-text values in the prose HTML must
still be escaped (`&`, `<`, `>`).

### Spec metafields (PDP grid)

| `custom.*` key | Value |
|---|---|
| `brand` / `model` / `reference` / `year` | Title-cased brand/model; reference as-given; normalized year |
| `case_size` | `{MM}mm` |
| `metal` | As-given (industry shorthand) |
| `dial` / `bezel` / `bracelet` | Title-cased |
| `condition` / `condition_grade` | Title word / grade when mapped; otherwise the nonblank raw condition / omitted |
| `box` / `papers` / `original_tag` | `Yes` / `No` when stated |
| `ebay_condition` | eBay ConditionID `3000` for source state pre-owned or unknown; `1000` only for source-confirmed Unworn with explicit box + papers; otherwise source-confirmed Unworn uses `1500`. Never infer this from title text. |
| `features` | eBay accessory aspects only: `With Box`, `With Papers`, or both. Omit when unstated. |
| `link` | Feed `Links` value as string |
| `stock_number` | LMNY stock # |

Empty values are omitted so the theme can hide those cells.

`boxPaperClause`: built from the `box`/`paper` booleans — when present, one of:
"with its original box and papers" (both true), "with its original box,
but without papers" (box only), "with its papers, but without the
original box" (paper only), "on its own, without box or papers" (neither).
Never "New with box and papers" and never "as a full set with box and papers":
eBay treats that canned Features/Condition value as brand-new unworn stock.
Omitted entirely if both are unstated (so the sentence ends
`…offered by Laura Milman New York.`).
Bracelet links use only integer source values: positive `n` is
`including n additional bracelet link(s)`; negative `-n` is
`with n bracelet link(s) missing`. Zero, blank, fractional, or invalid values
are omitted from the sentence; zero never implies a complete bracelet.
`linkClause` still returns `Not specified` for those values so callers can
tell them apart. The raw nonblank value is still written to `custom.link`.
Grade, when mapped, is `in {grade} condition` inside the same sentence
(`excellent`, `retail ready`). It does not change the eBay condition id.

Price (the sheet's "Amount $" column) is deliberately excluded from this
schema — price lives on the variant, not in description text that would go
stale the moment price moves.

Year normalization: `2014` stays as-is. `FEB-2016` becomes `February 2016`.
`SEPT-2021` becomes `September 2021` (three- or four-letter month tokens).
Sentinels (`0`, `N/A`, `NA`, `-`, `unknown`) are omitted. Other source text,
including approximate dates, is preserved as supplied and is not described as
a manufacture year.

No price anywhere in this HTML. Price lives on the variant and changes
independently; hardcoding it here creates staleness the moment the price
next moves.

### SEO title (`seo.title`, 60-character target; 80 maximum)

Keep the same full reference and whole-word-fitted model used by the product
title. Add condition even when that takes the title above the 60-character
target, up to 80. Add case size, year, and `Watch` only while the result stays
at or below 60. Never cut the reference or promise a ranking outcome.

### SEO description (`seo.description`, ≤ 160 characters)

```
Shop this {pre-owned|unworn} {Brand} {Model} {reference}{, case size, year, grade when present}. Exchanges only within 7 days of delivery.
```
An unclassified watch leads with `Shop this {Brand} {Model} {reference} watch`
and does not invent Pre-Owned or Unworn. Case size, year, and grade are
included when present. The lead is shortened at a word boundary so the
exchanges-only closer still fits inside 160 characters. Do not write “7-day
returns” or `Authenticated by Laura Milman New York.` on a feed watch. Jewelry
and estate listings keep their own closers.

The retired `scripts/lmny_watches_backfill.py` cannot recover API case size or
link facts and must not overwrite this API-built copy. Watch listing content is
already part of `contentHashFor`; changed watch output refreshes through the
normal sync without a global schema-version bump.

The exchanges-only SEO closer matches the theme shipping page: watches may be
exchanged, not refunded, within 7 days of delivery. It is separate from the
optional in-body trust paragraph (`CONFIG.trustLine` / `TRUST_LINE`), which
stays off until confirmed for feed-sourced inventory.

### Tags

Schema marketing tags:
`[Brand, "{titleWord} Watches", reference, Model, "Watches"]`, deduplicated.

**Ingest / sync merge:** the feed sync also keeps operational tags required
for collections and inventory state (`lmny-feed`, box/papers status tags,
`other-watch-brand`, `media-missing`). Schema tags are unioned with those;
they do not replace them.

**Backfill merge:** the one-time backfill unions schema tags with whatever
tags the product already has, so existing operational tags are preserved.

### Metafields

| Namespace.Key | Value |
|---|---|
| `mm-google-shopping.condition` | `new` if state = unworn, `used` if pre-owned; omitted when unclassified |
| `custom.ebay_condition` | `3000` for source state pre-owned or unknown; `1000` only for source-confirmed Unworn with explicit box + papers; otherwise source-confirmed Unworn uses `1500`. Marketplace Connect maps this numeric ConditionID to eBay. |
| `custom.features` | `With Box` / `With Papers` when stated. Never `New with box and papers`. |
| `global.MPN` | reference |

## Idempotency

The normal API ingest computes a content hash from the title, description, SEO,
and other product fields. A change to these watch fields therefore schedules an
eligible watch update without a global schema-version bump. The retired legacy
Python backfill must not overwrite structured-source copy.

## Explicitly out of scope for this pass

- **Trust/authentication line in the body.** The existing "estate" template
  (Bvlgari, Cartier, etc.) says "Authenticated and hand-inspected by Laura
  Milman New York." Whether that claim is true for the feed-sourced watches
  (Rolex, AP, Patek, etc.) hasn't been confirmed. Both implementations have
  a single config flag for this line, defaulted to *off*. Turn it on only
  once it's confirmed true for this inventory. The SEO description uses the
  exchanges-only closer specified above.
- **Theme-level `itemCondition` in JSON-LD.** Shopify's default Product
  structured data does not include `itemCondition`, which is a real,
  separate lever for AI/Shopping visibility beyond title and description.
  Worth a follow-up; not part of this schema.
- **Master-sheet enrichment of the already-live ~620** (Case Size, Metal,
  Dial, etc.). Needs a Stock# join against the tracking sheet.
- **Data quality bugs found in the existing "estate" template** (a few
  Condition fields showing merged/garbled text, e.g. a Chopard listing where
  measurements text leaked into the Condition field). Flagged, not fixed
  here — that template is a different pipeline.
