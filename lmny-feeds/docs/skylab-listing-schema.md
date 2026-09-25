# Skylab bridal listing schema

Merchant decisions 2026-09-18: retail is **cost × 3**, nearest dollar
(`config/pricing.ts` `SKYLAB`). Most complete engagement rings in this book
are lab-grown **and labeled that way on the supplier site**. Copy origin from
that listing per SKU. A natural listing stays natural. Never invent lab or
natural. Never print the supplier name on the store.

## Product shape

| Kind | What the customer buys | Storefront |
|---|---|---|
| Complete engagement ring | Finished ring, center stone already set | `/collections/engagement-rings` |
| Setting | Mount priced without a center stone | `/collections/ring-settings` once those SKUs exist |

A complete ring is not a mix-and-match SKU. Pairing a natural loose diamond
with a mount is a separate builder path; it uses Belgium Dia stone pricing
plus this mount’s Skylab price, not a swap on the finished-ring product.

## Pricing

- Cost = invoice / trade-account wholesale, written to Cost per item.
- Retail = `round(cost × 3)` via `skylabRetailFromCost`.
- No cost → skip. Never infer cost. Never use Royal Chain round-up-to-$5 or
  Peaceful Diamonds ×4.
- Vendor on the product = `Laura Milman New York`.

## Copy

- Title / SEO: `lmny-feeds/docs/seo-title-formulas.md` (Skylab section).
- Prefix `Lab Grown` only when the source listing says lab-grown.
- Tag `lab-grown` the same way, only from that fact.
- Specs from the source record into `custom.*` metafields. Empty if unknown.
- Scrub `skylab` / `sky lab` / `sky-lab` from title, body, handle, tags, SEO,
  alt, and metafields (`src/skylab/scrub.ts`).
