# Issue #114 — API watch source facts in listing copy

- Issue: https://github.com/milman1/Lauramilman.com/issues/114
- Status: implementation in review; no live catalog write
- Scope: the TypeScript watch builder, product/sync review gate, diff hold
  protection, schema documentation, and tests

The builder now presents API case size, source-supplied year, and bracelet-link
count with clear labels. It suppresses year sentinels, normalizes millimeters,
and treats zero, blank, fractional, or invalid link counts as `Not specified`.
Condition remains controlled by the strict structured-source gate. Product and
SEO titles keep the full reference and use an 80-character hard maximum; no
search-ranking result is promised.

When the full identity is long, only model words are removed from the end of
the title. The full model stays in the description and metafields. If the
condition, brand, complete reference, and one whole model word cannot fit, that
single watch is held for review and any existing listing remains unchanged;
valid watches in the same sync continue normally.

Illustrative outputs from source-shaped fixtures (not live listings):

1. Known size/year, `Links=-2`: `Case size: 41mm`; `Year: 2014`;
   `Bracelet links: 2 bracelet links missing`.
2. Known size/year, `Links=1`: `Case size: 40mm`; `Year: February 2016`;
   `Bracelet links: 1 additional bracelet link included`.
3. `Links=0`, missing year and size: `Case size: Not specified`;
   `Year: Not specified`; `Bracelet links: Not specified`.

Full illustrative copy from fixture 1:

- Product title: `Pre-Owned Rolex Submariner Date 126610LN 41mm 2014`
- SEO title: `Rolex Submariner Date 126610LN Pre-Owned 41mm 2014 Watch`
- SEO description: `Shop this pre-owned Rolex Submariner Date 126610LN with 41mm case, year 2014, 2 bracelet links missing. Authenticated by Laura Milman New York.`

No bulk publish or direct Shopify mutation is part of this change, and the live
catalog has not been rewritten or verified by this task. The source API is
currently unavailable. Once it recovers, the next eligible successful normal
sync can use the new builder; this change introduces no separate rollout gate.
Pull-request runs remain dry-run. Watch title/description/SEO output participates
in the existing content hash, so no global schema-version bump is needed.

## Work log

- 2026-09-11: implemented the source-fact copy, whole-word title fitting, and
  per-row review hold. The full suite passes (50 files, 641 tests). TypeScript
  reports only the pre-existing `test/theme-chat-opener.test.ts:106` mock
  signature error.
- 2026-09-11: independent Sol review passed the final builder/product/diff
  behavior and focused suite (105 tests).
- 2026-09-11: independent Terra fallback verification (Claude unavailable)
  found zero mismatches across all three illustrative fixtures and passed the
  same 105 focused tests.
- Live catalog writes: none. API verification remains blocked while the source
  endpoint is unavailable.
