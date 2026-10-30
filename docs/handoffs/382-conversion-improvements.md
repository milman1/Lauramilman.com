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
