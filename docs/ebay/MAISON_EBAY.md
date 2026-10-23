# Maison jewelry → eBay (tag + metafields)

Snapshot date: 2026-09-14. Live Shopify read, then a 33-SKU duplicate cleanup.

## Unique pieces — already tagged

Every ACTIVE maison-vendor jewelry product already carries `ebay` and
`custom.ebay_condition` = `3000`. Vendor scan of the Pre-Owned Maison list
found **0** unique ACTIVE jewelry products missing the tag.

| Set | Count |
|---|---|
| `antique-estate` / `designer-jewelry` | 757 |
| Already `ebay` + numeric condition | 661 |
| Watches in that tag set (out of scope) | 35 |
| Archived / sold, no tag needed | 24 |
| Same SKU on two ACTIVE products | 33 pairs |

Do not tag drafts, loose stones, or archived sold pieces.

## Duplicates — CSV import vs Back Vault copy

33 SKUs exist twice, both ACTIVE, both `ebay`-tagged:

- **Keep:** `bv-…` Back Vault copy (feed-managed, weekly sync).
- **Untag:** older CSV-import handle (no `bv-` prefix). Same SKU, not
  `backvault-feed`.

Listing both on eBay would duplicate the same stock number. This job only
removes the `ebay` tag from the CSV copy. It does not archive or delete
either product.

Removing the tag does **not** end an existing Marketplace Connect / eBay
row by itself. If a CSV copy is still Enabled in Connect, Disable + Save
that SKU there (same path as the watch takedown). The `bv-` copy stays
tagged.

Plan: `docs/ebay/maison-duplicate-untag-plan.csv`  
Twins: `docs/ebay/maison-csv-twins.csv`  
Results (2026-09-14, independent re-read): `docs/ebay/maison-duplicate-untag-results.csv` — **33 OK / 0 error**. CSV copy `ebay` tag off; `bv-` copy still on.

David Webb pairs that share a title but have **different** SKUs (RR9482 /
RR7757, RR9123 / RR8156, RR7429 / RR6484, RR6486 / RR6485) are separate
pieces. They stay tagged.

## Hourly feed / bracelet-link copy

Bracelet-link prose is already on `main` (`linkClause()` in
`lmny-feeds/src/watchListingBuilder.ts`, `PRODUCT_SCHEMA_VERSION` 24).
Scheduled Belgium Dia sync is **LIVE** (`LMNY_SYNC_LIVE=true`), cron
`17 * * * *` in `.github/workflows/lmny-feed-sync.yml`.

To run it yourself:

1. GitHub → Actions → **LMNY feed sync** → Run workflow.
2. Branch: `main`.
3. Uncheck **Dry run** for a live write (default is dry-run).
4. Open the run summary / `lmny-sync-report-*` artifact.

A scheduled LIVE run on 2026-09-14 (06:24 UTC) already reported
`skip (unchanged): 26436` with feeds `natural, lab, watch` enabled, so
schema 24 is in the catalogue. A manual live run only rewrites watches
whose content hash still differs (new `Links` values, or a later schema
bump).

This environment cannot dispatch workflows; use the Actions tab.
