# Issue #105 — exact-SKU duplicate active-listing audit

Status: audit only; no listing cleanup mutation authorized or performed. GitHub issue: https://github.com/milman1/Lauramilman.com/issues/105

## Scope

Fresh Seller Hub accessibility evidence reports 1–182 of 182 active listings. The sanitized extraction contains 182 unique item IDs, 168 nonblank Custom-label SKU values across 142 distinct SKUs, and 14 blank-SKU rows. Exact duplicate analysis found 26 groups covering 52 listings. Candidate rows are in docs/ebay/tlv-vivid-ebay-duplicate-candidates.csv.

This is a review/audit task. Similar titles, references, or brands with different SKUs are excluded. No end, delete, disable, or other listing mutation is authorized by this audit.

## Candidate evidence

Every candidate group has two distinct active eBay item IDs with the same nonblank SKU. The candidate CSV contains only the four public fields sku, item_id, title, and duplicate_evidence; it contains no price, credentials, customer data, or raw Seller Hub DOM.

The corrected fresh parse includes item 366650158493 with SKU 8821. It is a policy-violation/non-editable listing and remains audit evidence only. The prior parser's blank value for item 366655791728 was corrected by fresh accessibility evidence showing SKU 4159; this is a parsing correction, not evidence that the live listing changed.

## Required review

1. Check each of the 26 exact duplicate groups against Shopify product identity and Marketplace Connect keeper/listing state.
2. Produce an independent decision for every group before any action.
3. Keep this issue audit-only until a separate explicit instruction authorizes listing changes.
4. Do not use same-title matching, prefix matching, or inferred identity as a cleanup basis.

No live changes were made for this audit.
