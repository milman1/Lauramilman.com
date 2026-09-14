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


## Astra active-listing audit — 2026-09-14

- Requested CSV audit status: **done**. Any duplicate cleanup or product-identity decision remains outside this audit and unapplied.
- Following #92 and #107, refreshed Seller Hub for `lauramilman-newyork`. The screen showed Results 1–133 of 133 at 200 items per page. Native accessibility evidence was used after the page's DOM reader timed out; all 133 parsed item ID/SKU/title triples matched the earlier post-takedown active-table read.
- Fresh result: **133 unique active item IDs; 119 nonblank SKU rows across 93 distinct SKUs; 14 blank-SKU rows; 26 exact-SKU duplicate groups covering 52 listings**. Every duplicate group contains two different item IDs. Blank values, similar titles, model references, and SKU prefixes were not treated as duplicate keys.
- All 26 duplicate SKUs are in the keeper CSV and none are in the end CSV. All remain audit-only and untouched. Exact matching proves duplicate seller labels; it does not by itself prove that two listings represent the same physical item or authorize choosing a listing to retain.
- Deliverable: [26-group CSV](../ebay/evidence/105-20260914/105-active-sku-duplicates.csv), with `sku,item_ids,titles,urls,count`. Multiple item IDs, titles, and URLs use ` | ` in corresponding order. Supporting [133-row active source](../ebay/evidence/105-20260914/105-active-listings-source.csv), [active count screenshot](../ebay/evidence/105-20260914/105-active-listings-evidence.png), and [RR7571 exact-filter screenshot](../ebay/evidence/105-20260914/105-duplicate-RR7571.png).
- Verification: unique item IDs; exact nonblank SKU grouping; 26 × 2 = 52; all groups checked against both immutable scope CSVs; one group independently filtered in Seller Hub, showing its two recorded item IDs. No eBay endings, disables, condition edits, price changes, inventory changes, or template edits performed for this audit. No agents spawned.
- Branch: `codex/105-active-sku-audit-20260914`.
