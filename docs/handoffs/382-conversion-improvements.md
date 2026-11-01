# Conversion improvements — issue 382

Updated: 2026-10-30 UTC. Owner: Codex session 040b848be90c.
PR: https://github.com/milman1/Lauramilman.com/pull/383

The merchant approved implementing the conversion audit while preserving the storefront design. Theme changes are implemented and verified on preview theme 160951205959; PR 383 is the deployment record. Check its merge state and live theme before repeating writes.

Completed: full-collection jewelry filters with failure feedback, independent band removal, pre-discount builder labels and actual cart discount labels, scrollable summary selections, optional sizing requests for eligible single-size house rings, qualified product policies, full-build consultation attachments with optional phone, consent-gated builder funnel events.

Catalog mutation already completed and independently read back: collection 295877705799 uses MANUAL sorting, with 12 active published pieces selected across price points and jewelry types. No prices or product statuses changed. Do not repeat the reorder blindly.

Validation: 25 focused Vitest tests; 8 ring-fit assertions; full ring-builder desktop/mobile browser regression suite; new collection/cart/consultation browser suite. Preview: 5 studs found across all 164 products; four-line ring build at 4519 before discount and 4219 after a named 300 setting discount; removing one 900 band preserves ring and men's band, total 3319; test cart cleaned up. Consultation carries full build and optional phone; Mini Signet has qualified requested-size field. No purchase or consultation was submitted. CI's stale homepage label expectation was updated to the existing approved LAB-GROWN JEWELRY label.

Validation limitation: remote source validator had been rejected by automatic approval review; local tests and Shopify preview were used. Check current PR CI and live storefront before reporting deployed.

Remaining verification: consent-aware events are implemented, but GA4 event receipt/configuration is not verified. Supplier measurements, missing product photographs and exact lead times require authoritative product-specific evidence and were not bulk-filled. The builder intentionally shows a pre-discount subtotal; Shopify determines actual pairing promotion eligibility in the cart.

Next action: verify PR 383 merged and the live storefront. Then verify analytics delivery in the merchant's configured analytics property with existing approved access, and obtain supplier-confirmed product facts before filling remaining gaps. Preserve the current prices, images/design and active-only catalog scope.

## 2026-10-30 — custom-event delivery repair

PR 383 was merged and the storefront verified. The merchant's subsequent GA4
test registered additional builder page views (3 → 6), but no `lmny_` events.
The theme did not load the Customer Privacy API before checking it. Its optional
top-window `gtag` path also did not explicitly forward Shopify custom events
through the installed Google pixel. The live Google app configuration uses
`G-CTWW9B42MX` and maps standard events, with no LMNY custom-event mapping.

Branch: `fix-builder-ga4-events`. Theme code now loads the supported consent API,
waits before checking permission, and records one builder-open after a later
consent grant. It drops actions performed while analytics permission is denied.
The prepared sandbox subscriber is `docs/analytics/lmny-ring-builder-ga4-pixel.js`;
installation and verification are in `docs/analytics/ring-builder-ga4-setup.md`.
It forwards eight allowlisted events to the existing GA4 destination, suppresses
its config page view, and does not subscribe to standard ecommerce events.

Not activated: the new pixel needs the merchant's Shopify Customer events UI.
This session cannot control the merchant's local browser. Keep the PR draft
until pixel installation and paired preview testing; merge only after that.
Then verify GA4 receipt and check for duplicate page views. Do not label local
test success as Google ingestion success. Supplier-content work is separate.

Validation: the complete desktop/mobile ring-builder browser regression passes,
including delayed privacy loading, denial then grant without replay, repeated
consent notifications, revocation, and loader failure. Three new pixel tests pass
for all eight event mappings, one script load, no standard-event subscriptions,
consent controls, event-ID deduplication and exclusion of personal data/URLs.
JavaScript syntax checks and `git diff --check` pass. No live theme or pixel was
changed during this repair session.
