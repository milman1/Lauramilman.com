# Issue #107 — watch eBay condition integrity audit

- Issue: https://github.com/milman1/Lauramilman.com/issues/107
- Updated (UTC): 2026-09-11
- Status: **open; watch source recovered, exact condition-repair dry run remains**
- Source: remote `main` handoff fetched at the requested `75bc1c` state; GitHub file blob SHA `18ed93daa1c3ff21d0eacd067bcdb3c5237177db`
- Scope: watch condition evidence and Marketplace Connect condition mapping only

## Goal and acceptance criteria

The merchant authorized correction of watch eBay condition mappings across the API-backed watch catalog. The trigger is sold item `366649317404` (Rolex 116000), whose public condition says “New with box and papers” while its description says “Pre-Owned.” Prices, orders, buyers, inventory, and unrelated listing scope remain outside this task.

The source gate remains strict: `1000` requires structured `UNWORN` plus box and papers; `1500` is incomplete-accessory `UNWORN`; `3000` is used, pre-owned, or unknown. Titles and marketplace copy cannot upgrade a condition. Missing source data fails closed.

## Completed work and safeguards

- PR #108 merged at `386da74ecdcb3506f13748a9770993887d747975`.
- PR #109 merged at `1404c6e7f1af953beeea60bb08ec7a8518caf85e`; automatic condition apply is disabled.
- PR #111 merged at `79d066858edbac206f1fc31562f9a552e9f2d30f` as the source-backed, condition-only repair. It requires a reviewed dry-run artifact and SHA-256, stale-drift preflight, and post-read verification. It has not been applied live.
- Historical PR workflow execution applied 85 product updates and 151 metafield upserts; review found metadata-only changes, with no feature deletes or body rewrites. This does not verify every watch mapping.
- PR #109 dry-run `34628174469` read 2,069 catalog products and produced zero writes, upserts, feature deletes, or description rewrites.
- The latest source validation returned zero natural/lab/watch API rows and zero writes. No source-backed plan or live condition apply has run.

## RW3096 resolution

The merchant supplied `1 lb`. Shopify product `7642022805575` / SKU `RW3096` was saved at `1.0 lb` with unit `lb`, and a fresh Shopify reload confirmed the value. A fresh post-save read now shows:

- eBay item `366650116144`: main condition **Pre-owned - Good**.
- Marketplace detail: heading **Offer Listed**, with no current Error heading; condition **Preowned Good**.

The RW3096 package-weight and delivery blocker is resolved. This read does not establish that the source-backed condition repair has been applied across the watch catalog.

## Remaining audit state

The full API-backed watch audit remains open. The watch source now returns rows,
but the exact source join, reviewed dry-run artifact, manual opt-in, and
independent post-write read-back remain required. The optional title/SKU
candidate classification remains incomplete and excluded from repair; no
condition may be inferred from title, description, or SKU.

## Work log

- 2026-09-11: PRs #108, #109, and #111 merged; automatic and source-backed repairs remain fail-closed without approved source evidence.
- 2026-09-11: Merchant supplied 1 lb; Shopify saved and fresh-reload verified RW3096 at 1.0 lb/lb.
- 2026-09-11: Fresh post-save Marketplace/eBay read verified RW3096 as Pre-owned - Good with Offer Listed and no current Error heading. Full API-backed condition audit remains open.
- 2026-09-11: Diagnosed a cache/client boundary bug: the Worker represents a
  cold feed as HTTP 200 `{"data":[]}`, which the client accepted as a valid
  page and therefore never sent through its documented direct-supplier
  fallback. Branch `codex/feed-empty-cache-fallback` treats an empty cached
  page 1 as cache unavailable while preserving cached page 2 as the pagination
  terminator. A later cache error fails the whole feed instead of mixing cache
  and direct-source snapshots. This is code-level recovery only; no
  source-backed condition repair plan has yet been generated from this change.
- 2026-09-11: PR dry run `34634172621` read the supplier directly because
  `BELGIUMDIA_API_URL` was unset. It fetched 596 watch rows, with 51 past the
  existing gates, and performed zero writes. This confirms current watch-source
  availability. The later lab request returned zero after the earlier direct
  requests, consistent with the documented supplier rate limit. Next action:
  run the source-backed watch-condition repair in dry-run mode.
- 2026-09-11: Independent Sol and Terra reviews passed the final cache fallback
  and late-page fail-closed behavior; the focused suite passed 11 tests and the
  full suite passed 646 tests.


## Astra spot-audit work log — 2026-09-14

- Scoped audit status: **done**. The broader source-backed condition repair remains open and unapplied. The user's latest instructions authorize audit only, with at least 25 active watches and no condition edits.
- After #92, a fresh Seller Hub read of account `lauramilman-newyork` contained 133 active listings. Selected 30 different nonblank SKUs with explicit Pre-Owned watch titles. Each public item page was opened individually and its main eBay condition was read and recorded. This is a targeted sample of potentially affected watches, not a random sample or a catalog-wide prevalence estimate.
- Result: **30 listings audited; 25 contradictions flagged; 5 main conditions read Pre-owned - Good**. All 25 flags showed New with box and papers while the active listing title explicitly said Pre-Owned. These are review candidates; title evidence was not used to assign a replacement condition or upgrade source condition data. Shopify condition metafields were not inspected in this pass.
- Control readings with Pre-owned - Good: 3863, RW3035, RW3064, RW3096, RW3047. The prior RW3096 condition resolution remains visible.
- No listings ended and no condition, price, quantity, inventory, product, mapping, or template fields edited. No agents were spawned.
- Deliverables: [25 mismatch rows](../ebay/evidence/107-20260914/107-condition-mismatches.csv), [all 30 checked rows with evidence and timestamps](../ebay/evidence/107-20260914/107-watch-audit-all-30.csv), and one screenshot per checked item in the same directory (`107-watch-<item_id>.png`). CSV item IDs, SKUs, conditions, and URLs were checked for completeness and uniqueness; 25 flagged plus 5 unflagged reconciles to 30.
- Branch: `codex/107-watch-spot-audit-20260914`. This documentation-only PR records the completed spot audit; it does not close the source-backed repair issue.


### 2026-09-14 — merchant-requested keeper refresh
Condition mapping confirmed custom.ebay_condition, unchanged. RW3035 passed live condition/7%/brown-template check. RW3065 remains New despite mapped Pre-owned–Good and saved 7% offer. RW3085 update reports invalid/missing package weight; no weight correction made outside scope. See [work log](../ebay/evidence/keeper-refresh-20260914/keeper-refresh-work-log.md). Live synchronization/publication acceptance remains blocked.
