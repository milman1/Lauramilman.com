# Task: diamond product continuity
- Issue: https://github.com/milman1/Lauramilman.com/issues/385
- Updated (UTC): 2026-10-30
- Owner: Codex / fix/diamond-product-continuity
- PR: https://github.com/milman1/Lauramilman.com/pull/386
- Status: implementation tested; permission and production-run verification pending.
- Goal: preserve supplier product records across disappearance/return; prevent sales while absent; repair missing redirects. Prices, storefront design and channel policy unchanged.

## Completed and verified
- Changed Belgium-feed disappearance from delete to archive. Return uses existing ID/handle and normal gates. Removed the sync client's product-delete method.
- Added bounded redirect reconciliation for current and earlier archives, excluding present/held items and failed feed segments. Existing redirects are preserved. Errors fail the run after inventory safety work and reporting, and remain retryable.
- Retained archives do not dilute the feed-truncation safety threshold.
- All 948 tests across 89 files passed. Typecheck output matched main 49a9d81543a0e5acdbea8a4d16878a129b91a2a8 exactly (pre-existing failures).
- New redirect query/mutation validated against API 2026-01.
- Three live paths independently read back in Shopify and verified as HTTP 301 to /collections/natural-diamonds, which returned HTTP 200:
  - /products/nd-p61721a (redirect ID 417043382343)
  - /products/nd-17718d (redirect ID 417043447879)
  - /products/nd-xx290192630 (redirect ID 417043480647)

## Remaining work and exact next action
The latest Issue and PR state are authoritative for merge/CI status; do not rerun verified writes blindly.

1. The feed app needs `write_online_store_navigation`. Live run 41108725128 (job 124245197028) confirmed its issued/granted scopes omit this and urlRedirectCreate is denied. The connector used for the three repairs is a different app; its success does not establish the feed app's access.
2. In the feed app's Shopify Dev Dashboard, create/release a version adding that scope, preserving all existing scopes/settings. Approve the changed access on the installed store. Do not change or disclose credentials. Official steps: https://shopify.dev/docs/apps/build/authentication-authorization/manage-access-scopes
3. The available cloud browser was blocked at Shopify sign-in by a human-verification challenge. No app-scope change was made. Resume through an authorized signed-in session; do not bypass the challenge.
4. Verify the PR live-data dry run. After merge, verify a scheduled run uses the merged SHA. Check grant log, zero planned product deletes, archive outcomes, redirect pending/error counts and independent reads of a sample of archived products and repaired paths. The existing hourly job may be delayed; don't call a merge a verified live deployment.
5. Archiving does not depend on navigation access. Until the scope is approved, redirects remain blocked and the run reports failure after other catalog work. This is intentional visibility of incomplete navigation repair.

## Scope boundaries
No unavailable diamond was restored to sale. No price or theme change was made. Historical deleted product IDs cannot be recovered. This fixes a catalog defect; it does not establish the cause of, or guarantee recovery in, AI referral traffic.
