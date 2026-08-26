# Jacob & Co. memo listings (20260018395)

Ten boutique pieces from the 24 Aug 2026 Jacob & Co. memo. Descriptions only —
no photos — so every product is **DRAFT** with the `media-missing` tag until
photos are attached and the product is activated.

Handles are `jc-<Jacob item number>` so the Belgium Dia feed sync never
archives them. They are **not** tagged `lmny-feed`.

## Condition — New Vintage

These are merchant-classified **New Vintage**, not API `Pre-Owned` / `Unworn`.
The feed condition map is left unchanged. Titles follow the watch schema
shape with that stated title word:

- Product title: `New Vintage {brand} {model} {reference}`
- SEO title (≤ 60): `{brand} {model} {reference} – New Vintage Watch`
- SEO description (≤ 160): `Shop this new vintage {identity}. Authenticated by Laura Milman New York.`
- Specs in `custom.*` metafields, not an HTML table. No price in the body.
- Google Shopping `condition` is omitted (only `new`/`used` are mapped for Unworn/Pre-Owned).
- Box/papers omitted because the memo does not state them.

## Price

Selling price is **30% off Jacob retail** (the highest price on the memo).
Jacob retail stays as compare-at so the markdown is visible. Memo Charge is
cost only (`inventoryItem.cost`), not the storefront price.

```
npx tsx scripts/create-jacob-memo-listings.ts --preview
npx tsx scripts/create-jacob-memo-listings.ts --dry-run
npx tsx scripts/create-jacob-memo-listings.ts
```

Re-running updates existing `jc-*` handles in place. After photos land, remove
`media-missing` and set status to Active in Admin.
