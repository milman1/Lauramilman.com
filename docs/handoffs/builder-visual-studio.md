# Builder visual studio: prepared preview branch

Scope: upgrade the existing setting-detail screen with larger real product media,
actual non-size variant buttons, setting + selected diamond price breakdown,
and the same selection action in the mobile dock. The current diamond search,
filters, review, sizing, optional bands, persistence and cart code remain in use.
No new catalog, builder, models or prices. Setting images are labeled as references.

Not deployed. Browser regression must pass before merge. On 2026-11-09,
Chromium failed to create its process-singleton socket inside this executor
(Operation not permitted). Elevated retry was rejected by session policy.
976 Vitest tests and JavaScript syntax checks pass. Added browser assertions for
variant transfer and 320/390/1024/1440px overflow have not run.

Next: run LMNY_TEST_CHROMIUM=/usr/bin/chromium node
lmny-feeds/test/browser/ring-builder-flow.mjs in an executor permitting Chromium,
review actual setting media on desktop/mobile in a Shopify draft theme, then
obtain publication approval. This branch is a first setting-detail implementation,
not the entire concept: no style-family cross-product selector or global-header
redesign has been added. Update live only after the working preview is reviewed.
