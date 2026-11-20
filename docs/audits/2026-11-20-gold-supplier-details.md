# Gold jewelry supplier-backed SEO/AEO updates

Six live Shopify content updates completed and independently verified on November 20, 2026. The merchant explicitly requested preserving “Designed in New York” and “Crafted in Italy”; both remain unchanged, confirmed in the three updated public product pages. This work does not independently authenticate those statements.

## Supplier information inspected

Reviewed the 21-model saved shortlist at `docs/suppliers/royal-chain-shortlist-2026-09.csv`, its companion pricing/length file, the listing schema and matching live SKU records. No customer-facing supplier attribution was added. No new wholesale price or inventory assertion was derived from these historical files.

The shortlist explicitly identifies NHMC120, NHMC150 and HMC150 as **semi-solid** and PROY018 and SRBX130 as **solid**. Exact SKU matching confirmed three necklace descriptions missing the first fact; the two matching Cuban bracelets and the two solid-chain descriptions already state their construction correctly. “Lite” model names were not interpreted as proof of hollow or semi-solid construction. The saved files contain no gram-weight field, so no weights were inferred from prices, dimensions or shipping weight.

## Changes and independent verification

| Live page | Change | Verified |
|---|---|---|
| `/products/lmny-cuban-4-5-mm-nhmc120` | Added “It has semi-solid construction.” from exact supplier model NHMC120 | Admin body, public HTML and Product JSON-LD description |
| `/products/lmny-cuban-5-mm-nhmc150` | Added the same supplier-backed fact for NHMC150 | Admin body, public HTML and Product JSON-LD description |
| `/products/lmny-cuban-5-5-mm-hmc150` | Added the same supplier-backed fact for HMC150 | Admin body, public HTML and Product JSON-LD description |
| `/collections/chains` | Title “Gold Chains & Bracelets”; distinct SEO title and links to necklaces and chain bracelets | Admin and public title; canonical remains the existing URL |
| `/collections/gold-chains` | Title “Gold Necklaces”; copy now covers the existing chain, initial and tubogas selection; links to bracelets and the broader chain collection | Admin title, body and SEO; public title and unchanged canonical |
| `/blogs/journal/gold-chain-guide-styles-widths` | Separated gold content from solid/hollow construction; removed claim that finished hollow chains are filled with base metal or wax; qualified repair/durability advice and removed gym-use recommendation | Exact Admin body readback and public corrected explanation |

The two collection SEO titles are under 60 characters and descriptions under 160. Product descriptions remain short factual paragraphs. No reviews, ratings, certificates, weights, product-specific origin or additional manufacturing facts were invented. No products, collections or URLs were created or deleted; collection membership was not edited.

## Verification boundaries

A fresh pre-write Admin query matched the saved snapshot. Mutation inputs were limited to three product descriptions, two collection titles/descriptions/SEO fields, and one article body. No theme write occurred.

Independent post-write Admin reads confirmed every intended content change and preserved all queried product IDs, handles, statuses, variant IDs, SKUs and prices. Six public HTTP checks passed; all pages retain their canonical URLs. For the three products, the added construction fact appears in Product JSON-LD, and both merchant-protected brand statements remain in the HTML. Evidence: `gold-seo-2026-11-20/public-verification.json`.

This was a content-only change. No new regression test suite or recurring workflow was created; no claim is made about rankings, Google indexing, Merchant Center approvals or Shopify Catalog ingestion.

## Remaining evidence needed

- Exact jewelry gram weights by SKU/length, from supplier specifications or weighing the piece. Neither saved source CSV supplies this.
- Explicit construction facts for the remaining models. Missing facts stay unstated; “Lite” is not treated as a construction classification.
- Current Search Console performance/indexing and Google/Shopify Catalog eligibility diagnostics remain separate account checks. No unverified discovery or sales improvement is claimed.
