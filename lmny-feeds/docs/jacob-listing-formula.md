# Jacob & Co. listing formula

Boutique pieces from the 24 Aug 2026 Jacob & Co. memo, rewritten to the same
watch listing schema used for the rest of the timepiece catalog. Canonical
rules live in `docs/watch-listing-schema.md` (Boutique / New Vintage) and
`docs/seo-title-formulas.md`. This file is the Jacob operational checklist.

## What this does

1. **Rewrite the eight photographed PDPs in place** (`/collections/jacob-co`).
   Handles, photos, and merchant prices stay. Titles, descriptions, SEO, tags,
   and `custom.*` specs become the listing formula. `media-missing` is not
   added. Google Shopping `condition` is omitted (New Vintage is not Unworn
   or Pre-Owned).
2. **Activate remaining Jacob watches** that are not already live. Today that
   is Epic I Q2B as `jc-90814519` (ACTIVE, `media-missing` until photos land).
   Any other Jacob watch still sitting in draft is published too.
3. **Do not duplicate** live handles as `jc-*`. Diamond bezels stay on the two
   combo listings; they are not created as standalone products. The Ghost USB
   charger stays DRAFT.

Vendor on the product is **`Jacob & Co`** (no period) so they stay in
`/collections/jacob-co`. Titles and SEO use **`Jacob & Co.`**

Do not invent Pre-Owned/Unworn. Condition is merchant **New Vintage**.
Live prices set after photos are **not** overwritten.

## Run

This environment cannot write to Shopify Admin. After merge, run the
**Jacob listing formula** workflow with Dry run unticked.

```
npx tsx scripts/apply-jacob-listing-formula.ts --preview
npx tsx scripts/apply-jacob-listing-formula.ts --dry-run
npx tsx scripts/apply-jacob-listing-formula.ts
```
