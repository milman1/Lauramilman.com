# Jacob & Co. memo listings (20260018395)

Boutique pieces from the 24 Aug 2026 Jacob & Co. memo. Handles are
`jc-<Jacob item number>` so the Belgium Dia feed sync never archives them.
They are **not** tagged `lmny-feed`.

## Status

- **Watches** are **ACTIVE** so they can sell before photos land. They keep
  the `media-missing` tag until photos are attached.
- **Accessories** (charger, bezels) stay **DRAFT**.
- The H-24 already live with photos
  (`jacob-amp-company-limited-edition-five-time-zone-automatic-h-24`) is not
  duplicated as `jc-90712192`.

Do not invent Pre-Owned/Unworn. Condition is merchant **New Vintage**.

## Price

Selling price is **30% off Jacob retail**. Retail stays as compare-at. Memo
Charge is cost only.

```
npx tsx scripts/create-jacob-memo-listings.ts --preview
npx tsx scripts/create-jacob-memo-listings.ts --dry-run
npx tsx scripts/create-jacob-memo-listings.ts
```

Re-running updates existing `jc-*` handles in place and activates any other
Jacob watch still sitting in draft. After photos land, remove `media-missing`.
