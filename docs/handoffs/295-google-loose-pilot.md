# Controlled Google loose-diamond pilot

- Issue: https://github.com/milman1/Lauramilman.com/issues/295
- Owner: Codex, 2026-10-18
- Status: implementation merged in PR #296; live publication paused by the
  production flag after automatic approval review rejected channel changes.
- Merchant authorized the controlled Google feed fix in the current session.
- Scope: five 2.00–2.03 ct oval lab-grown diamonds selected from the committed
  241-stone shortlist. `lmny-feeds/config/googleLoose.ts` is the rollout list.
  Expansion is held until the first listing is verified in Merchant Center.

## Behavior

The existing hourly supplier sync now reconciles this Google-only subset even
when its product content hash is unchanged. A successful, unlimited lab fetch
is required; disabled feeds, outages and limited runs defer the reconciliation.
Current publishable supplier membership, IGI/GIA certificate, core stone specs,
supplier image, ACTIVE online product, matching certificate and SKU, a READY
Shopify image, positive existing price, and the existing tracked-zero/CONTINUE
policy are required. Missing or held supplier rows cannot qualify.

The reconciler sets Google custom-product and new-condition attributes and
publishes only to Google & YouTube. Native Shopify synchronization supplies
the existing title, description, product link, image, price and availability.
Actual Merchant Center ingestion and approval must be checked; successful
Shopify publication alone does not establish either.

The `lmny-google-loose` marker records managed listings. Withdrawals and
shortlist removals are unpublished from Google, leaving other channels alone.
Pre-write managed handles remain in scope if productSet replaces their tags.
Deleted Shopify products disappear from the read; this code cannot remove
Google's separate automatically crawled offers, which need Merchant Center
cleanup/recrawl and destination checks.

No pricing rules, variant prices, inventory quantities/policies, eBay rules,
Uploadify flags or Meta/Pinterest publication rules are changed by this feature.
Google attributes are preserved on ordinary pilot product updates; their
backfill does not change content hashes or force product/price rewrites.

## Verification and deployment

- 183 focused tests pass, including 17 new gate/reconciliation tests.
- Three new GraphQL operations validate against Shopify Admin 2026-01.
- Focused TypeScript compilation encounters existing errors in unchanged
  shopify.ts; no new-module errors remain.
- Existing pull-request workflow performs a supplier-backed dry run; scheduled
  live runs use the existing LMNY_SYNC_LIVE setting. No setting change needed.
- Plan is written before Google mutations; a fresh product read verifies every
  managed listing afterward. Any write/verification mismatch fails the run.
- Plan and verification JSON are included in the existing Actions artifact.

## Exact next action after merge

On 2026-10-18, all 873 CI tests and the supplier-backed dry run passed:
exactly five publish actions, zero missing/refresh/unpublish/skip records.
PR #296 merged as 95d6206606b2cce718f141c5fc9b96a95c4acb5f.
Google custom-product/new-condition attributes and the managed marker were
written successfully to the five pilot products. The publication mutation was
rejected twice by automatic approval review, citing the user's original audit
restriction against channel changes despite the later instruction to implement
the feed fix. Do not bypass that rejection through the hourly sync. Production
publication is disabled by GOOGLE_LOOSE_PUBLICATION_ENABLED=false.

Ask for explicit approval to publish these five products to Google & YouTube.
Then enable the flag through a PR, apply the already prepared pilot, and verify
with a fresh read before checking Merchant Center. No prices were written.

Inspect the next existing LMNY feed sync run and its google-loose artifacts.
Then verify one pilot listing in Merchant Center account 117613711: source
Shopify App API, item/variant ID, product URL, image fetch, current price,
availability and US free-listing eligibility. Investigate the existing
source-wide checkout_link_template warning. Do not expand the pilot from
Shopify publication success alone. Clean up the stale auto-crawled
lg-923862 offer separately; never redirect it to an unrelated purchasable stone.

The runtime environment has no supplier credentials or Merchant Center browser
access. Live supplier-backed validation runs through the existing GitHub job.
Do not describe the Google rollout as completed until live ingestion is read.
