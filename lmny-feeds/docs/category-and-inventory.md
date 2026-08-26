# Category + unique inventory (qty 1)

Shopify Admin **Category** (the taxonomy field under Media) and **Inventory
quantity** for unique pieces. Drafts and archived products are never
activated or restocked.

## Category map

GIDs are Shopify Standard Product Taxonomy nodes
(`gid://shopify/TaxonomyCategory/…`).

| Product | Category | GID |
|---|---|---|
| Loose diamonds (`Natural Diamond`, `Lab-Grown Diamond`, handles `nd-*` / `lg-*`) | Jewelry in Apparel & Accessories | `aa-6` |
| API / estate watches (`Watch`, handles `w-*`) | Watches in Jewelry | `aa-6-11` |
| Rings | Rings in Jewelry | `aa-6-9` |
| Bracelets | Bracelets in Jewelry | `aa-6-3` |
| Necklaces | Necklaces in Jewelry | `aa-6-8` |
| Earrings | Earrings in Jewelry | `aa-6-6` |
| Pendants | Pendants in Charms & Pendants | `aa-6-5-1` |
| Brooches | Brooches | `aa-6-4-1` |
| Cufflinks | Cufflinks in Clothing Accessories | `aa-2-10` |
| Other jewelry | Jewelry | `aa-6` |

Loose diamonds use the Jewelry parent: Shopify has no GIA/IGI diamond leaf.
Craft “Loose Stones” is bead-and-cabochon material, not inventory stones.

## Quantity

Every **active** unique item is tracked at **qty 1** with inventory policy
`DENY` (cannot sell past zero).

- Untracked items (today’s API default — infinite stock) become tracked qty 1.
- Tracked qty 0 is treated as sold and left alone.
- Feed `productSet` writes category + qty 1 on create/update when the app has
  `write_inventory` and a location.
- Manual products are covered by the backfill, not by the Belgium Dia sync.

Does **not** change archive / draft / publication / reactivation behavior.

## How it is applied

**API diamonds and watches** — next live LMNY feed sync after this schema
version (`PRODUCT_SCHEMA_VERSION` 14). Hourly at `:17` when
`LMNY_SYNC_LIVE=true`, or Actions → **LMNY feed sync** with Dry run unticked.

**API / Back Vault jewelry** — next live Back Vault sync (`PRODUCT_SCHEMA_VERSION` 4).

**Every currently active product, including manual Admin items** — run the
backfill:

1. GitHub → Actions → **Category + qty backfill**
2. Run workflow, **untick** Dry run
3. Needs `write_products` + `write_inventory` on the Shopify app

```
npx tsx scripts/backfill-category-inventory.ts --dry-run
npx tsx scripts/backfill-category-inventory.ts
```

Optional: `SHOPIFY_LOCATION_ID` (numeric id or GID) if the store has more
than one location.
