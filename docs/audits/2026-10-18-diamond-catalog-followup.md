# Diamond catalog follow-up — 2026-10-18 UTC

Follow-up to issue #280 and the October 15 SEO audit. Read-only live checks were taken around 16:09–16:12 UTC, before the repair in this change. No product price, pricing rule, handle, imagery, checkout or channel inclusion policy was changed.

## Catalog-wide results

- Shopify Admin reports exactly **23,890 ACTIVE loose diamonds**.
- Scanned the first 25,000 distinct public Shopify product records: **23,890 diamonds** (20,325 lab-grown, 3,565 natural), matching the Admin active count. Shopify's page endpoint rejects page 101 with HTTP 400; this is not a complete audit of the non-diamond catalog. This is a count reconciliation, not a full Admin ID-by-ID export.
- All scanned diamonds have an image reference, SKU, nonempty description, positive price, an available variant and an IGI/GIA tag. No duplicate diamond SKUs or “UNCERTIFIED Certified” titles. Image URL presence does not independently prove every image loads; tags do not independently authenticate certificates.
- Read all **22,894 distinct publicly available search-inventory records**, paginating the same Supabase table used by the storefront API with its public read credential and selecting only public specification/price columns.
- **22,891 overlapping products: zero price or availability mismatches.** No unsupported lab labels in those matched search records.
- **Three search records point to DRAFT Shopify products:** `lg-100754426104`, `nd-223046`, `nd-xx900598093`. Their variant availability alone is true; the product status makes them unavailable on the public store. No drafts were activated.
- **999 public Shopify diamonds are absent from the available search table:** 578 have `colored-stone-feed`; 421 have `lmny-feed`. All are lab-grown. Colored inventory has a separate sync, so absence is not proof of a sold stone. The 421 include nonstandard shapes and need database/supplier reconciliation before any availability change.

## Confirmed regression repair

The supplier sync previously upserted every supplier-approved stone with `available: true`, even when Shopify had quarantined its product as DRAFT. The repair carries the observed Shopify status through media quarantine/rescue and successful product write/publication results. Search rows for drafts, archived products, unknown products and failed/unpublished new writes are written unavailable. Active successful records retain their supplier price and identifiers. No Shopify product is activated by this repair.

The repair uses the existing sync; it adds no workflow or recurring infrastructure. It takes effect on a successful live sync after merge. Until the three records are independently reread as absent from public search, deployment is **not live-verified**. Existing active-product publication and supplier freshness still require their respective checks; an ACTIVE status alone is not a complete Catalog eligibility determination.

## Earlier outstanding items rechecked

- The 2 carat oval landing now appears in Shopify's generated collection sitemap (`sitemap_collections_1.xml?from=157096149063&to=350222647367`). Sitemap propagation is confirmed; Google indexing is not.
- All **10 live SEO regression checks pass**, including filter fallback, landing first-page specifications, three Product/Offer schemas, current price/availability parity and simulated Googlebot/OAI-SearchBot requests. User-agent probes do not prove real crawler IP access.
- Of the eight previously flagged legacy products, six are now ARCHIVED. `lg-907767` is ACTIVE with IGI and report `LG783666553`; `nd-ws351446a` is ACTIVE with GIA and report `6521706120`. These are current Shopify records, not independently authenticated lab reports. No active loose diamond was returned by the catalog-wide query excluding both IGI and GIA tags.
- The three original sample products still have no Google & YouTube publication. The repo's loose-diamond exclusion remains in force. PR #291 already proposes a 240-stone Google shortlist but explicitly leaves it unpublished; this follow-up does not approve or publish it.
- Other work since October 15 has changed the approved lab pricing and added more landing pages. This follow-up used current prices and latest main, and did not revert those changes.

## Private-account checks still unavailable

The connected Shopify Admin API exposes product/channel/market records; those are not the Shopify Catalog ChatGPT eligibility dashboard. This session has no authenticated browser control and no connected Merchant Center or Search Console account.

1. **Shopify Admin → Agentic → Sources → Shopify Catalog:** verify access/eligibility, eligible product count, exclusion reasons and ChatGPT access. Inspect actual Catalog mapping for shape, numeric carat, origin, color, clarity, grading report and category. The sampled Shopify category is the broad `Apparel & Accessories > Jewelry`; no more specific taxonomy was guessed.
2. **Google & YouTube / Merchant Center:** linked account, sync/data-source processing time, item approvals, identifier policy, country/language, shipping/returns and price/availability diagnostics. Product publication is not Merchant Center approval.
3. **Search Console / Rich Results Test:** actual URL Inspection, selected canonicals, indexing and Merchant Listing diagnostics. The programmatic checks are not Google's validation output.
4. **Supabase/supplier reconciliation:** explain the 421 regular-feed gaps, confirm the intended treatment of 578 colored-feed products, and verify removal of draft results after the corrected sync. No service-role database credential is attached to this execution environment.

The latest inspected feed run (39142780929) succeeded and logged Supabase upserts; its watch source returned zero rows and was protected from archival. Its artifact download failed with HTTP 403. Neither run success nor the upsert count proves public search/catalog completeness.

## Validation

- Vitest: **856 tests pass across 75 files**, including the new status/price regression.
- Live public audit: **10/10 pass** (evidence in `diamond-catalog-2026-10-18/live.json`).
- `git diff --check`: pass.
- Typecheck: **fails in unchanged files** `src/shopify.ts`, `src/uploadifyMetafields.ts`, `test/pricing-ssot.test.ts`, `test/theme-chat-opener.test.ts`, and `test/theme-storefront-fixes.test.ts`; no diagnostics name the files changed by this repair.
- Full comparison evidence lists the coverage gaps in `diamond-catalog-2026-10-18/comparison.json`; basic public catalog checks are in `public-scan.json`.
