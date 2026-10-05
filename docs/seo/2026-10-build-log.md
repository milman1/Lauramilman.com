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

## Next

- Merchant review of the four guides on a preview theme, then the next
  batch: `time-pieces`, `engagement-rings`, `estate-jewelry`, `tiffany`,
  `van-cleef-arpels`, `lab-grown-diamonds`, `chains`, `rings`.
- Alt text fix plan: `docs/audits/2026-10-05-alt-text-audit.md`, waiting
  for approval.
