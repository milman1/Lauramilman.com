# Issue #107 — watch eBay condition integrity audit

- Issue: https://github.com/milman1/Lauramilman.com/issues/107
- Updated (UTC): 2026-09-11
- Owner / session: Astra / condition-integrity audit
- Status: **open; blocked on live packed-weight input and source API availability**
- Branch: `codex/107-watch-condition-handoff`
- Scope: watch condition evidence and the existing Marketplace Connect condition mapping only

## Goal and acceptance criteria

Audit existing watch condition mappings against structured source data and prepare bounded corrections. The merchant authorized condition correction only. Prices, orders, buyers, inventory, and unrelated listing scope remain outside this task. Close only after a dry-run report and an independent read-back verify every authorized mapping update.

The strict gate is:

- `1000` only when structured API data explicitly says `UNWORN` and both box and papers are true.
- `1500` for `UNWORN` when the complete box-and-papers requirement is not met.
- `3000` for used, pre-owned, or unknown condition.
- Titles, descriptions, and marketplace wording cannot upgrade a product. Missing or unavailable source data fails closed.

## Verified evidence and completed work

- PR #108 merged at `386da74ecdcb3506f13748a9770993887d747975`.
- PR #109 merged at `1404c6e7f1af953beeea60bb08ec7a8518caf85e`; automatic condition apply is disabled and now requires an exact manual opt-in.
- The PR #108 condition workflow completed successfully in run [34627345486](https://github.com/milman1/Lauramilman.com/actions/runs/34627345486). The implementation and focused validation reported 630 tests passed; schema version 24 is the current schema reference, not a test count. The independent review reported 97 focused tests at `34a7b14`.
- The automatic PR workflow applied 85 product updates and 151 metafield upserts. Independent review found metadata-only changes: no feature deletes or body rewrites. The reviewed population was 71 archived, 10 active, and 4 draft; 66 eBay condition values were `3000` and 85 Google values were `used`. This is a historical execution record, not proof that every watch mismatch is fixed.
- The write-disabled main dry-run [34627710402](https://github.com/milman1/Lauramilman.com/actions/runs/34627710402) failed closed after about 7m28s: the direct Belgium Dia API URL was unset or rate-limited, it returned zero natural/lab/watch API rows, and it performed zero writes. This run cannot serve as a fresh source-backed repair plan.
- The sold trigger is eBay item `366649317404` (Rolex 116000): public condition says “New with box and papers” while the description says “Pre-Owned.” This is a verified mismatch and does not authorize inference from marketplace copy.
- Fresh active evidence identifies item `366650116144`, SKU `RW3096`, “Pre-Owned Rolex Datejust 126334.” Its actual evidence says New with box and papers while Marketplace Connect is Listed and Enabled. It was outside the 85-row repair population, so its underlying delivery remains unresolved.
- Public listing item `366655791728`, SKU `4159`, currently shows Pre-owned / Good, with a pre-owned description and no original box. This is current public-listing evidence, not a conclusion drawn from the sold listing.
- The latest RW3096 Marketplace state is Listed and Enabled with an Offer error: “Package weight not valid or missing.” Shopify currently records package weight `0.0 lb`; the shipping policy is Free-2Day Insured Shipping. Condition correction is authorized, but the merchant’s actual packed weight and unit are still pending, so no package weight can be entered yet.

## Source and candidate audit state

The active-listing source extraction and watch-title classification remain a bounded audit aid only. The working candidate CSV is not committed to this repository and is pending blind review. It contains only `item_id`, `sku`, and `title`; it carries no condition decision. Ambiguous and obvious non-watch rows remain separate. Do not treat the working candidate list as the complete API-backed repair population, and do not infer a condition from a title, description, or SKU.

The bounded repair writer is built as **LMNY source-backed watch condition repair** in `.github/workflows/lmny-source-watch-condition-repair.yml`, with its implementation in `lmny-feeds/scripts/repair-source-watch-conditions.ts`. It joins only active Watch products to allowed ROMAN API rows by exact SKU or deterministic/legacy watch handle, stops on zero source data or duplicate/ambiguous identity, and writes only `custom.ebay_condition` and `mm-google-shopping.condition`. A dry run emits a schema-validated plan, timestamp, and SHA-256. Apply requires the reviewed dry-run workflow run ID plus that exact hash, downloads the original artifact without rebuilding source state, rejects plans over 24 hours old, and aborts before all writes if a fresh read shows status, SKU, handle, or condition drift. No source-backed plan or live apply has run because the API remains unavailable; this work does not verify or reverse all 85 historical updates.

The optional candidate audit remains incomplete: independent review found 150 saved rows, 13 blank SKUs, and the omission of MICHELE watch item 366650784419. The input title/SKU associations passed review, but this incomplete classification is not a repair cohort and must not determine condition changes; use exact authoritative API joins instead.

## Deployment and live state

PR #109 is merged and the automatic apply path is disabled. The 85-row historical workflow execution is recorded above. The latest source-validation dry-run performed zero writes and failed closed. There is no verified completion of the full active-watch audit or of all Marketplace delivery mismatches.

PR #109 workflow run [34628174469](https://github.com/milman1/Lauramilman.com/actions/runs/34628174469) also succeeded in dry-run mode with `DRY_RUN_INPUT=true`: it read 2,069 catalog products, planned zero changes, and made zero writes. That confirms the repaired trigger is write-disabled; it does not establish current API truth or verify the 85 historical updates.

## Remaining work and blockers

1. Obtain the merchant’s actual packed weight and unit for RW3096 before considering the Marketplace package error.
2. Restore or provide an approved structured source API response, then generate an exact joined dry-run plan.
3. Blind-review the bounded candidate classification and keep ambiguous rows out of any automatic plan.
4. Review the dry-run, use the exact manual opt-in if authorized, and independently verify the resulting condition mapping.
5. Keep the issue open until the above evidence is available and the live read-back is complete.

## Supporting artifacts

- Working evidence (restricted; not committed): `/Users/avimilman/Documents/Codex/2026-09-10/pu/work/watch-condition/sold-listing-before.txt`
- Working candidate analysis (not committed; pending review): `/Users/avimilman/Documents/Codex/2026-09-10/pu/work/watch-condition/active-watch-candidates.csv` and `active-watch-ambiguous.csv`
- PR #108 condition workflow: https://github.com/milman1/Lauramilman.com/actions/runs/34627345486
- Main write-disabled dry-run: https://github.com/milman1/Lauramilman.com/actions/runs/34627710402

## Work log

- 2026-09-11: Created this durable handoff from merged main commit `1404c6e`; recorded the verified 85-row metadata execution, the zero-write source-validation failure, the sold/active mismatches, and the remaining packed-weight/API blockers.
- 2026-09-11: Built and independently reviewed the source-backed, reviewed-snapshot repair workflow; recorded that it remains blocked on a nonzero API response and that no live apply has occurred.
