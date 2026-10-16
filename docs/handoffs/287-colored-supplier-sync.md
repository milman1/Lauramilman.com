# Colored-stone supplier sync repair

- Issue: https://github.com/milman1/Lauramilman.com/issues/287
- Updated: 2026-10-16 UTC
- Owner: Codex, branch `repair/colored-supplier-sync-20261016`
- Status: implementation prepared; live evidence pending. Do not merge or recover yet.
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
- Colored Node checks: **23 pass**, including end-to-end injected supplier/Shopify previews, over-limit report persistence, recovery rejection before mutations, media and exclusion reconciliation, source isolation and sanitized supplier failure categories.
- Typecheck was run; baseline comparison and CI/live dry-run results must be recorded below.
- Synthetic end-to-end runs are not live supplier evidence. Definition of done remains blocked until a successful full credentialed dry run and catalog reconciliation are recorded.

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

Open the replacement draft PR, inspect CI and the credentialed colored full dry run. If it fails at supplier fetch, use its sanitized code/status to establish the actual cause. Obtain a successful full source snapshot before claiming reconciliation or proposing exact withdrawal approval. Merchant approval is required for production recovery and rollout; no live mutation is authorized in this session.
