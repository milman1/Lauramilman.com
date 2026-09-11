# Issue #93 — Royal Chain Shopify draft import

- Issue: https://github.com/milman1/Lauramilman.com/issues/93
- Updated (UTC): 2026-09-11
- Status: Shopify draft creation complete; human media and merchandising review remains before activation
- Builder: [PR #121](https://github.com/milman1/Lauramilman.com/pull/121), merged as `8dd930633c8d4eec49e7b5a2426d39d4b5adb015`

## Live result

Shopify creation completed for the approved Royal Chain shortlist: 21 DRAFT
products and 93 variants. All products have `Published=false`, are available on
zero channels, use vendor `Laura Milman New York`, product type `Necklaces`, and
Shopify category `Apparel & Accessories > Jewelry > Necklaces`. No product has
the `ebay` tag.

Each variant is inventory tracked with quantity 0 and inventory policy `DENY`.
Its weight is 1 lb. The private approved costs were imported without recording
their values in this repository. Each product has one supplier image and the
`media-missing` tag because it has fewer than three images.

## Import correction and verification

The first import used old CSV header names. Shopify therefore left Cost per item
blank and stored zero grams. This was corrected immediately by reimporting with
the supported `Cost per item` and `Variant Grams` headers and matching-handle
overwrite.

A fresh search across all 21 SKUs and a subsequent Shopify export verified 93
rows across 21 handles. SKUs, variant options, prices, populated costs,
inventory settings, draft status, publication state, and tags matched the
approved plan. The export also verified `453.59237` grams, equivalent to 1 lb,
for every variant. Shopify's CDN image URLs and its normalized taxonomy display
are expected platform transformations.

No supplier credentials, private source content, or wholesale values are
recorded in this handoff.

## Remaining review before Active

- Review image quality and add more product images.
- Decide how to merchandise the 7–10 inch lengths.
- Confirm current supplier availability and child-SKU conventions.

Activation and channel publication require a separate reviewed action after
these checks.
