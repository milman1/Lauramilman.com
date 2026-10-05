# Photo alt text audit — 2026-10-05

Scope: every product image and video in the store, read in one Shopify bulk
export on 2026-10-05 (30,000+ products, 31,000+ images, all statuses).
Read-only. **Nothing has been written to products.** The fix plan is
`2026-10-05-alt-fix-plan.csv` in this folder and waits for merchant approval.

## Result

| Segment (ACTIVE only) | Products | Images | Media with no alt | Media with stale or old-brand alt | Products with one alt on every image |
|---|---:|---:|---:|---:|---:|
| Loose lab-grown diamonds | 21,154 | 21,154 | 0 | 0 | — |
| Loose natural diamonds | 3,414 | 3,414 | 0 | 0 | — |
| Estate jewelry (feed) | 703 | 3,534 | 0 | 0 | 0 |
| Watches | 186 | 655 | 29 | 0 | 0 |
| House fine jewelry, Peaceful Diamonds, other | 646 | 1,577 | 21 | 231 | 105 |

The feeds are clean: diamonds and estate pieces get their alt from the sync
(title, then "— view 2", "— view 3"). Every problem is in hand-uploaded
products.

**The main finding: product titles were rewritten, but image alt text was
not.** On house pieces, alt text still carries the old titles and the old
vendor name, so the image describes a different product from the page:

| Product | Current alt | Planned alt |
|---|---|---|
| `mens-wedding-band-3` | Men's Wedding Band 3 - Laura Milman New York | Carved Emblem Wedding Band in 14K or 18K Gold by Laura Milman New York |
| `necklace-10` | XO Necklace - Laura's Gems | XO Diamond Necklace in White Gold by Laura Milman New York |
| `mini-gold-dog-tag-pendant-with-diamonds` | Mini Gold Dog Tag Pendant With Diamonds - Laura's Gems | Mini Dog Tag Diamond Pendant in 14K Yellow Gold by Laura Milman New York |
| `arrow-pendant` | Arrow Pendant - Laura Milman New York | Arrow Diamond Pendant in 18K Yellow Gold by Laura Milman New York |

- 87 images on 67 active products still say "Laura's Gems".
- 231 images on 209 products have alt text that no longer matches the title or uses the old vendor name.
- 105 products repeat one alt on every image, so screen readers and image
  search can't tell the views apart.
- 50 images or videos on 30 products (including 9 Jacob & Co. watches) have
  no alt at all.
- 3 watches have alt text over 125 characters (a duplicated title).

Archived and draft products were counted but are not in the plan.

## The fix plan

`2026-10-05-alt-fix-plan.csv`: 608 media rows on 335 active products, one
row per image or video, with `old_alt` and `new_alt`.

Rule, from `AGENTS.md` recipe I step 2.6:

- First image: the current product title. House-brand pieces add
  "by Laura Milman New York" so the alt names the brand.
- Later images: title + "— view N". Videos: title + "— video".
- Capped at 125 characters at a word boundary. "Jacob & Company" is written
  "Jacob & Co.", matching the theme.
- No price, supplier, or keyword stuffing. The alt text comes only from the
  title, which the merchant already approved.

The 29 video rows have no media ID in the export; the apply step reads them
again first.

## To apply (needs merchant approval)

Because it changes product media, this is not run without a yes.

1. Re-read the 335 products and drop any row whose title changed since
   2026-10-05, so a new title never gets an old alt.
2. Apply with `fileUpdate` (alt per media ID) in batches, first 5 products,
   check them on the storefront, then the rest.
3. Re-export and confirm every row equals `new_alt`.

Still open (not alt text): Journal articles have no featured images (0 of
13), so they have no image alt. Collection images `lab-grown-diamond-jewelry`
and `jacob-co` have none. `lab-grown-necklaces` / `lab-grown-earrings` alt
text is just the collection name.
