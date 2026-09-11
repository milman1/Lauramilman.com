# Historical TLV + combined supplier withdrawal evidence

Status: execution evidence recorded 2026-09-11. The permanent sync exclusion merged in PR #103 before catalog writes. Shopify and Marketplace Connect verification completed for all 104 exact-SKU rows. Seller Hub captured zero parsed target matches, with one unlabeled Rolex 124300 that could duplicate T3759. Issue #102 remains open for the next scheduled sync observation and this caveat.

## Frozen batches

- Initial frozen batch: 65 exact source rows (63 current TLV and 2 current Vivid), retained separately in docs/ebay/tlv-vivid-watch-plan.csv.
- Second frozen batch: 39 additional exact historical TLV candidates in docs/ebay/tlv-historical-watch-plan.csv.
- Combined validation plan: 104 exact SKUs in docs/ebay/tlv-vivid-watch-combined104-plan.csv.
- The 39 historical rows are 33 former #92 end-list rows and 6 former keeper rows. The six keeper overrides are T3606, T3700, T3715, T3716, T3729, and T3738.
- Combined historical keeper accounting is 62 TLV T keepers plus current Vivid 6197 and 6198, for 64 historical keeper records represented in the 104-SKU union. The later supplier-wide authorization supersedes keeper protection for this exact operation.
- The older 33 archived T records with unconfirmed supplier provenance remain documented as historical T/TLV candidates under the merchant's explicit T/TLV identification; this does not claim independent per-SKU Branch evidence or that all historical supplier records have been recovered.

## Evidence basis

The repository audit documents the T-to-TLV mapping in the watch gate fallback and the absence of evidence that any T-prefix watch belongs to another supplier. The current branch-qualified snapshot independently confirms all 63 current T rows as TLV; the two current Vivid rows are 6197 and 6198. The union was executed by exact SKU and never as a UI prefix selection.

The historical addition is the exact 39-SKU list stated by the corrected audit. It is separate from the initial 65-row plan so the current branch evidence and historical T/TLV identification remain auditable.

## Shopify preflight

The supplied all-T Shopify UI query returned 102 products over three pages (50 + 50 + 2; next disabled), and the supplied Vivid preflight completed the 104-row union. Fresh after-state contains 104 unique product IDs, all Archived; the sanitized after snapshot is docs/ebay/tlv-vivid-shopify-after-104.csv. Product IDs remain evidence only; no SKU-to-ID mapping was inferred from row order or title.

## Completed execution

1. The initial 65-row batch and separate 39-row historical batch were frozen as the combined 104-row plan.
2. The permanent ROMAN-only sync exclusion and fail-closed allowlist behavior were merged and independently verified before live writes.
3. Shopify archive verification is 104/104 Archived. Marketplace Connect after-state verification is 104/104 Disabled; the write log contains 66 saved changes and 38 rows were already Disabled.
4. Seller Hub verification found 182 unique active listing IDs with 167 nonblank custom-label/SKU pairs and 15 unlabeled rows; zero target SKU matches and zero raw target-SKU occurrences were found. The unlabeled Rolex 124300 could duplicate T3759, so the capture does not prove absence for that one item. Sanitized extracted pairs are in docs/ebay/tlv-vivid-ebay-active-after.csv.

Drive evidence: 17 restricted screenshots are uploaded and verified in the canonical merchant folder: https://drive.google.com/drive/folders/1XnQxUkd8jHCzF4CaAjOS-VlnNB_8gB9n.

No cost, credential, or customer data belongs in these artifacts. Older #92 remains a separate task.
