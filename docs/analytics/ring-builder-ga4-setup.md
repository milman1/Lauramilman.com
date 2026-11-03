# Ring-builder GA4 repair

Status (2026-11-01): existing custom pixel is connected in live storefront metadata
(ID `171900999`, name `LMNY ring-builder GA4`, Analytics permission). Its installed
source and GA4 receipt remain unverified. Update this existing pixel; do not add another.
Issue #391 prepares four additional diamond-product events alongside the original eight.
Related: issue #382. Destination `G-CTWW9B42MX` was read from the live
Google & YouTube app configuration on 2026-10-30. Reconfirm it before installation.

The merchant's GA4 test registered page views (3 to 6) but no `lmny_` events.
The theme published custom Shopify events and optionally called a top-window
`gtag`, but had no explicit pixel subscriber routing them to GA4. It also checked
the Customer Privacy API without loading it. Existing tests stubbed that API as
already available; they did not verify Google delivery.

The repair loads the consent API before publishing, records one builder-open
event after a later consent grant, and never replays actions performed while
analytics consent was denied. The separate custom pixel subscribes to twelve
named events, forwards only allowlisted parameters, and suppresses its initial
automatic page view. It does not subscribe to standard commerce/page events.
The existing Google & YouTube app continues to own standard ecommerce tracking.

## Install and verify

Use the merchant's connected browser and existing Shopify admin session.

1. Open Settings → Customer events. Inspect current pixels first. If an LMNY
   ring-builder forwarding pixel already exists, update that one; do not duplicate it.
2. Edit the existing custom pixel named `LMNY ring-builder GA4` and replace its code with the complete contents
   of `docs/analytics/lmny-ring-builder-ga4-pixel.js` (JavaScript only, no HTML).
3. In its Customer privacy settings require Analytics. This pixel does not use
   marketing permissions, advertising signals or data sale; select the matching
   non-sale option. Review the visible settings before connecting.
4. Save and connect the pixel. The theme fix and pixel are a coordinated change:
   test the branch on a preview, then merge its PR once the pixel is connected.
5. Test the builder on desktop/mobile with analytics allowed. Verify the custom
   events in Shopify's pixel test tool and GA4 Realtime/DebugView. If using
   DebugView, enable debug mode for the controlled test only, not all shoppers.
6. Verify the denied-consent case sends no LMNY events. Grant consent on the same
   page and confirm exactly one new `lmny_builder_opened`; earlier actions must
   not be replayed. Revoke consent and confirm later actions stop forwarding.
7. Verify a normal visit still has one page view through the existing Google
   integration. `send_page_view: false` suppresses this pixel's config page view;
   GA4 Enhanced Measurement history behavior must still be checked live.
8. Check `lmny_product_viewed`, `lmny_setting_selected`, `lmny_diamond_selected`,
   `lmny_build_saved`, `lmny_build_shared`, `lmny_band_selected`, and
   `lmny_build_added_to_cart` with the corresponding actions. Use a disposable
   test cart and clear it afterward. Do not place an order or submit an inquiry.

Keep issue #382 open until event receipt is independently confirmed. Local tests
verify the theme publisher and pixel command generation, not GA4 ingestion.
Disconnect this custom pixel to roll back forwarding; retain the existing
Google & YouTube app. Do not change prices, layouts or standard purchase tracking.

References:
- https://shopify.dev/docs/api/customer-privacy
- https://shopify.dev/docs/api/web-pixels-api/emitting-data
- https://help.shopify.com/en/manual/promoting-marketing/pixels/custom-pixels/code
- https://shopify.dev/docs/api/web-pixels-api/pixel-privacy
- https://developers.google.com/analytics/devguides/collection/ga4/views

## Diamond choice events (#391)

| Event | Meaning |
|---|---|
| `lmny_diamond_purchase_viewed` | Diamond purchase section initialized with analytics allowed; once per page initialization, including later consent grant. Not proof of viewport exposure. |
| `lmny_purchase_mode_selected` | Shopper changed Build a ring / Diamond only; initial default is excluded. |
| `lmny_ring_builder_started` | Click on main/sticky build CTA, setting card, or all settings link; navigation intent, not confirmed builder load. |
| `lmny_setting_selected` with `screen=diamond_product` | Setting card clicked; distinguish from builder-screen selections. |
| `lmny_diamond_added_to_cart` | Native diamond form AJAX add succeeded; distinguishes Add to cart / Buy now. Not an order. |

Product events use a validated public product handle to construct a canonical product
page URL. Query strings, fragments, engraving and customer data are never forwarded.
Install the backwards-compatible pixel update first, verify preview events, then merge
the publisher change. The pixel source is not deployed automatically by theme git sync.
Analyze mobile versus desktop only after receipt is verified; previous missing events
cannot establish abandonment. Existing band events remain unchanged.

## Diamond redirect landings (prepared; approval and live verification required)

The same existing pixel observes `page_viewed` and sends only
`lmny_diamond_redirect_landing` when a collection URL has a valid
`lmny_redirect` diamond handle. It never emits another standard page view.
Parameters: `original_diamond`, `redirect_collection`, `origin` (`lab`,
`natural`, `colored_lab`). Register these as event-scoped custom dimensions
in GA4 (reuse existing `origin` if already present). Build an Exploration
filtered to this event; use event count, users, original diamond, destination,
and session source/medium. Event count measures marked landings, not server
redirect requests; copied marked URLs can produce another landing, and
consent denial, blockers and previously cached unmarked redirects cause misses.
No historical redirect usage can be reconstructed by this change.

Installation order: update the existing pixel, test a marked collection URL
with consent allowed/denied and verify GA4 receipt, then deploy the sync changes
and apply the reviewed tracking migration plan. Preserve collection filters
and all UTM parameters. Inspect existing pixel source before replacement to
avoid overwriting a concurrent change. The pixel forwards a referrer origin
only; it strips paths, queries and fragments from referrers and page URLs.
Cross-pixel session attribution and purchase joins require live verification;
do not promise attribution for every AI app or private browser.

The primary sync revisits archived products each run and now independently
reads back created redirect paths. The colored sync also revisits owned missing
drafts/archives after a full successful feed and withdrawal verification.
Existing overrides are preserved; active products and limited/activation runs
are excluded. Failures leave work retryable and fail the job. Shopify retained
products preserve handles; previously deleted URLs absent from all history
cannot be recovered by this pass.

The existing scheduled main-sync workflow performs a read-only full HTTP check
during its 06 UTC run. GitHub schedules are best-effort; a missed/delayed run
can delay this audit. Check Actions failures (notifications are not configured
by this change). Reports distinguish restored product pages, valid redirects,
404s, loops, incorrect destinations and lost filters/markers. It also generates
`out/diamond-redirect-tracking-plan.json` containing exact before/after targets;
the audit never applies that plan or changes products.

Before applying the plan, re-read every redirect and reject stale before-values.
Apply only exact IDs with unchanged paths/targets, then independently re-read
and HTTP-test the changed links. Test natural, lab and colored diamonds and
one filtered destination. Keep this work pending until the pixel, redirect
migration, scheduled sync and GA4 event receipt are live-verified.
