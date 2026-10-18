# Colored availability withdrawals without a numeric cap

- Issue: https://github.com/milman1/Lauramilman.com/issues/287
- Owner: Codex; branch `repair/colored-automatic-withdrawals-20261018`
- Base: latest main `e691301` (includes #283, #289 and #291).
- Status: prepared for review; no merge or live sync executed by this change.

## Current merchant decision

On October 18, 2026 (America/New_York), the merchant explicitly confirmed removing the inventory withdrawal limit for colored lab stones, allowing supplier-unavailable or missing stones to move automatically to DRAFT. This supersedes the original instruction to preserve the numeric threshold for this source only. It does not remove price floors or change pricing formulas, white lab sync, natural sync, watch sync, feed completeness, ownership or activation rules.

## Implementation and deployment scope

Normal colored sync now has `withdrawalLimit: null` (no count cap). It may withdraw any number of source-owned ACTIVE products only when the complete supplier feed marks them unavailable or omits them. A nonempty, complete, stable supplier snapshot and complete Shopify pagination remain mandatory. Zero eligible stones, duplicate source identities, and failed planning stop writes. New products remain DRAFT. Archives, deletes, unrelated products and activation behavior are unchanged.

An active product excluded for grading/certificate, invalid cost, source scope, missing media, or failed media fetch is explicitly marked nonautomatic in the report. It stops all automatic writes with `withdrawal_reason_requires_review`. A manually reviewed recovery still requires its optional explicit maximum and matching full-plan hash, preserving that controlled recovery feature. Reports include exact handles, reasons, catalog counts, automatic flags, review status and explicit null count limit. Reports upload even after failure and never contain supplier costs or credentials. Withdrawals are independently read back after writes.

This focused PR ports diagnostic/reporting/recovery functionality from #288 but excludes its superseded keep-active list and all #286 pricing changes. `config/pricing.ts` and `src/markup.ts` are untouched. Colored total-cost pricing remains the exact main formula; white #285 remains untouched. Do not merge #288 as-is over this policy.

The exact 56 stones previously approved for DRAFT were independently verified as DRAFT before this change. They are not retained-active exceptions and this sync does not reactivate them. Latest pre-change full preview [39080438423](https://github.com/milman1/Lauramilman.com/actions/runs/39080438423) found 578 active / 62 draft owned products, 69 supplier-unavailable plus 8 missing candidates (77 total), versus the former 57 limit. It fetched 1,491 rows, normalized 656 eligible, checked all media, and completed reconciliation. This snapshot explains the old failure; it is not a current production plan.

## Verification

- 31 local colored Node checks pass, covering normalization, stable/complete source fetching, no default count cap, the exact 69 unavailable + 8 missing scenario, status-only mutations, unchanged other-source/draft/archive data, independent withdrawal read-back and failure detection, no writes on source/Shopify pagination failures, exact-plan drift rejection, failure report persistence and sanitization.
- Full Vitest: 75 files, 855 tests pass on this main-based branch.
- No pricing/configuration changes; whitespace validation passes.
- Credentialed final-commit read-only workflow evidence will be linked here and in the PR after completion. CI success alone is not proof of production deployment.

## Production procedure

1. Review the new full credentialed dry-run artifact: `status=dry_run_complete`, `scope=full`, `planningComplete=true`, complete source/catalog, exact withdrawals and writes. Require every intended automatic withdrawal to have `automatic=true` and `reviewRequired=false` for an ordinary run.
2. Review and merge this focused PR manually. No auto-merge is authorized. The merchant has approved removal of this source's numeric cap. Neither #286 nor #288 pricing is needed for this fix.
3. Run Actions → LMNY colored loose-diamond sync → main → `sync`, or let the enabled scheduled colored job run. The fresh complete snapshot controls that run; it does not reuse stale withdrawals. This is the existing full sync: eligible products may receive ordinary main-formula content/price updates and arrivals remain DRAFT. This implementation session does not authorize new pricing formulas or execute that live run.
4. Require `status=verified`, inspect the exact report, independently read all withdrawals and sample public pages, and verify the next scheduled run. A partial failure requires a fresh reconciliation of actual Shopify state before retry; never restore/activate products automatically.

## Verified final-code CI and credentialed full preview

PR: https://github.com/milman1/Lauramilman.com/pull/294 (mergeable, no merge).
Tested code commit: `4e7f7d007bd0b36e24ed4179182f880c92d01084`.
Both [colored checks and full preview](https://github.com/milman1/Lauramilman.com/actions/runs/39145587382) and [regular feed CI/full preview](https://github.com/milman1/Lauramilman.com/actions/runs/39145587406) passed.

The credentialed colored run completed October 18 at 12:38 p.m. America/New_York. Full stable source: 1,491 records / 656 eligible; no media failures. Shopify: 25,402 catalog products read, 640 colored-owned (578 ACTIVE / 62 DRAFT). Report is `dry_run_complete`, full scope, planning complete. All 77 withdrawals qualify for automation: 69 unavailable and 8 missing. `withdrawalLimit=null`, `overLimit=false`, `reviewRequired=false`. All 56 previously drafted products are reconciled as unchanged DRAFT.

Exact plan: 77 withdrawals, 5 existing updates, 151 new drafts, 558 unchanged existing products; no skips. These reconcile every existing owned product and eligible supplier handle. If applied unchanged, expected owned catalog would be 791 products: 501 ACTIVE / 290 DRAFT. This remains a preview, not a live result.

Four of the five existing updates have retail price drift under unchanged main pricing: `lg-color-1011138` $1,029.52 → $923.79; `lg-color-1012957` $1,651.13 → $1,552.95; `lg-color-1014678` $681.45 → $602.98; `lg-color-74203` $7,323.75 → $7,161.00. No live price update was executed. Review those alongside the full plan before a live full sync; removing the withdrawal cap does not make a full sync a status-only operation.

Committed report: `docs/audits/2026-10-18-colored-automatic-withdrawals/dry-run-39145587382.json`; exact 77-handle list: sibling `withdrawals-39145587382.csv`. Downloaded artifact 12143257780; ZIP SHA256 verified `2f50187392d5a0587dfd44a639cc994d2fefc3f7c4eb45d7b5ae3b093949be14`. Plan hash: `bdea6b4c40ea73bd972790d2edd1baec2481ecf6f777932c5bbb5031d7e2b1dd`. These identify the evidence; future snapshots can differ.

## Remaining work

Review the exact catalog changes (including the four main-formula retail changes) and manually merge when ready. Further merchant review is required for the live price changes prohibited earlier in this session, nonavailability exclusion withdrawals, any changed pricing formulas/discounts, or activation. None are silently approved by the numeric-cap decision. No live run or merge has been executed.
