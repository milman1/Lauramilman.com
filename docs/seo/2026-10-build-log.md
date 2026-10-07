# October SEO build log

Every live store write for the October SEO work, with how it was verified
and how to undo it. Product titles, descriptions and SEO fields are out of
scope (the merchant rewrote them separately; do not touch).

## 2026-10-05 — journal articles, collections, redirects

### Journal articles (13 of 13)

Backup of every article body before the change: Shopify bulk export
`articles-backup-2026-10-05.jsonl` (session scratchpad; the full bodies are
also in Shopify's article history). Verified after the write with a second
bulk export: every changed body matches the intended text byte for byte,
and every SEO field reads back as written. Publish status unchanged (9
published, 4 drafts).

**Contradictions with store policy, fixed.** Published articles promised
things the store doesn't offer. Store policy (`templates/page.shipping-returns.json`):
7-day returns on unworn jewelry, watches exchange only within 7 days,
1-year warranty, one complimentary resizing on most rings.

| Article | Was | Now |
|---|---|---|
| Lab-grown engagement rings under $3,000 | "returns run a full 30 days", "30-day money-back return policy", "lifetime service", "not a dropshipper" | 7-day returns on unworn jewelry, one complimentary resizing on most rings, 1-year warranty, "a written return policy" |
| How to buy pre-owned Cartier, Van Cleef & Tiffany | "30-day return", "lifetime service" (×2) | 7 days to return unworn, 1-year warranty |
| How to buy a vintage luxury watch | "30-day return", "lifetime service" (×2) | exchange within 7 days, 1-year warranty |
| How to wear vintage jewelry in 2026 | "backed by lifetime service" | 1-year warranty |
| How to stack diamond jewelry | "covered by lifetime service" | 1-year warranty |
| Best jewelry for a night out in NYC | "Lifetime service aside, …" | removed |

**Broken links, fixed** (in the article body where it was edited, and by a
redirect so old links and other sites still land):

| Dead link | Fixed to |
|---|---|
| `/collections/watches`, `/collections/vintage-watches` | `/collections/time-pieces` |
| `/collections/audemars-piguet` | `/collections/audemars-piguet-watches` |
| `/blogs/news/how-to-buy-pre-owned-cartier-van-cleef-tiffany` | `/blogs/journal/…` (same handle) |
| `/blogs/news/how-to-wear-vintage-jewelry-in-2026` | `/blogs/journal/…` |
| `/blogs/news/how-to-buy-a-vintage-luxury-watch` | `/blogs/journal/…` |
| `/blogs/news/lab-grown-diamonds-vs-natural-diamonds-2026` (never existed) | `/blogs/journal/are-lab-grown-diamonds-real-diamonds` |

Seven URL redirects were created for the rows above. To undo, delete them in
Online Store → Navigation → URL redirects. Links to `/collections/earrings` and
other `/blogs/news/…` paths that already redirect were repointed to the
final URL where the body was being edited anyway.

**SEO title and description on all 13 articles** (none had one; Shopify was
falling back to the title and an excerpt). Titles end "| Laura Milman" and
stay ≤ 60 characters; descriptions ≤ 160, written from each article's own
content. The engagement-ring article's summary also dropped "stunning".

**Left alone, needs the merchant:**

- "crafted in Italy" closes five lab-grown articles. The September 27 audit
  asks whether that is true for every piece it is attached to.
- Lab-grown savings are given as "40–60%" in four articles and "60 to 85
  percent" in the unpublished comparison draft. Pick one current number.
- "Every Laura Milman New York ring includes an IGI or GIA report with a
  laser-inscribed girdle number" (engagement-ring article) and "every
  timepiece is examined and authenticated before listing" (vintage-watch
  article). Confirm both; `AGENTS.md` keeps the hand-inspected line off feed
  watches until confirmed.
- The four drafts (gold chains, lab vs natural, David Webb, Rolex box and
  papers) are ready to publish once reviewed. Publishing is the merchant's
  call. The David Webb draft says each piece is "examined in person";
  confirm before publishing.
- No article has a featured image.

### Collections: SEO descriptions (34)

`global.description_tag` written with `metafieldsSet`; SEO titles untouched.
Verified with a bulk export: 34 of 34 match.

- 17 house and category collections (chokers, stackable rings, necklaces,
  bangles, trendy rings, bracelets, pendants, wedding bands, men's wedding
  bands ×2, men's rings, stud / drop / chandelier / huggie / hoop earrings,
  chains): dropped the "Authenticated by Laura Milman New York." filler (Sept
  27 audit §2 item 9). Each now ends with the real policy: "Free insured
  shipping and 7-day returns."
- 17 designer estate collections (David Webb, Hermès, Chopard, Bvlgari,
  Verdura, Seaman Schepps, Graff, Buccellati, Boucheron, Marina B, Angela
  Cummings, Harry Winston, Aletto Brothers, Chanel, Ilias Lalaounis,
  Chaumet, Asprey): replaced "authenticated and hand-inspected in New York.
  Authenticated by Laura Milman New York." (the claim twice) with "Pre-owned
  {Brand} jewelry, each listed with its signature, metal, measurements and
  condition. Authenticated by Laura Milman New York."

Before and after for all 34: `docs/seo/2026-10-05-collection-seo-descriptions.csv`.

### Collections: long-form guides (first batch of 4)

New metafield definitions on collections (editable in the collection admin
screen): `custom.guide_html` (multi-line text, HTML) and `custom.guide_faq`
(JSON list of `{question, answer}`).

Written for `david-webb`, `cartier`, `rolex-watches`, `natural-diamonds`:
about 200 words of buying guidance plus four FAQs each, from store policy and
the facts the listings already show. Verified: 8 of 8 fields read back equal.

**Not visible yet.** They render only after the theme PR that adds
`snippets/collection-longform.liquid` is merged and deployed. Until then
these fields do nothing on the storefront.

## 2026-10-05 (later) — merchant decisions applied

Merchant answers to the open questions:

1. Alt text fix: **approved and applied.** 608 media on 335 products,
   verified 608/608. Details in `docs/audits/2026-10-05-alt-text-audit.md`.
2. Collection guide theme PR: **not now.** The PR stays unmerged and no
   further guides get written. The four stored guides stay invisible.
3. Claims: **confirmed** by the merchant: "crafted in Italy", certificates on
   rings, and every watch and estate piece examined before listing. The
   articles keep that wording. Still inconsistent: lab-grown savings are
   "40–60%" in four published articles and "60 to 85 percent" in the
   lab vs natural guide. Resolved 2026-10-06, see below.
4. Journal drafts: **published** 2026-10-05 12:43 UTC: Rolex box and papers,
   David Webb authentication, gold chain guide, lab-grown vs natural
   diamonds. All links checked first. The redirect
   `/blogs/news/lab-grown-diamonds-vs-natural-diamonds-2026` now points at the
   new lab vs natural guide instead of the "are lab-grown diamonds real" article.

## 2026-10-06 — lab-grown savings figure

The merchant picked **60–85%**. The four articles that said "40–60%" (are
lab-grown diamonds real, night out NYC, engagement rings under $3,000, how to
stack) now say "60–85%", verified by a fresh read. Two of them also linked to
the deleted `lab-grown-jewelry` collection; those links now point at
`/collections/lab-grown-diamond-jewelry`. The product-page lab-grown block
(`sections/product-education.liquid`, `templates/product.json`) changed the
same way in PR #208.

These records were split out of theme PR #202 so they could land on `main`.
PR #202 keeps only the unmerged theme code (the collection guide block and
the Hermès meta description fix).

## 2026-10-07 — gemstone and gift collections, header links

Prompted by the J.R. Dunn comparison. Six new smart collections were created
**unpublished** (no sales channel) so they stay off the storefront until the
merchant approves the header PR; then they are published and the PR merged
together.

| Handle | Rule (all must match) | Products at creation |
|---|---|---:|
| `emerald-jewelry` | title contains "emerald", not "emerald diamond" / "emerald cut" / "emerald-cut" / "lab grown emerald" / "lab-grown emerald" / "emerald lab"; type not Watch, Natural Diamond, Lab-Grown Diamond | 64 |
| `ruby-jewelry` | title contains "rub" (catches ruby and rubies), not "rubber"; same type exclusions | 69 |
| `sapphire-jewelry` | title contains "sapphire"; same type exclusions | 65 |
| `pearl-jewelry` | title contains "pearl" (includes mother-of-pearl); same type exclusions | 52 |
| `gifts-under-1000` | a variant under $1,000 with inventory > 0; type not Watch or loose diamond; title not "wedding", "engagement", "extender" | 101 |
| `gifts-under-2500` | same, under $2,500 | 257 |

Counts include drafts and archived pieces, which the storefront hides.
Emerald-cut diamonds are excluded by title so the emerald page shows only
green emeralds.

Engagement rings by style (solitaire, halo, three-stone) were **not** made:
about 21 active engagement rings split into 1–5 per style, which would be thin
pages.

Header PR: a "By gemstone" group replaces "Start here" in the Pre-Owned
dropdown (estate authentication stays). "Gifts" was added to the top row, and
both gift pages to the phone menu. A new header setting, `contact_phone`, is
blank by default; when it is filled, the number shows as a `tel:` link next to
Book an Appointment and in the phone menu. Book an Appointment was already in
the top row and the announcement bar on every device.

## Next

- Collection guides are on hold by merchant decision (PR #202 not merged).
