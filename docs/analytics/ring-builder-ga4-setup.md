# Ring-builder GA4 repair

Status: prepared; the custom pixel must be installed and live receipt verified.
Related: issue #382. Destination `G-CTWW9B42MX` was read from the live
Google & YouTube app configuration on 2026-10-30. Reconfirm it before installation.

The merchant's GA4 test registered page views (3 to 6) but no `lmny_` events.
The theme published custom Shopify events and optionally called a top-window
`gtag`, but had no explicit pixel subscriber routing them to GA4. It also checked
the Customer Privacy API without loading it. Existing tests stubbed that API as
already available; they did not verify Google delivery.

The repair loads the consent API before publishing, records one builder-open
event after a later consent grant, and never replays actions performed while
analytics consent was denied. The separate custom pixel subscribes to the eight
named events, forwards only allowlisted parameters, and suppresses its initial
automatic page view. It does not subscribe to standard commerce/page events.
The existing Google & YouTube app continues to own standard ecommerce tracking.

## Install and verify

Use the merchant's connected browser and existing Shopify admin session.

1. Open Settings → Customer events. Inspect current pixels first. If an LMNY
   ring-builder forwarding pixel already exists, update that one; do not duplicate it.
2. Add a custom pixel named `LMNY ring-builder GA4` and paste the complete contents
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
