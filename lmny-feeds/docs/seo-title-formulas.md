# Product SEO title formulas

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

## Skylab bridal (complete rings and settings)

House-brand listings. Retail is `skylabRetailFromCost` (cost × 3, nearest
dollar) in `config/pricing.ts`. The supplier name never appears on the store.

- Product title: `{prefix}{distinctive design/model} {primary gemstone} {product type} in {metal}`
- SEO title: `{design/model} {gemstone} {product type} | Laura Milman`

`prefix` is `Lab Grown ` only when that SKU’s supplier listing states
lab-grown. Most complete rings are lab and labeled on their site; a natural
listing stays natural. Do not apply the Peaceful Diamonds ×4 rule.

