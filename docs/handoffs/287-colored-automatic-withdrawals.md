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

## Remaining work

Link final CI and dry-run artifacts, review the exact catalog changes, and manually merge when ready. Further merchant review is required for nonavailability exclusion withdrawals, any changed pricing formulas/discounts, or activation. None are silently approved by the numeric-cap decision.
