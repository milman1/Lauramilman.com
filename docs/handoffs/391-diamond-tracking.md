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

## Browser verification — Nov 2, 2026, 1:23–1:29 AM ET

Draft theme 161107705927 is now accessible; preview bar confirms diamond-choice-tracking. No theme-code changes were needed to open and test the diamond PDP and builder. The six earlier import rejections remain unresolved, but no longer block these pages. Do not publish this draft theme.

Controlled preview tests: product lg-924390, switch Diamond only, successful Add diamond to cart, switch Build a ring, click original oval hidden-halo setting card. Pixel Helper received diamond_purchase_viewed, purchase_mode_selected, diamond_added_to_cart. GA4 independently showed those events plus ring_builder_started and setting_selected. Native Share this ring > Copy succeeded without sending to a recipient; pixel helper and GA4 received build_shared. Builder diamond selection received diamond_selected/product_viewed in helper and GA4; build_saved also confirmed. All names have lmny_ prefix. Restored original setting/lg-924390/size4.5/no-band build using original URL; removed only test lg-924390 cart line and independently confirmed original lg-416178 qty1/$220 remains.

Consent blocker: Customer privacy > Cookie banner says Not visible in any region. Official Preview opens ?preview_privacy_banner=1 but renders no banner; browser console reports 'banner not rendered due to lack of saved data'. No privacy configuration was changed. Germany market preview also produced no banner; returned preview to United States. Consent denial/grant/revocation/no replay remains unverified. Need a working consent UI without overriding merchant's no-design-change constraint.

GA4 Realtime showed 2 standard add_to_cart during window despite one controlled native diamond add; 3 active users means aggregate alone does not establish source or duplication. Duplication check remains open. Mobile viewport override attempt did not visibly produce mobile layout; reset override, mobile not passed. Required browser regression script still not run. PR remains draft/unmerged; live new-event verification remains pending. Screenshot /tmp/lmny-ga4-preview-events.jpg captures GA4 custom receipts.


## Consent configuration and browser checks — Nov 2, 2026, 1:30–1:48 AM ET

Merchant explicitly approved enabling the cookie banner. Saved manual visibility for Shopify's 31 recommended European regions plus United States (all 51 state entries). Existing Light appearance/position retained; checkout banner remains off. Added a Cookie preferences footer link in this branch using documented privacyBanner.showPreferences(), final implementation commit e166f4be99a47204bdb318f32346938f4f1ad058. It opens the real saved consent controls. No prices or product layouts changed.

Important correction: preview_privacy_banner=1 is an appearance preview, unsuitable for persisted-consent tests. Do not treat earlier preview-button behavior as a tracking defect.

Real diamond-page consent checks passed in existing pixel 171900999:
- Revocation: Analytics unchecked and saved; next mode change emitted no new custom event. Reload showed Pixel is awaiting consent, and preferences retained Analytics unchecked.
- Denied mode change followed by grant: exactly one lmny_diamond_purchase_viewed, no replay of denied action.
- Subsequent allowed mode change: exactly one lmny_purchase_mode_selected (helper count 1 -> 2).

Builder checks:
- Navigating into builder with Analytics denied left pixel awaiting consent.
- First grant had an inconclusive prolonged helper Loading state; after reload it loaded with exactly one lmny_builder_opened. Do not claim first-grant-without-reload passed.
- Revoked Analytics in loaded builder, selected original $1,690 oval hidden-halo setting: helper count stayed 1.
- Regranted Analytics: denied setting selection was not replayed, count stayed 1.
- New wedding-band selection produced exactly one lmny_band_selected (count 1 -> 2).
- Removed test band; original setting, lg-924390, ring size 4.5, no band/engraving/date restored. No cart mutation in this consent test.

Mobile: 390x844 viewport override gave measured document clientWidth 375, screenshot showed mobile hamburger and single-column diamond PDP; keyboard switching to Diamond only worked. Override reset. No mobile cart submission performed.

Merge remains blocked by required automated browser regression run (no repository/test runtime present in this local workspace), definitive per-action standard-event duplication verification, and resolving the builder initial late-grant loading ambiguity. GA4 user snapshot did not isolate our full test stream. Existing prior GA4 custom receipts remain valid; no live publisher merge or live new-event verification claimed. Six previously documented draft import failures remain; do not publish this draft theme.


## Subscription discovery repair — Nov 2, 2026, 2:25 AM ET

Cloned diamond-choice-tracking into the merchant workspace and installed locked dependencies. All 949 unit tests passed before and after the pixel change. Installed Playwright Chromium in /tmp/lmny-playwright, but both browser regression scripts abort at Chromium startup: macOS bootstrap_check_in MachPortRendezvousServer permission denied (1100), SIGTRAP. This is the execution sandbox, not a failed application assertion. No sandbox bypass attempted.

Shopify pixel editor reported that the connected pixel was not subscribed to any events despite runtime loop subscriptions. Replaced the loop with twelve explicit literal analytics.subscribe calls, retaining the same forwarding/consent/deduplication function. Commit d49a307. Updated existing connected pixel 171900999, saved, reloaded; the no-subscriptions warning is now absent. Analytics permission remains required; no duplicate pixel created. Pixel unit tests pass.

The literal-subscription correction does NOT yet resolve the reproduced late-consent stall: after initial denial, reload, and grant through real preferences without a reload, helper remains Loading / awaiting consent / 0 events. A regular preview without helper was also examined using DevTools: Google's standard requests updated consent from G110 to G111, but no custom-pixel collection request was established. Do not claim this browser case passes or merge yet. No speculative consent bypass or forced reload added. Standard-event duplication remains unverified.

Local checkout: /Users/avimilman/Documents/Codex/2026-10-30/new-chat-2/lmny
Browser test commands (must run in a terminal allowed to start Chromium):
```sh
cd /Users/avimilman/Documents/Codex/2026-10-30/new-chat-2/lmny/lmny-feeds
PLAYWRIGHT_BROWSERS_PATH=/tmp/lmny-playwright node test/browser/diamond-purchase-choice.mjs
PLAYWRIGHT_BROWSERS_PATH=/tmp/lmny-playwright node test/browser/ring-builder-flow.mjs
```

No cart/order/inquiry changes. Original ring/no-band configuration restored. Price and layout files unchanged.


## Approved cloud browser regression — Nov 2, 2026

Merchant approved a test-only GitHub Actions workflow and use of local Chrome. Added .github/workflows/storefront-browser-tests.yml (19d8ecc), read-only contents permission, no secrets, synthetic intercepted storefront/cart requests. GitHub Actions run https://github.com/milman1/Lauramilman.com/actions/runs/41474077578 completed successfully: npm test, diamond-purchase-choice.mjs, and ring-builder-flow.mjs all passed. Independently confirmed Success in local Chrome. The macOS execution blocker no longer prevents regression validation.

The previous late-grant helper session eventually showed exactly one lmny_builder_opened at 2:26:01 AM without another reload. A repeated deny/reload/grant still showed Loading/0 events during the immediate observation window; do not treat this as a consistently passing live consent case. Foreground diagnostic attempts were interrupted by concurrent Chrome focus changes. No temporary logging or permission relaxation installed. Standard-event duplication and stable real consent verification remain open; PR unmerged.

## Native network diagnosis — Nov 2, 2026, 11:20–11:31 AM ET

Completed an isolated diamond-only cart request check in Chrome DevTools. Cleared Network before one Add diamond to cart on lg-924390. Exactly two GA4 collection requests followed: one standard en=add_to_cart (frm=0, quantity 1, USD230) and one custom en=lmny_diamond_added_to_cart (frm=2, purchase_mode=diamond_only). Both targeted G-CTWW9B42MX. Helper also increased once for the custom success event. Removed only the test diamond and verified original lg-416178 quantity1/$220 remained. This resolves the prior aggregate add_to_cart ambiguity for this controlled action; it does not establish all enhanced-measurement events are duplicate-free.

Important tooling diagnosis: the late-grant custom sandbox document stayed Pending/Stalled in DevTools before pixel execution, including in a preview without helper. Clicking Cancel on Chrome's 'ChatGPT started debugging this browser' infobar immediately released the request; its completed network timing was ~67ms, and custom GA4 requests began without a page reload. This strongly implicates the automation debugger's handling of newly attached sandbox frames, rather than the pixel code. Do not introduce consent bypasses or forced reloads to work around this test-tool behavior.

A native-only repeat began: denied Analytics, saved, reloaded with debugger disconnected; only Google's standard consent-mode traffic (G110), no custom sandbox collection traffic, was observed. Foreground Chrome was then actively used for another task, interrupting the grant/revocation/no-replay repeat. That last native-only sequence remains pending. Later background cleanup restored No wedding band (confirmed selected option); no orders/inquiries submitted. Browser control may reattach the debugger: disconnect it again before the final native-only consent test.

Also observed a custom-sandbox automatic scroll request (frm=2) after Google tag initialization. No second scroll for the same controlled action was established; review enhanced-measurement behavior before claiming every standard event is duplicate-free. PR remains draft/unmerged. Final native consent check, broader standard-event check, merge, main-theme deployment and live GA4 receipt remain pending.
