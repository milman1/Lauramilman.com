# Royal Chain DRAFT intake schema

The generator joins the committed 21-row shortlist to the private merchant cost
CSV by exact item number and URL. It validates the Royal Chain-only `cost × 3`,
round-up-to-$5 rule and emits an idempotent private plan with 21 DRAFT products
and 93 variants. The output directory must be outside the repository because it
contains Cost per item.

Products use vendor `Laura Milman New York`, product type `Necklaces`, Shopify
category `Apparel & Accessories > Jewelry > Necklaces`, and one supplier image.
They remain DRAFT and carry `media-missing` because the intake has fewer than
three real images. They never carry `ebay` before human media/content review.
Titles, body, SEO, alt, handles, tags, and metafields are scrubbed of the
supplier name. Cost and retail appear only in the private execution plan; body,
SEO, title, tags, and alt contain neither.

Run from `lmny-feeds` with paths to the public shortlist, private execution CSV,
and an approved private output directory:

```sh
npx tsx scripts/generate-royalchain-product-plan.ts --shortlist=../docs/suppliers/royal-chain-shortlist-2026-09.csv --private=/approved/private/93-royal-chain-costs-2026-09.csv --output-dir=/approved/private/royalchain-product-plan
```

This command writes plan files only. It has no Shopify client and performs no
network or live catalog operation.
