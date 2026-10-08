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

## 2026-10-08 — lab-grown price comparison note

Merchant asked to say on the site that loose lab-grown stones are priced
below the big online sellers. Evidence: `docs/seo/2026-10-08-lab-price-comparison.csv`,
round stones on a leading online diamond marketplace's 1, 1.5 and 2 carat
pages (read 2026-10-08, during their "Anniversary Sale"), matched to our live
catalog by carat (±0.06), color and clarity.

- 1 carat: ours 0.74–0.77 of theirs (about 25% lower), 6 matches.
- 1.5 carat: 0.50–0.65 (35–50% lower), 4 matches; 1.1 ct D VVS1 0.41.
- 2 carat: their cheapest listed was $710 (J VS1); 801 of our 1,042 round
  2.00–2.09 ct D–F VS-or-better stones were under $710.
- Natural (2 carat, 21 matches): ours a median 1.11 of theirs. Not claimed.
- Second seller, same day (`marketplace_b` in the CSV), its lab-grown search
  page: 1.51–1.58 ct D–F VS1 IGI rounds at $1,018–$1,063; ours 0.40–0.55 of
  that (45–60% lower), 8 matches. Its natural rounds: ours a median 0.99, 9
  matches. Not claimed.
- Lab-grown tennis bracelets vs a New York lab-grown jeweler (sale prices,
  E–F VS1, 14K): theirs 2 ct $1,950, 5 ct $3,100, 6 ct $3,700; ours 1.92 ct
  $2,500 and 5.8 ct $4,500, so ours are about 25% higher. Not claimed.

The competitor set is recorded in `docs/seo/weekly/README.md`.

The note names no competitor. It renders from the `diamond-filter` section
settings `price_note` and `price_note_until` on the loose lab-grown search
page only, and hides itself after `price_note_until` (set to 2026-11-08), so
the claim has to be re-checked and the date moved before it can stay up.

## Next

- Collection guides are on hold by merchant decision (PR #202 not merged).
