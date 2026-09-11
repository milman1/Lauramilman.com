# Royal Chain DRAFT intake schema

The generator joins the committed 21-row shortlist to the private merchant cost
CSV by exact item number and URL. It validates the Royal Chain-only `cost × 3`,
round-up-to-$5 rule and emits an idempotent private plan with 21 DRAFT products
and 93 variants. The output directory must be outside the repository because it
contains Cost per item.

Products use vendor `Laura Milman New York`, product type `Necklaces`, and
Shopify category `Apparel & Accessories > Jewelry > Necklaces`. The public
description has a factual overview followed by a Details list for material,
style, width, and every available length. It does not make care, fulfillment,
authentication, packaging, or provenance claims because the intake does not
provide evidence for them.

The intake accepts its original `image_url` plus an optional semicolon- or
pipe-delimited `image_urls` column. Every distinct source image becomes a
Shopify `files` input with descriptive alt text. Shopify imports those source
URLs and serves completed media from its CDN; only the post-import Shopify CDN
URLs are retained by a media verifier. Fewer than three unique images means
the product stays DRAFT and carries `media-missing`.

They never carry `ebay` before a separate activation and channel-publication
review. The private plan's `ebay` object is a readiness record, not a Shopify
`productSet` field and never an instruction to publish. It provides an eBay
title (80 characters or fewer), explicit necklace item specifics, and the
Marketplace Connect metafield mapping. It becomes eligible only when complete
copy, at least three images, and source-backed condition evidence are present.
An optional source `condition` (`new` or `preowned`) is accepted only with a
non-empty `condition_evidence` field; otherwise no condition metafield or eBay
condition ID is emitted. A source-confirmed new item uses eBay `1500` until an
explicit `original_packaging_evidence` fact supports `1000`. Child SKU, exact
gram weight, and explicit availability are required for every eBay-eligible
variant. Variants below 14in become Bracelet products; 14in and above become
Necklace products, so a marketplace listing never mixes those types.
Variants are inventory-tracked with no positive quantity in the plan and use
the deny policy, so a draft cannot be sold. House-brand copy makes no
authentication claim.
Titles, body, SEO, alt, handles, tags, metafields, variants, and eBay fields
are hard-scrubbed of the supplier name and domain, including spacing and
hyphen variants. Cost and retail appear only in the private execution plan;
body, SEO, title, tags, and alt contain neither.

Run from `lmny-feeds` with paths to the public shortlist, private execution CSV,
and an approved private output directory:

```sh
npx tsx scripts/generate-royalchain-product-plan.ts --shortlist=../docs/suppliers/royal-chain-shortlist-2026-09.csv --private=/approved/private/93-royal-chain-costs-2026-09.csv --output-dir=/approved/private/royalchain-product-plan
```

This command writes plan files only. It has no Shopify client and performs no
network or live catalog operation.
