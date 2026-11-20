# Gold jewelry SEO and catalog completion — November 20, 2026

## Confirmed repairs

The earlier six live content changes are documented in PR 445: supplier-backed semi-solid construction on three Cuban necklaces, corrected hollow-chain guidance, and distinct copy and internal links for two gold collections.

This follow-up found and repaired two missing Shopify taxonomy categories:

| Product | Before | After |
|---|---|---|
| Mini Initial Necklace in 14K Yellow Gold, 9084075769927 | No category | Apparel & Accessories > Jewelry > Necklaces |
| Rectangular Signet Ring in 14K Yellow Gold, 9084074721351 | No category | Apparel & Accessories > Jewelry > Rings |

Both category-only writes returned no user errors. Independent Admin reads confirmed the category changes and identical handles, titles, active statuses, variant IDs, SKUs and prices across their 27 variants. No channel or theme changes were made.

## Verified

- Examined all 42 products in the gold-jewelry collection, with pagination exhausted. Before repair, exactly two lacked a category; both are now assigned. All 32 chain products already had categories and variant SKUs.
- Checked public HTML on all 32 chain products and compared Offer data with Shopify public product JSON across 93 variants. No detected missing Product name, SKU, image or URL; no missing Offer price, currency, availability or URL; no detected USD, price or availability mismatch. Canonicals matched product URLs and no checked product carried a noindex meta tag.
- Four gold collection URLs returned HTTP 200, self-referencing canonicals and no noindex meta tag. The chain-necklaces collection has 19 chain necklaces; gold-chains has 21 necklaces including initial and tubogas styles. Their different scope does not justify removing either URL.
- robots.txt permits the checked public collections and products for Googlebot and OAI-SearchBot. Requests bearing each user-agent to gold-chains returned 200 and product links. These probes do not establish access from the real crawlers' networks.
- Existing guide links to chains, chain bracelets and chain necklaces are live. No additional speculative content or supplier facts were added.

## Failed or blocked checks

- No public product consistency checks failed. This was a bounded one-time validation, not a new automated regression suite or an official Google Rich Results Test.
- The first local read attempt failed because Python requests was absent; standard-library HTTP reads succeeded afterward.
- The initial Admin query used the deprecated barcode field and was rejected before execution. The corrected category/SKU query succeeded. Barcode validity was not verified.
- Royal Chain's NHMC120 page returned HTTP 403. The available supplier CSVs have no gram-weight field. No weights were guessed, and shipping weight was not substituted for metal weight.
- Merchant Center is not connected in Windsor. Product approval/disapproval counts, reasons, processed feed values, identifier exemptions, target-country shipping/tax/returns and last successful ingestion remain unverified.
- No connected browser/document session or browser-control tool was available. Shopify Catalog's ChatGPT eligibility, synchronization timestamp, exclusions and rejected-item diagnostics remain unverified. Admin publication records alone do not prove ChatGPT ingestion.
- No checkout order was placed and no purchase flow was modified.

## Exact supplier information still required

Provide metal gram weight per actual SKU, length and color for the 21 source models: NMC120, NHMC120, NHMC150, HMC150, MC180, PCLIP060, PCLIP095, CH014, PROY018, HSR018, SLK023, CC080, CC100, LCRB100, SF030, SF040, SF050, BOX073, SRBX130, OVSN200 and OVSN260. Include whether weights are approximate and their tolerance.

Construction is explicitly supported in the saved model names only for NHMC120, NHMC150 and HMC150 (semi-solid), PROY018 and SRBX130 (solid). Obtain exact construction for the other models before adding claims. Do not infer construction from “Lite,” width or price. Obtain manufacturer-assigned GTINs if any; never fabricate them.

## Preserved

“Designed in New York” and “Crafted in Italy” remain unchanged. Pricing, supplier rules, product handles, imagery, design, checkout and publication settings were not changed by this follow-up.

## Remaining access

Connect the store's Merchant Center account, provide a connected signed-in Shopify Catalog browser session, and supply the missing variant-specific supplier specifications. Those are the remaining blockers; this report does not claim they are complete.

Search Console account findings are retained in the private session report rather than the public repository.
Tracking: https://github.com/milman1/Lauramilman.com/issues/446
