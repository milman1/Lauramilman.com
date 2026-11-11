# GA4 session attribution repair — 2026-11-10

Status: preview verified; live cutover status is recorded in PR #420. Existing pixel 171900999 must be disconnected at cutover and retained for rollback.

## Evidence

- Re-read Nov 3–9 report: 948 sessions, 143 ring-builder landing sessions, 296 (not set). Custom events: 594, of which 592 have (not set) landing pages.
- Returning visitor: standard page_view and sandbox custom events shared cid and sid. This alone did not prove a sandbox issue.
- Fresh local Chrome Incognito visit, Analytics consent accepted: the standard page_view used cid 71383329.1794369978 while lmny_builder_opened and lmny_setting_selected used cid 287407664.1794369978. Both targeted G-CTWW9B42MX. The custom session ID was 1794369978. This reproduces separate visitor identity on first load.
- GA4 Realtime received diamond selection, band selection, save, share, and build_added_to_cart. Setting selection was captured in a successful GA4 request from the fresh session.
- Decline all suppressed GA4 collection on band selection/removal and a fresh reload. Restoring the prior all-granted choices restored band_selected and build_saved.
- An isolated builder cart add succeeded; test ring removed. Original lg-416178 quantity 1 / $220 remains. No order, inquiry, price or pixel change.
- Isolated preview capture showed one standard add_to_cart per component (setting and diamond), not two sends of the same item. Purchase/checkout duplication was not tested: no order was placed.
- Fresh preview session: page_view, setting selection and diamond selection used cid 2133281375.1794371500, sid 1794371499 and frm=0. Band/save/share also used the storefront session.
- Preview consent revocation suppressed requests during band selection/removal.
- Cart conversion was observed from the cart page with the same cid/sid. Reload did not resend it; test cart was emptied. GA4 Realtime received builder cart, save, share, band, diamond and setting events. Counts include controlled tests and must not be presented as customer conversion performance.

## Change

Use the existing storefront Google tag for allowlisted custom events. Do not load or configure a second GA4 tag, parse cookies, generate client/session IDs, or emit standard ecommerce events. Wait for the existing destination's get callback, recheck consent, and abandon pending events on revocation or timeout. Preserve the redirect event currently installed in the live custom pixel.

The Google event callback is not proof of network delivery: an isolated preview showed delivery delayed beyond the callback. A confirmed builder cart addition therefore places only sanitized event metadata in sessionStorage, valid for two minutes. The cart page consumes it once after a fresh consent check and uses the same existing Google tag. Revocation clears the handoff, denied arrival drops it, and reload cannot replay it. If sessionStorage is unavailable, the custom cart event is dropped without blocking purchase. The existing tag may take more than two seconds to initialize, so readiness is bounded at ten seconds. No shopper, engraving, full build, client ID or session ID is stored in the handoff.

## Required rollout

1. Run existing unit and desktop/mobile fixture browser suites on this branch.
2. Preview the theme in the connected local browser. The old pixel remains connected during preview, but updated builder code does not publish its custom events to that pixel. Disconnect it at cutover, including its separate redirect handler.
3. During controlled cutover, disconnect (do not delete or duplicate) existing LMNY ring-builder GA4 pixel 171900999 and deploy the tested theme through its GitHub connection. Google & YouTube remains connected and owns standard events.
4. Fresh local private session: consent denied, consent granted, setting/diamond/band/share/cart, and revocation. Compare standard page_view and custom event cid/sid; confirm one event per action and standard ecommerce counts. Remove test cart items.
5. Confirm events in GA4 Realtime; after processing, compare landing-page attribution for post-cutover events. Historical rows will not be repaired retroactively.
6. Rollback: revert the theme PR and reconnect the existing pixel. Do not have both senders active as the normal configuration.

## Measurement

Builder-to-cart = unique sessions containing builder_opened followed by build_added_to_cart divided by unique sessions containing builder_opened. Use a same-session ordered funnel. Do not divide raw cart event counts by ring-builder landing sessions. Exclude controlled tests and compare a full post-repair window; landing-only sessions omit visitors who entered through diamond pages.

