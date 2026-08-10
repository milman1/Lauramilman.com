# Watch Listing Schema — LMNY

The single source of truth for how a raw feed record becomes a Shopify listing.
Both `src/watchListingBuilder.ts` (ingest pipeline) and
`scripts/lmny_watches_backfill.py` (one-time backfill of already-live watches)
implement this exact spec. If the rules change, both files must change
together, or the two paths will drift and you'll get inconsistent titles
depending on whether a watch came in through the live feed or through a
backfill.

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
| `comment` | Comment | `NAKED` | Optional, free text. Shown as a Notes paragraph UNLESS it's exactly "NAKED" and Box/Paper are both already shown as No — in that case it's redundant with those two rows and is dropped rather than repeating the same fact three ways. |

**Superseded field:** the old single `accessories` free-text field (e.g.
"Full set (box and papers)") is replaced by the explicit `box` / `paper`
booleans above, which is what the source sheet actually tracks. The ~620
already-live watches only have the old combined string in Shopify today, not
these two booleans separately, so the backfill infers `box`/`paper` from the
old string as a bridge.

**Live ingest:** Dial, Bezel, Bracelet, Metal, MM, Links, Comment, and Year
are on the Belgium Dia `developer-api/watch` payload and are mapped through
`normalizeWatches` → `buildWatchListing`. A content-hash schema bump refreshes
already-live `w-*` products in place on the next sync.

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
| `MINT` | Mint |
| `EXCELLENT` | Excellent |
| `VERY GOOD` | Very Good |
| `GOOD` | Good |
| `FAIR` | Fair |

A grade value implies state = preowned (grading only applies to something
that's been owned).

**Anything else** (`SLIDER`, blank, unrecognized text) is **NEEDS_REVIEW**.
Do not generate a title or description. Do not guess a condition. Leave the
existing listing untouched and log the stock ref, current title, and the raw
condition string for manual review. On the live ingest path, fall back to the
legacy brand/model/reference title and bullet-list description rather than
holding the SKU out of catalog.

## Output

### Title
```
{titleWord} {TitleCase(brand)} {TitleCase(model)} {reference}
```
No length cap. A 70+ character title is normal and correct in this category —
the alternative is cutting the reference number, which is the thing people
search for.

Examples:
- `Pre-Owned Rolex Submariner Date 126610LN`
- `Unworn Audemars Piguet Royal Oak Selfwinding 26240BA.OO.1320BA.02`

### Description (HTML)

```html
<p>This {titleWord} {Brand} {Model} {reference}{yearClause} is offered by Laura Milman New York{ boxPaperClause}.{gradeClause}</p>
<p>{comment}</p>                                              <!-- see Comment rule above -->
```

Specs are **not** inlined as an HTML table. They are written to storefront-readable
`custom.*` metafields and rendered by the theme’s jewelry-style
`.product-specs` grid in `sections/main-product.liquid` (same chrome as
earrings / rings). All free-text values in the prose HTML must still be
escaped (`&`, `<`, `>`).

### Spec metafields (PDP grid)

| `custom.*` key | Value |
|---|---|
| `brand` / `model` / `reference` / `year` | Title-cased brand/model; reference as-given; normalized year |
| `case_size` | `{MM}mm` |
| `metal` | As-given (industry shorthand) |
| `dial` / `bezel` / `bracelet` | Title-cased |
| `condition` / `condition_grade` | Title word / grade |
| `box` / `papers` / `original_tag` | `Yes` / `No` when stated |
| `link` | Feed `Links` value as string |
| `stock_number` | LMNY stock # |

Empty values are omitted so the theme can hide those cells.

`yearClause`: ` from {normalizedYear}` or empty.
`boxPaperClause`: built from the `box`/`paper` booleans — when present, a
leading space plus one of:
"as a full set with box and papers" (both true), "with its original box,
but without papers" (box only), "with its papers, but without the
original box" (paper only), "on its own, without box or papers" (neither).
Omitted entirely if both are unstated (so the sentence reads
`…is offered by Laura Milman New York.`).
`gradeClause`: ` It is in {grade} condition.` or empty. Grade is lowercased
in the sentence (`excellent`, not `Excellent`).

Price (the sheet's "Amount $" column) is deliberately excluded from this
schema — price lives on the variant, not in description text that would go
stale the moment price moves.

Year normalization: `2014` stays as-is. `FEB-2016` becomes `February 2016`.
Anything not matching either pattern is passed through unchanged rather than
mangled.

No price anywhere in this HTML. Price lives on the variant and changes
independently; hardcoding it here creates staleness the moment the price
next moves.

### SEO title (`seo.title`, ≤ 60 characters)

Try `{Brand} {Model} {reference} – {titleWord}` first. If that exceeds 60
characters, drop the condition word and truncate at the last full word under
60 characters. Never cut mid-word or mid-reference-number.

### SEO description (`seo.description`, ≤ 160 characters)

```
Shop this {titleWord, lowercase} {Brand} {Model} {reference}{, gradeClause if present}. Authenticated by Laura Milman New York.
```
Truncated at a word boundary to 160 characters if needed.

The SEO authenticated sentence is intentional and always present. It is
separate from the optional in-body trust paragraph (`CONFIG.trustLine` /
`TRUST_LINE`), which stays off until confirmed for feed-sourced inventory.

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
| `mm-google-shopping.condition` | `new` if state = unworn, else `used` |
| `global.MPN` | reference |

## Idempotency

Before writing, check whether the current title already starts with
`Pre-Owned ` or `Unworn `. If so, skip — it's already been processed by this
schema. This lets the backfill script be re-run safely and lets the ingest
pipeline re-process a watch (e.g. after a price resync) without re-writing an
already-correct title. The content-hash schema version is also bumped when
the listing payload shape changes so live feed products refresh once.

## Explicitly out of scope for this pass

- **Trust/authentication line in the body.** The existing "estate" template
  (Bvlgari, Cartier, etc.) says "Authenticated and hand-inspected by Laura
  Milman New York." Whether that claim is true for the feed-sourced watches
  (Rolex, AP, Patek, etc.) hasn't been confirmed. Both implementations have
  a single config flag for this line, defaulted to *off*. Turn it on only
  once it's confirmed true for this inventory. SEO description still uses
  `Authenticated by Laura Milman New York.` as specified above.
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
