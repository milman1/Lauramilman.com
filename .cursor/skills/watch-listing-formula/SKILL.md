---
name: watch-listing-formula
description: Apply the Laura Milman New York watch listing formula (title, SEO, tags, custom specs, New Vintage vs Pre-Owned/Unworn). Use when creating, rewriting, reviewing, or activating watch or timepiece Shopify listings, including Jacob & Co. boutique pieces, or when the user mentions listing formula, descriptions, tags, or SEO for watches.
---

# Watch listing formula (LMNY)

Canonical spec: `lmny-feeds/docs/watch-listing-schema.md`.
SEO one-pager: `lmny-feeds/docs/seo-title-formulas.md`.
Jacob boutique checklist: `lmny-feeds/docs/jacob-listing-formula.md`.

Builder: `lmny-feeds/src/watchListingBuilder.ts`. Jacob payloads:
`lmny-feeds/src/jacobMemoListings.ts`.

## Title

```
{titleWord} {Brand} {Model} {reference}
```

| Source condition | titleWord | Google Shopping `condition` |
|---|---|---|
| PRE OWNED | Pre-Owned | used |
| UNWORN | Unworn | new |
| Merchant **New Vintage** | New Vintage | omit |
| Unknown / blank | none — do not invent | omit |

Examples: `Pre-Owned Rolex Submariner Date 126610LN`,
`New Vintage Jacob & Co. Five Time Zone JC-4`.

## SEO

- Title ≤60: `{Brand} {Model} {reference} – {titleWord} Watch`
- Description ≤160, always ends with `Authenticated by Laura Milman New York.`
- Truncate identity at a word boundary; never cut mid-word.

## Description

Prose only. Specs are **not** an HTML `WATCH - Model` / `METAL - Type` table.
No price in the body.

```
This {titleWord} {Brand} {Model} {reference} is offered by Laura Milman New York{ box/papers clause}.
```

## Specs (`custom.*`)

`brand`, `model`, `reference`, `year`, `case_size`, `metal`, `dial`, `bezel`,
`bracelet`, `condition`, `condition_grade`, `box`, `papers`, `original_tag`,
`link`, `stock_number`, `diamond_weight`. Omit empty keys.

## Tags

`{Brand}`, `{titleWord}`, `{titleWord} Watches`, `{model}`, `{reference}`,
`Watch`, `Watches`.

Feed watches also keep `lmny-feed`. Boutique Jacob watches use
`jacob-co-boutique` and **must not** use `lmny-feed`. Drop `Luxury Jewelry`.

## Jacob & Co. boutique

- Vendor field: `Jacob & Co` (no period) so `/collections/jacob-co` still matches.
- Titles/SEO brand: `Jacob & Co.`
- Photographed live PDPs: rewrite **in place** (keep handle, photos, merchant price).
- New memo SKUs: handle `jc-<itemNumber>`. Do not duplicate a live watch as `jc-*`.
- Do not invent Pre-Owned/Unworn. Condition is New Vintage.
- Do not change archive/draft unless the user asked to activate.
