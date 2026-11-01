# Laura Milman New York

Read `ORCHESTRATION.md` first (how work is chosen and finished), then
`AGENTS.md` (store facts: safety rules, pricing, system map). Process
conflicts: `ORCHESTRATION.md` wins. Safety and pricing conflicts:
`AGENTS.md` wins. Keep both vendor-neutral when editing.

Area docs: `SHOPIFY_SETUP.md` (store configuration), `lmny-feeds/README.md`
(feed syncs and pricing), `lmny-feeds/docs/` (listing schemas, SEO formulas),
`docs/seo/listing-seo-geo.md` (listing voice, SEO + GEO, video-first gallery).


## Required finished-jewelry intake and activation gate

For new house jewelry, finished lab-grown jewelry, house chains, and settings,
read `docs/seo/finished-jewelry-activation-checklist.md` and
`docs/seo/jewelry-activation-gate.md`. They supersede conflicting copy scores,
old finished lab-grown pricing, and manual activation steps for this scope.
Use `npm run jewelry:gate -- draft` for API creation or the default
`validate:jewelry-csv` preflight before a draft-only CSV import. For activation,
use either `jewelry:gate plan`, documented review, `check`, and `activate`, or
the equivalent authenticated Shopify connector workflow documented in the
gate. The connector path requires a complete paginated snapshot, the same
product-by-product evidence review, validated GraphQL, a fresh pre-write read,
an exact-ID status-only mutation, and an independent readback. Do not activate
with an Admin click or bulk status edit. Each product needs current evidence
and the merchant's authorization for its exact scope; do not fabricate
attestations.
Excluded categories retain their own workflows. Never activate existing
archived products or unrelated drafts. A repo rule does not intercept external
apps: see the enforcement limits in the workflow document.
