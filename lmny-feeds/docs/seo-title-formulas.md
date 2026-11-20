# Product SEO title formulas

> For finished house/lab-grown jewelry and settings, the mandatory standard is
> `docs/seo/finished-jewelry-activation-checklist.md` and its executable
> `docs/seo/jewelry-activation-gate.md` workflow. Every applicable check must
> pass; an 8/10 score cannot authorize activation.

This file is only the character budgets and per-source title strings.

- Listing voice, GEO rules, and video-first gallery order: [`docs/seo/listing-seo-geo.md`](../../docs/seo/listing-seo-geo.md)
- Feed / eBay / Connect copy rules: [`docs/seo-geo-copy.md`](../../docs/seo-geo-copy.md)

Shopify's theme adds the store name to the HTML `<title>`. The sync therefore
uses the 60-character `seo.title` budget for product identity and search intent,
without repeating “Laura Milman New York.”

## API-managed loose diamonds

- Product title: `{carat}ct {shape} {Natural|Lab-Grown} Diamond — {color} {clarity}, {lab} Certified`
- SEO title: `{carat}ct {shape} {Natural|Lab-Grown} Diamond — {color} {clarity} | {lab}`

Example: `2.01ct Round Natural Diamond — F VS1 | GIA`

The same formula covers white (D-Z) and colored loose stones. For a colored
stone, `{color}` is the intensity and hue from the grading report, and the
lab is IGI:

- Product title: `2.00ct Oval Lab-Grown Diamond — Fancy Intense Pink VS1, IGI Certified`
- SEO title: `2.00ct Oval Lab-Grown Diamond — Fancy Intense Pink VS1 | IGI`

When a colored SEO title runs past 60 characters, clarity is dropped first,
then the intensity, so the hue and the `| IGI` suffix always remain
(`12.34ct Cushion Brilliant Lab-Grown Diamond — Yellow | IGI`). White stones
come from `src/product.ts`; colored stones from `listingCopy` in
`src/lgd-color/catalog.mjs`.

The formula front-loads the attributes shoppers use in search and explicitly
states diamond origin and certification. Long shapes are shortened only at a
word boundary; the grading lab suffix is always retained.

## API-managed watches

- Product title: `{Pre-Owned|Unworn} {brand} {model} {reference}`
- SEO title: `{brand} {model} {reference} – {Pre-Owned|Unworn} Watch`

If condition is not recognized, the sync does not invent one:
`{brand} {model} {reference} Watch`.

## API-managed estate jewelry

- Product title: `{brand} {normalized identifying details}`
- SEO title: `{brand} {model/material/gemstone details} | Estate Jewelry`
- Estate watch SEO title:
  `{brand} {model/reference details} | Pre-Owned Watch`

The intent suffix is reserved before truncating descriptive detail, so every
title retains its product category.

## Manually managed LMNY jewelry

Use this formula in Shopify Admin:

- Product title: `{distinctive design/model} {primary gemstone} {product type} in {metal}`
- SEO title: `{design/model} {gemstone} {product type} | Laura Milman`

Avoid generic openings such as “Beautiful,” stock numbers, promotional claims,
price, and repeated category words. Keep the Shopify SEO title at or below 60
characters and the description at or below 160 characters.
