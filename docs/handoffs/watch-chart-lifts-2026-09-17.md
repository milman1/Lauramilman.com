# Task: Lift feed watches below the cost chart

- Issue: one-shot live reprice (no new Issue)
- Updated (UTC): 2026-09-17
- Owner / session: Cursor cloud agent `watch-chart-mismatch-reprice`
- Status: done (live-verified)
- Goal and acceptance criteria: every in-scope watch whose list is more than $50 below `retailFromCost` is set to the chart ticket. Chart in `lmny-feeds/config/pricing.ts` is unchanged. No price is lowered. Jacob & Co. and estate (`backvault-feed`) are out of scope. Cost stays off this file and off the storefront.
- Scope (files / live records): feed `Watch` / `Watches` variants with a recorded Cost per item; public plan `docs/pricing/watch-chart-lifts-2026-09-17.csv`
- Branch / commit / PR: `cursor/watch-chart-mismatch-reprice-958d`

## Dry-run (2026-09-17)

- Scanned: 850 Watch/Watches variants
- Lifts (list → chart): **60**
- Skipped above chart (not lowered): **2** — `w-u9084` ($4,365 vs chart $4,200), `w-p5362` ($33,271 vs chart $31,600)
- Public ticket lift sum: **$208,175**
- Largest lift: `w-6162` Patek Aquanaut 5167/1A $76,860 → $97,200
- Named examples: unworn Datejust 126334 `w-3953` $15,520 → $20,200; Explorer II `w-3705` $12,064 → $17,400

## Verification

- Independent SKU read after apply: **60/60** live list = `new_price`. Zero still below Cost per item.
- Left alone: `w-u9084`, `w-p5362` (already above chart).

## Remaining work

- None. Merge this PR to `main` so the audit trail lives on the default branch. The hourly Belgium sync already prices from the same chart, so it should confirm these tickets rather than revert them.

## Work log

- 2026-09-17: dry-run snapshot; lifts-only plan; two above-chart tickets left alone
- 2026-09-17: apply `productVariantsBulkUpdate` ok=60 errors=0
- 2026-09-17: independent verify planN=60 okN=60 mismatchN=0
