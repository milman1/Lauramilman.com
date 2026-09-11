# Issue #102 — TLV + Vivid watch withdrawal and permanent sync exclusion

Status: in progress. GitHub issue: https://github.com/milman1/Lauramilman.com/issues/102

Documentation PRs: https://github.com/milman1/Lauramilman.com/pull/104 and https://github.com/milman1/Lauramilman.com/pull/106. Exact next action: observe the next scheduled main sync and verify no excluded supplier watch is recreated or reactivated. The earlier Rolex identity question is resolved by the corrected SKU 4159 evidence.

Execution update dated 2026-09-11: PR #103 is merged and CI-verified. The combined 104-row Shopify archive has fresh evidence showing 104 unique products, all Archived. Marketplace Connect has fresh after-state evidence for all 104 exact SKUs, all Disabled; the write log records 66 saved changes (58 current plus 8 historical), with 38 rows already Disabled before the writes. Seller Hub's captured Active view contains 182 unique listing IDs, 168 nonblank custom-label/SKU pairs across 142 distinct SKUs, and 14 unlabeled rows; zero target SKU matches and zero raw target-SKU occurrences were found. Fresh accessibility evidence parses item 366655791728 as SKU 4159, outside the TLV/Vivid scope; this corrects the prior parser output without asserting a live state change. Seventeen restricted screenshots are uploaded and verified in the canonical Drive folder. A post-next-scheduled-sync observation has not been recorded.

## Goal

Withdraw the final exact 104-SKU TLV/Vivid watch scope authorized by the merchant: 102 TLV/T cohort records plus current Vivid `6197` and `6198`. Archive all 104 Shopify products, disable the same exact SKUs in Marketplace Connect, and permanently exclude both supplier branches from the watch sync. The 39 historical TLV rows were separately reviewed, frozen, and included before the live writes. Older #92 remains a separate task.

## Evidence and files

- Sanitized source snapshot: docs/ebay/tlv-vivid-watch-source.json (65 rows: 63 TLV, 2 Vivid).
- Frozen exact-SKU plan: docs/ebay/tlv-vivid-watch-plan.csv (65 rows).
- Shopify preflight: initial 65-row query plus combined 104-row before/after evidence. Fresh after-state covers 104 unique products across pages 50 + 50 + 4, all Archived; no SKU-to-ID mapping is inferred from row order.
- Marketplace Connect evidence: docs/ebay/tlv-vivid-marketplace-before-current65.json (65 rows: 58 Enabled, 7 Disabled), docs/ebay/tlv-vivid-marketplace-before-historical39.json (39 rows: 8 Enabled, 31 Disabled), docs/ebay/tlv-vivid-marketplace-write-log.json (66 saved changes), and docs/ebay/tlv-vivid-marketplace-after-104.json (104 unique rows, all Disabled).
- Shopify after-state: docs/ebay/tlv-vivid-shopify-after-104.csv (104 unique observed product IDs, all Archived; no SKU-to-ID inference).
- Drive evidence: canonical folder https://drive.google.com/drive/folders/1XnQxUkd8jHCzF4CaAjOS-VlnNB_8gB9n with 17 verified restricted screenshots (16 batch/state captures plus the final eBay evidence screenshot).
- Code/CI evidence: PR #103 commit 4f1d212348d78c51a133716d60f8da53ff13bb46; Actions run https://github.com/milman1/Lauramilman.com/actions/runs/34606495411.
- Seller Hub evidence: 182 unique active listing IDs inspected; 168 had nonblank custom labels across 142 distinct SKUs and 14 had no parseable label, recorded in docs/ebay/tlv-vivid-ebay-active-after.csv. Zero of the 104 target SKUs matched the extracted pairs or appeared elsewhere in the captured DOM. Item 366655791728 is parsed as SKU 4159 and is outside the TLV/Vivid scope; no eBay completion is inferred from Shopify or Marketplace state.
- Repository audit and historical evidence: docs/ebay/tlv-vivid-historical-evidence.md.

## Completed execution and remaining acceptance

1. The permanent exclusion was implemented and independently reviewed before writes: TLV WATCHES LLC and VIVID WATCHES LLC were removed from the allowed branches, ROMAN retained, and allowlist lookup failure made fail-closed. Tests and CI dry-run passed before catalog writes.
2. The final 104 exact-SKU plan was used for Shopify and Marketplace Connect. Shopify after-state is 104/104 Archived; Marketplace Connect after-state is 104/104 Disabled.
3. The exact-SKU Seller Hub Active-view check is recorded with zero parsed target matches. Keep issue #102 open only for the post-next-scheduled-sync observation; do not claim that observation has occurred.

## Guardrails

- No prefix bulk selection; exact supplier evidence and exact SKU matching only.
- Do not infer SKU-to-product-ID mappings from source or rendered row order.
- Do not delete products/listings.
- Do not include costs, credentials, or customer data.
- Shopify archive is independently verified for all 104 rows. Marketplace Connect is independently verified for all 104 rows as Disabled. Seller Hub has zero parsed target matches; the post-next-scheduled-sync observation remains pending.
- Acceptance requires the sync block to be merged and tested before archive/disable, and no supplier row may be reactivated by the next sync.
