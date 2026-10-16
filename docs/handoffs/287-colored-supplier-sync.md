# Colored-stone supplier sync repair

- Issue: https://github.com/milman1/Lauramilman.com/issues/287
- Updated: 2026-10-16 UTC
- Owner: Codex, branch `repair/colored-supplier-sync-20261016`
- Status: code CI and full credentialed dry-runs passed; inventory guard verified. Recovery and rollout remain blocked for merchant review and 56 unrecognized-intensity exclusions. Do not merge or recover yet.
- Base: `bbedfb2e74087efa83c2f64b026aed6926f4455d` (latest main verified through GitHub API).
- Scope: colored supplier sync, diagnostics, recovery controls, approved natural/colored pricing, tests. No Shopify writes performed.

## Evidence and limits

Latest observed scheduled run: [38959215520](https://github.com/milman1/Lauramilman.com/actions/runs/38959215520), 2026-10-16 20:01 UTC, main `bbedfb2`. It failed at **supplier_fetch**; no normalized counts were logged, and artifact upload found no report. Existing generic error handling hides whether the failure was transport, HTTP, JSON or pagination. The precise supplier-fetch cause remains unverified until this branch's diagnostic dry run executes. Do not attribute this latest failure to the withdrawal guard.

Preceding run: [38935392035](https://github.com/milman1/Lauramilman.com/actions/runs/38935392035), 16:53 UTC, fetched **1,466**, eligible **541**, excluded scope 135, unavailable 688, grading/certificate 91, photo/video 11. Failed at `plan`, with no report. It did not log the exact exception or withdrawals. At 634 active, even perfect overlap with 541 eligible implies at least 93 withdrawals, exceeding 63. This is a lower bound, not a verified withdrawal list or a current supplier snapshot.

A fresh Shopify read at approximately 21:16 UTC paginated all 640 tagged products and applied exact ownership checks: **634 ACTIVE, 6 DRAFT, 0 ARCHIVED**, default limit **63**. Complete sanitized handles/status snapshot: [catalog audit](../audits/2026-10-16-colored-shopify-catalog.json). This is a catalog audit, not a supplier reconciliation; the supplier credential is unavailable in the local environment.

## Reconciliation of existing PRs

- #283, head `a9cdd7e6941db41fa0408ab4c14f85d51fc04e3b`: open/unmerged when inspected. Retain full preview, counted failures, withdrawal reasons and explicitly reviewed recovery ceiling. Strengthen recovery with an exact plan hash; save reports before guard failures, including supplier failures. Its numeric-only override is insufficient for binding approval to a reviewed plan.
- #286, head `ac4858750ec4fdc98ad053e25d67f0336494882b`: open/unmerged when inspected. Retain natural and colored formulas and colored normalization helper; replace overlapping guard diagnostics with one report implementation. This PR predates #285: copying entire files would regress white prices and tests. White configuration, guards, helper and lab test sections are preserved from main.
- Keep both old PRs open until this replacement passes evidence/review. Do not merge them independently afterward; close as superseded only after maintainer review.

## Pricing review

PR #286 records merchant approval: naturals use total invoice Amount × 1.60 through $4,000, × 1.45 above, with $6,400 boundary floor, rounded to whole dollars. Colored labs use validated total cost × 2.75 through $500, × 2.50 through $1,500, × 2.25 above; boundary floors $1,375 and $3,750, whole-dollar rounding. Never use per-carat cost as total. Existing 10% welcome discount remains; no discount objects are changed. Boundary, floor and after-discount profitability scenarios are tested. Actual live discount eligibility still requires operational verification; a config constant is not proof of Shopify discount configuration.

White loose lab configuration from #285 is unchanged: 2.50/2.25/2.00/1.75 targets at $200/$500/$1,000, boundary floors, $180 minimum retail and 10% welcome discount. No white reprice is requested or run.

## Validation

- Local full Vitest: 76 files, **873 tests pass**, including normalization and integration checks.
- Colored Node checks: **28 pass**, including end-to-end injected supplier/Shopify previews, exact colored reprices/draft arrivals with white source isolation, exact-plan recovery and independent withdrawal verification, prior-price drift detection even when target prices stay unchanged, over-limit and payload-plan failure report persistence, recovery rejection before mutations, exact grading-exclusion checks, media and exclusion reconciliation and sanitized supplier failure categories.
- Typecheck was run on both this repair and an archived copy of untouched main using the same dependencies. Both report the same 19 TypeScript diagnostics (shopify.ts, uploadifyMetafields.ts, pricing-ssot.test.ts and existing theme tests). Diagnostic outputs match exactly; no new type errors. These remain baseline debt, not a passing typecheck claim.
- White config/guards and affected white test sections compared byte-for-byte with latest main and match.
- Synthetic end-to-end runs are separate from the successful credentialed CI dry-run evidence below.

## Production recovery procedure

1. Do not merge until CI and full dry-run evidence are reviewed. This PR changes pricing used by scheduled feeds after merge: the regular feed may automatically reprice naturals if enabled. Coordinate merge timing with the merchant; use existing Actions repository variables to pause relevant scheduled writes during rollout if needed. Do not change white feed selection or prices for this task.
2. This branch runs a **full read-only colored dry-run** for same-repository PRs, using existing Actions secrets; fork PRs cannot receive them. If supplier fetching fails, inspect the always-uploaded sanitized `colored-stone-report-<run_id>` artifact. Fixed diagnostic code, HTTP status/page when available, and failure stage identify the failing boundary without raw exceptions, URLs, keys or wholesale costs. Resolve supplier service/credential issues before continuing. Unknown counts are `null`, never zero.
3. For a manual preview, Actions → LMNY colored loose-diamond sync → select this repair branch → `review-withdrawals` (or `dry-run`). Both inspect the **entire** source and catalog with no mutation. Sample mode still creates up to five drafts and is **not** a dry run. Do not select sample, sync or activate during investigation.
4. Download the sanitized report. Require `status=dry_run_complete`, `planningComplete=true`, `scope=full`, complete catalog counts and supplier fetch. Review **every** `withdrawals` handle and reason, including normalized exclusion reasons; verify supplier-unavailable stones and distinguish supplier-missing from grading/media exclusions. A failed media fetch does not prove a stone is sold. Review all writes (before/after retail and status), skips, new drafts and the complete owned-product reconciliation. Cross-check with the catalog audit and supplier inventory. A changed snapshot invalidates previous approval.
5. Merchant must approve the exact withdrawals **and** natural/colored price rollout, report `planHash`, explicit maximum and deployment window. Over-limit preview does not authorize writes. Scheduled runs retain max(5, floor(10% × active owned)). No silent threshold increase, automatic activation, archive or deletion is introduced. Recovery uses DRAFT for approved withdrawals; new arrivals remain DRAFT.
6. Only after merge and explicit merchant authorization, run `sync-with-withdrawals` with `max_withdrawals` set to the approved whole number (1–500) and `approved_plan_hash` copied from that reviewed report. Leave activation handles blank. The fresh full plan must match exactly, and withdrawal count must fit the explicit ceiling. Any drift stops before **all** writes. Do not raise the maximum or rerun after drift without a fresh report and approval. Recovery cannot be combined with sample/activation.
7. Independently read back every changed product (price, status, SKU/certificate, media and ownership) and each withdrawal, then verify public sample pages. The script's read-back is necessary but does not replace fresh public checks. Re-enable scheduled writes only after reconciliation, and verify the next scheduled run remains inside the unchanged automatic guard.
8. If writes partially fail, stop scheduled writes using the existing variables, retain the failure artifact, obtain a fresh read-only plan and review actual Shopify state. Never replay a stale approved hash or bulk reactivate/archive products. Restoring previous prices/statuses is a separate approved plan from an independent snapshot, not an automatic rollback.

## Remaining work / exact next action

Review the final evidence below, resolve the 56 intensity exclusions with the supplier/merchant, and decide the intended colored welcome-discount scope. Then obtain a fresh full final-commit preview for approval of every withdrawal, price change, plan hash, ceiling and rollout window. Merchant approval is required for production recovery and rollout; no live mutation is authorized in this session.

## Live welcome-discount audit (22:06 UTC)

Read-only Admin GraphQL verified an active 10% welcome discount scoped to 27 collections, including natural-diamonds and lab-grown-diamonds. Its list does **not** include colored-lab-grown-diamonds. All 640 colored products were paginated, including all collection memberships; **zero currently belong to an eligible collection**. Thus the configured colored 10% constant and profitability tests do not establish live eligibility. No discount was changed. Merchant must decide whether colored stones should be added to discount scope; that would be a separately authorized live discount change. Existing natural/white eligibility and all live discount configuration are preserved.

Replacement PR: https://github.com/milman1/Lauramilman.com/pull/288 (draft). Initial remote commit aa99b4a227ea94bfccde019cea0f48b6443687a9. CI runs: [colored full read-only](https://github.com/milman1/Lauramilman.com/actions/runs/38973539507), [regular feed tests/dry run](https://github.com/milman1/Lauramilman.com/actions/runs/38973539436); both passed. Updated code evidence follows below.

## Verified full source/catalog dry run, 22:05–22:09 UTC

Both initial CI runs above completed **successfully**, including the full credentialed colored dry run and regular feed tests/dry run (zero writes). Colored artifact [12077927749](https://github.com/milman1/Lauramilman.com/actions/runs/38973539507/artifacts/12077927749), ZIP SHA256 `66cd21d604927984e054ab61e0bb7b92e1716426b6f6b62977702356bd364a5b`, expires 2026-10-23. Durable sanitized copies: [full report](../audits/2026-10-16-colored-sync/dry-run-38973539507.json) and [every proposed withdrawal](../audits/2026-10-16-colored-sync/withdrawals-38973539507.csv).

- Source: **1,326 fetched, 539 eligible**, exclusions scope 128, unavailable 558, grading/certificate 90, photo/video 11. Actual media checks: **0 failures**.
- Shopify: **24,957 read**, 640 owned, **634 active / 6 draft / 0 archived**, unchanged withdrawal limit **63**.
- **135 withdrawals**: 74 supplier-unavailable, 56 grading/certificate-ineligible, 5 absent from supplier snapshot. Exact handles and reasons are in the CSV. A return from supplier-fetch failure demonstrates recovery of that request, but does not retrospectively identify the hidden exception in run 38959215520.
- Eligible supplier reconciliation: **499 active updates**, **4 draft updates**, **36 new drafts**, **0 skips**, total **539**, matching the eligible count. Catalog reconciliation: 503 updates + 135 withdrawals + 2 unchanged = all **640 existing owned**. Adding 36 new drafts yields **676 report rows**. All writes are colored-owned or new colored handles; no white write appears. The expected post-plan owned active count is **499**, draft **177** (6 existing + 135 withdrawals + 36 creations), owned total **676**, if this exact plan were approved/applied.
- Verified root cause of recurring planning failures: **withdrawal backlog exceeds the safety limit (135 > 63)**. The old report was written only after the guard, so failures lost the proposed plan and prevented review/recovery. Reports now survive both guard and payload-planning errors. Latest historical supplier-fetch failure is a distinct event; its precise original HTTP/transport cause cannot be recovered from generic old logs.
- Review fingerprint `64c86f68e0fac4f31b6ec11a71e39a51a34d92a51942cf4ec7ea50f5b1d0e6e1` identifies this snapshot **only**. It is evidence, not recovery authorization. Later reports/code may change the hash; use a fresh full final-commit report for actual approval.

**Production remains blocked:** 56 active products fail grading/certificate normalization; confirm whether the supplier changed intensity, clarity or certificate-link format before approving withdrawals. New fixed diagnostic checks distinguish those causes without recording raw source fields. No normalization gate was relaxed. Merchant must approve any corrected eligibility interpretation, exact withdrawals, price rollout and whether colored welcome-discount scope should change. Passing CI and a dry run do not approve these decisions.

## Latest verified code evidence (22:26–22:31 UTC)

Code commit `1466d6f35b09805ae2e330a12186f15f4093e2f5`: [colored checks + full dry-run 38975746337](https://github.com/milman1/Lauramilman.com/actions/runs/38975746337) **passed** (27 checks); [regular feed 38975746312](https://github.com/milman1/Lauramilman.com/actions/runs/38975746312) **passed** (873 tests + full dry run). Prior commit cf46d48 also passed both workflows ([colored](https://github.com/milman1/Lauramilman.com/actions/runs/38975243322), [regular](https://github.com/milman1/Lauramilman.com/actions/runs/38975243262)). All were read-only. [Independent natural/white sample checks](../audits/2026-10-16-colored-sync/natural-white-dry-run-checks.json): all five natural and eight white sample retails match the approved formulas; zero write errors/publications. The raw regular-feed artifact contains existing supplier-cost data and was not copied into this repository; only this allowlisted summary was retained.

Latest colored report: [durable full report](../audits/2026-10-16-colored-sync/dry-run-38975746337.json), [complete 132-handle withdrawal CSV with exact checks](../audits/2026-10-16-colored-sync/withdrawals-38975746337.csv), [original artifact](https://github.com/milman1/Lauramilman.com/actions/runs/38975746337/artifacts/12078917423), ZIP SHA256 `6068e7434408d69fa4b2622a1e9d1f93b4b0b1aaaf32478706f96367c6a2b7b1`, expires 2026-10-23. Durable copies do not expire with the artifact.

| Reconciliation | Verified count |
| --- | ---: |
| Complete supplier snapshot | 1,455 |
| Eligible supplier stones | 658 |
| Owned existing products | 640 (634 active, 6 draft) |
| Proposed existing updates | 506 (502 active, 4 draft) |
| Proposed new products | 152, all draft |
| Proposed withdrawals | 132 (68 unavailable, 56 intensity-ineligible, 8 missing) |
| Existing products unchanged | 2 drafts |
| Media failures / other skipped eligible stones | 0 / 0 |
| Default withdrawal limit | 63; over limit |
| Expected owned catalog if this plan were approved/applied | 792 (502 active, 290 draft) |

Independent set checks prove that all 640 existing handles equal the separately captured Shopify audit and all 658 eligible supplier handles equal the planned writes. The full report enumerates all 792 existing/new dispositions, all 658 supplier dispositions and excluded source handles/reasons. No white handle is in writes or withdrawals. The previous snapshot's 539 eligible / 135 withdrawals changed to 658 / 132; source turnover invalidates approvals based on old totals.

**Precise exclusion finding:** all 56 active grading exclusions are `unrecognized_intensity`, with no failed clarity or certificate-link check on those 56. Existing aggregate label `grading_or_certificate` is retained for compatibility; join `excludedRows` by handle for the exact checks (already included in the latest CSV). Investigate supplier intensity data or confirm each withdrawal before production recovery; no accepted-intensity list or eligibility gate was relaxed.

Latest plan hash: `af8f11f1f21affa82ba8d3e94361245096b9535ce56cf0bbf17f4f8bfd4ef10f`. This remains **evidence only**, never approval. Live recovery still requires fresh matching evidence and explicit merchant approval. Read-only diagnostics and controlled recovery code are prepared for review; deploying the combined pricing package or executing recovery remains blocked pending those decisions. The old supplier-fetch exception remains unrecoverable from historical logs, despite three successful subsequent credentialed snapshots.

Final recovery review strengthened the fingerprint to bind prior owned-product prices/status/identity and exact exclusion checks as well as target writes and withdrawals. A prior Shopify price change now invalidates approval even if the target retail stays the same. White/unowned catalog rows are excluded from that prior-state fingerprint so routine white updates cannot invalidate a colored recovery. Earlier recorded hashes predate this strengthening and must not be used for live recovery. This change is tested before any mutation; obtain a fresh full report from the final code.
