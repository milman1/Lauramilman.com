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

## Local browser checkpoint — 2026-11-02 UTC (Nov 1 evening ET)

Owner: Codex, merchant-authorized continuation in local Chrome. PR remains draft/unmerged.

- Updated existing connected pixel 171900999 (LMNY ring-builder GA4), not a duplicate. Installed exact PR pixel blob 6a54645a1238577e4e01e23162961a8de968abd5. Shopify showed Changes saved; reload showed the new four event subscriptions. Analytics required; Marketing/Preferences off; not data sale.
- GA4 property 413439924 / stream 6321020106 confirms G-CTWW9B42MX. Stream retains legacy Laura's Gems NY name/domain and a stale collection warning, but Realtime subsequently received controlled test events.
- Shopify pixel helper loaded the pixel and received builder_opened, band_selected, build_saved. GA4 Realtime independently showed lmny_builder_opened, lmny_band_selected, lmny_build_saved, and lmny_build_added_to_cart (one successful builder add).
- Added the restored oval ring plus a lab-grown wedding band to the cart; verified the three test lines, then removed their complete group. Preserved the pre-existing lg-416178 cart item, quantity 1. No checkout, order, inquiry, price or design change. Removed the test band from the saved builder afterward, restoring its original no-band selection.
- Share clicked but reached Copy this link fallback; no successful lmny_build_shared receipt verified. Chrome focus changed during the clipboard-share test.
- Shopify Online Store /themes panel remains blank after refresh (admin navigation works, embedded theme library does not). No verified branch preview available, so do not merge PR #392. New diamond publisher events remain undeployed.

Still pending: branch preview and browser regression script; setting/diamond selection and successful share receipts in this test session; four diamond-product events; consent denial/grant/revocation/no replay; per-action standard-event duplication checks; merge and live diamond-event verification. GA4 showed 3 standard add_to_cart events for the three-line builder add, but this alone is not a duplication verdict.

Exact next step: restore the Shopify theme library in the same signed-in browser, connect/open diamond-choice-tracking preview, then run the remaining tests before merging. Do not reinstall the already-updated pixel or create another. Keep the existing Analytics requirement. For share testing, keep the storefront tab foreground long enough for clipboard access.

## Preview import checkpoint — 2026-11-02 03:46 UTC

After the merchant removed older themes, the library loaded. Connected the existing GitHub repository/diamond-choice-tracking branch as a new unpublished draft named Lauramilman.com/diamond-choice-tracking. No theme was published or deleted by the agent.

Shopify integration log at 10:45:30 PM EST: 1,384 succeeded, 0 warnings, 16 failed (retry attempts); theme updated but 6 files were not saved:
- AGENTS.md exceeds Shopify's 50 KB maximum.
- sections/lab-grown-diamonds-feature.liquid: schema name exceeds 25 characters.
- sections/footer-group.json: text block type not defined in schema.
- templates/page.shop.json: lab-grown-diamonds-feature section missing due to rejected section.
- templates/password.json: heading, paragraph, email_form block types not defined.
- templates/product.test.json: vendor/title/subtitle/price/variant_picker/quantity_selector/buy_buttons/description/share block types not defined.

The new draft's Edit/Publish controls remained disabled. After a refresh, the embedded theme library became blank again; navigating Home then Online Store did not restore it. Preview behavior therefore remains unverified. No further cart actions, pixel edits, storefront changes, or merge in this continuation. PR stays draft. Next: recover draft preview access and resolve or isolate these import failures without changing live design/prices, then finish the previously listed browser/consent/GA4 checks.
