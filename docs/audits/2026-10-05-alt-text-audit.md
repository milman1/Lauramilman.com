# Photo alt text audit — 2026-10-05

Scope: every product image and video in the store, read in one Shopify bulk
export on 2026-10-05 (30,000+ products, 31,000+ images, all statuses).
**Status: applied 2026-10-05 with merchant approval.** 608 images and videos on
335 active products now carry alt text built from their current titles, and a
fresh export confirmed every one (see "Applied" below). The plan is
`2026-10-05-alt-fix-plan.csv` in this folder.

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

## Applied

Approved by the merchant on 2026-10-05 and applied the same day.

1. Re-read every active product first. 13 had been retitled since the
   morning export (for example "Tennis Choker Necklace" became "Diamond
   Tennis Choker Necklace in 14K White Gold"), so their alt was rebuilt from
   the new title, never the old one.
2. Checkpoint: 5 products (9 media, one video) with `fileUpdate`, read back
   on the products, then the rest in batches of about 100. Zero errors.
3. Independent re-export: 608 of 608 rows equal the planned alt. No active
   jewelry or watch image says "Laura's Gems", and none has empty alt.

Feed products (diamonds, estate) were not touched; their sync writes alt.
New hand uploads need alt at upload time; the weekly pulse checks for gaps.

One leftover: two pre-owned Bvlgari and Van Cleef & Arpels watch titles repeat
themselves ("Bvlgari Circa 1990 18K Two Tone Bvlgari Circa 1990 …"), so their
alt does too. Fixing the title fixes the alt.

Still open (not alt text): Journal articles have no featured images (0 of
13), so they have no image alt. Collection images `lab-grown-diamond-jewelry`
and `jacob-co` have none. `lab-grown-necklaces` / `lab-grown-earrings` alt
text is just the collection name.
