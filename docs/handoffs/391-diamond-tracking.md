# Issue 391: diamond purchase tracking

Prepared, not deployed. Update the existing Shopify Customer events pixel
`LMNY ring-builder GA4` (live metadata ID 171900999), using
`docs/analytics/lmny-ring-builder-ga4-pixel.js`. Do not create a duplicate.
Then verify the theme branch preview and merge the coordinated publisher changes.
See `docs/analytics/ring-builder-ga4-setup.md` for signals and consent checks.

Access on 2026-11-01: cloud Shopify admin redirects to accounts.shopify.com with
Too Many Requests / human verification. Bot detection was reported; no challenge
was solved. GA4 session shows Welcome / Start measuring, not LMNY reports.
No storefront deployment, pixel edit, inquiry or order was performed in this audit.

Local pixel tests pass. Browser regression test includes new telemetry cases but
cannot run in the resumed executor: Playwright Chromium executable is absent.
Run `node lmny-feeds/test/browser/diamond-purchase-choice.mjs` with Chromium installed
before deployment. Local Theme Check package is also absent in this executor.
Unit tests and syntax checks do not prove GA4 ingestion. Verify custom event receipt,
consent denial/grant/revocation and no duplicate standard page/commerce events.
Only after collection works can mobile drop-offs be assessed.
