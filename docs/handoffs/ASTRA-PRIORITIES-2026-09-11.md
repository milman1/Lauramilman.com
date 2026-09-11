# Astra priorities handoff — 2026-09-11

- Status: in progress; code is merged where noted, live work remains pending review and fresh evidence.
- Branch: `codex/astra-priorities-2026-09-11`
- Base: main `31893171a9199da564f6d75ae7a8358ae143bd86`
- Owner: root orchestrator; Sol review before any PR.
- No customer data, costs, credentials, or live write evidence is included.

## Current priorities

### #92 — eBay takedown and Marketplace Connect disable

The stale 640-SKU end set intersects the latest saved Seller Hub export at 51 exact SKU/item-ID pairs. Fresh review selected 50 after excluding SKU `R3006`, item `366655894070`: Shopify product `7626078748743` is currently ACTIVE and must be protected. The 50-row sanitized plan is [92-reviewed-pending-end-plan-2026-09-11.csv](../ebay/92-reviewed-pending-end-plan-2026-09-11.csv).

The plan is pending and explicitly not executed. Seller Hub evidence reported 182 rows, with 51 old-end matches, 50 selected, zero extra, and zero missing after the R3006 exclusion. No eBay end was submitted and no Marketplace Connect disable writes occurred. Of the 155 baseline keepers, 67 are absent from that 182-row active baseline; those 67 are not contained in the 640 end set, and end/keeper overlap is zero. Issue #92 remains open.

The resumed-browser guard is mandatory: after any browser cleanup or turn boundary, freshly read the current active SKU/item-ID set and Shopify status, compare against the 50-row plan, confirm R3006 remains excluded, and only then consider any review or action. The 182-row count is a prior snapshot, not an assumption for the next read. A timeout and Mac lock interrupted the prior UI attempt.

### #91 — Marketplace Connect template refresh

The UI showed the toast “eBay templates refreshed”; publish was clicked once without a confirmation. The result remains unverified. Fresh UI read and publish confirmation are required.

### #93 — Royal Chain costs

The UI showed “Please Login To View Price.” The merchant must log in to the trade account in the browser; credentials must not be sent in chat or committed.

### #94 — supplier exact-SKU lookup

The exact SKU search found no supplier result. The merchant must identify the vendor/source before any further lookup; no product or price action is authorized.

### #95 — Jacob & Co sourcing

Terra will preserve the partial 25 source URLs. Bucherer evidence is absent, so the sourcing set is incomplete.

### #96 — SEO strategy

Strategy work is complete and merged via PR #117 at `31893171a9199da564f6d75ae7a8358ae143bd86`, covering 15 draft items and 12 audit fixes with Sol/Terra review. Keep the issue open because the merchant’s goal remains unconfirmed and later implementation is a separate stage.

### #102 — TLV/Vivid withdrawal

Implementation is merged and live archive/disable work was recorded earlier. Keep the remaining next-main-sync observation open.

### #105 — duplicate audit

The audit found 26 exact duplicate groups. It remains audit-only with no cleanup. Session restore was interrupted by the locked Mac; do not claim listing cleanup.

### #107 — watch condition

The last successful direct watch source read at 2026-09-11T18:36:19Z returned 596 raw source rows and 51 rows past the recorded gates, with zero writes. No repair-plan eligibility count was established. The next PR #116 run `34635412185` at 2026-09-11T18:49:24Z returned zero feed rows and zero writes, consistent with the source/API rate or availability failure. Earliest next condition dry-run is 19:05 UTC if no other calls are made and the Mac is available. No live condition repair is claimed.

### #114 — watch fact copy and eBay SEO

Code is complete and merged via PR #115. Related PR #116 merged at `86752fd`; validation recorded 646 tests with Sol/Terra review of 11 focused cases. Run `34635412185` returned zero feed rows and zero writes. Keep live rollout open until a successful source dry-run creates an eligible plan, the eligible sync completes, and Shopify/eBay output is independently verified.

## Required next actions

1. Sol reviews this handoff and the exact 50-row #92 pending plan; no PR until review passes.
2. Restore a usable browser session and fresh-read the current Seller Hub active SKU/item-ID set plus Shopify statuses before any #92 action. Preserve R3006 and compare every selected row.
3. Root obtains fresh UI evidence for #91, #92, and #105; do not infer completion from stale exports or interrupted sessions.
4. At or after 19:05 UTC, run the bounded #107 condition dry-run only if the source/API and browser prerequisites are available; fail closed on zero rows.
5. Obtain the merchant’s requested login and vendor/source identification for #93/#94 and complete Bucherer evidence for #95.
6. Leave all issues open where goal approval, source/API data, UI confirmation, or post-write verification is missing.

## Evidence state

- #92 pending plan commit on this branch: `009b5908c4c4a44f6eb38f09499d07e7f94bc1db`.
- No live eBay end, Marketplace Connect disable, condition repair, template publish, supplier-cost read, or SEO catalog rewrite is claimed in this handoff.
