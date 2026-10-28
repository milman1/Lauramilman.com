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

**Wording is for the prices after PR #219** (loose lab-grown × 3 → × 3.5,
every price × 7/6): 1 ct 0.86–0.90 of the first seller (10–15% lower); 1.5 ct
0.58–0.76 of the first and 0.47–0.64 of the second (about 25–50% lower); 463
of 1,042 round 2.00–2.09 ct D–F VS-or-better stones under $710. Merge #219
first. The CSV holds the pre-change prices.

The note names no competitor. It renders from the `diamond-filter` section
settings `price_note` and `price_note_until` on the loose lab-grown search
page only, and hides itself after `price_note_until` (set to 2026-11-08), so
the claim has to be re-checked and the date moved before it can stay up.

## 2026-10-08 — lab-grown stone and setting markups (merchant decision)

Option 1 of the competitor review: loose lab-grown stones × 3 → × 3.5 and
engagement-ring settings × 3 → × 2.25 (`lmny-feeds/config/pricing.ts`). The
lab retail floor scales with it ($216 → $252 at ≥1 ct) so the same invoices
stay held.

Expected effect, from the 2026-10-08 catalog export (19,605 active loose
lab-grown stones): each price rises by one sixth, a median of +$144
(median stone $863 → about $1,007). The hourly feed sync applies it after
merge. Settings are not synced; their 9 products (all variants) are repriced
by hand after merge from Shopify Cost per item:

| Setting | Cost | Now | New |
|---|---:|---:|---:|
| 14K pavé and hidden halo (3 products), 14K variants | $600 | $1,800 | $1,350 |
| Same 3 products, 18K variants (14K + $250) | — | $2,050 | $1,600 |
| Round pavé, 18K white gold (own product, cost $600, priced as 14K + $250) | $600 | $2,050 | $1,600 |
| Oval hidden halo 0.09 ct, 18K | $750 | $2,250 | $1,688 |
| Oval solitaire 18K; oval hidden halo 0.11 ct 18K; oval hidden halo 18K & platinum | $900 | $2,700 | $2,025 |
| Elongated cushion bezel solitaire, 18K | $1,100 | $3,300 | $2,475 |

A 2 ct D–F VS1 lab round in a 14K setting goes from about $2,400 to about
$2,050. The lab-grown search price note (PR #218) must be re-worded to the
post-change ratios before it is merged.

## 2026-10-09 — Ask about this stone (loose lab-grown)

Merchant chose to keep "Reserve this diamond" and "Make an offer" off loose
lab-grown stones (removed 2026-10-05) and to add a plain question form. The
only other way to ask about a lab stone was the Shopify AI chat, which cannot
receive the stone's details.

- Loose lab-grown stone pages (`product.type` Lab-Grown Diamond) show **Ask
  about this stone** in place of the chat "Ask about this piece" pill; Direct
  message stays. It opens a name / email / optional phone / question form that
  posts through Shopify's contact form (`PdpAskForm`), so the question lands in
  the store inbox with `request_type: Stone question`, the stone title, link,
  stock number and listed price.
- It promises no hold and takes no offer. Natural diamonds, watches, vintage
  and jewelry are unchanged. Natural stones keep Make an offer, whose note
  field also reaches the inbox.
- Background found while checking: the old Reserve button wrote requests to the
  `reservations` table and never emailed anyone. Two real natural-stone
  requests (2026-08-30 and 2026-09-12) sat unanswered; they are listed in the
  session notes, not here, because they hold customer contact details.

## Next

- Collection guides are on hold by merchant decision (PR #202 not merged).

## 2026-10-11 — "Not sure which stone?" help line on lab-grown search

- New `snippets/collection-ask-line.liquid`, rendered under the heading of `/collections/lab-grown-diamonds` (both `diamond-filter` header paths, lab only). One line opens a short form (name, email, what are you looking for) through Shopify's contact form; it lands in the store inbox as request type "Stone search help" with the collection link.
- Section setting `show_ask_line` (default on) turns it off without code. No Reserve, no Make an offer.
- Chosen over a button on every tile: 30+ tiles would crowd the grid, and a stone-specific question belongs on the stone page (PR #231), where the certificate and video are.
- Tests added in `theme-pdp-offer.test.ts`; 826/826 pass.

## 2026-10-15 — loose stones: IGI and GIA only (merchant decision)

Merchant: every stone the store lists carries an IGI or GIA report. A check of
the live store found 7 of 19,710 lab-grown stones (4 GCAL, 3 uncertified, the
latter titled "UNCERTIFIED Certified") and 1 of 3,575 natural stones outside
that rule.

- `config/pricing.ts` `STONE_GATES.allowedLabs = ['IGI','GIA']`;
  `src/normalize.ts` `passesLabGate` holds any other lab as
  `lab_not_igi_gia` for both lab-grown and natural feeds, before cost is read.
- On the next live sync those stones are held: archived in Shopify (a held
  stone keeps its URL; it is not deleted) and marked unavailable in Supabase so
  they leave the lab-grown search too. To undo, remove the lab from the gate
  or add it to `allowedLabs`; the next sync reactivates them.
- Natural: HRD is also held (no HRD stones were checked beyond the single live
  one). Add `'HRD'` to `allowedLabs` if HRD-graded stones should be sold.
- Stones outside the rule also in the Supabase table (about 15 lab, 6 natural)
  are marked unavailable by the same sync.
- Guide copy can now say "every stone is graded by IGI or GIA".

## 2026-10-15 — lab-grown guide and 12 shape and size landing pages (merchant approved)

Merchant approved the guide wording, the 12 pages and "all twelve together".
Content: `docs/seo/landing/lab-grown-landing-pages.json` (page text) and
`docs/seo/drafts/2026-10-15-lab-grown-guide-and-landing-pages.md` (the guide,
PR #276). Facts come from the live catalog (Supabase `stones`) and the
shipping and returns page; no prices, no supplier names, no hype words.

**Store writes (Admin API), all invisible until the theme PR merges and, for
the collections, until published:**

- 3 collection metafield definitions: `custom.preset_shape`,
  `custom.preset_min_carat`, `custom.preset_max_carat`.
- 12 smart collections, **unpublished** (0 sales channels), template
  `diamonds-lab`, sorted by price low to high. Rules: product type
  Lab-Grown Diamond + shape tag + carat-band tag. Stone counts read back on
  creation equal the catalog: 2 ct round 1,689; 1.5 ct round 1,391; 1 ct round
  1,214; 2 ct oval 837; 3 ct round 771; 1.5 ct oval 619; 3 ct oval 579;
  3 ct radiant 449; 4 ct round 221; 4 ct oval 352; 5+ ct round 441; 5+ ct oval 340.
  Each has an SEO title (≤ 60) and description (≤ 160), a short description,
  the preset metafields, and a guide plus three FAQs.
- 4 ct = 4.00–4.49 and 5+ = everything from 5.00 up, because stone tags are
  half-carat bands (`4.0-4.5ct`) with one open band (`5.0ct+`).
- `lab-grown-diamonds`: `custom.guide_html` and `custom.guide_faq` set (the
  guide above). Undo any of this by deleting the collections or metafields.

**Theme (PR):** the guide block renders on the lab-grown search page and the
landing pages only (the four guides stored on 2026-10-05 for David Webb,
Cartier, Rolex and natural diamonds stay hidden, as decided then). A collection
with a preset opens the stone search on its shape and size; a link that carries
its own filters wins. Landing pages show their own title and description.
"Popular lab-grown searches" links show only for collections that exist and
have stones.

**Publish order:** merge the IGI and GIA feed rule and let one sync run (the
copy says every stone is graded by IGI or GIA), merge the theme PR, then
publish the 12 collections to the Online Store.

### 2026-10-15 (later) — copy aligned with the 2026-10-13 tile changes

Main had changed since the guide was written (PR #271, 2026-10-13): the lab
search "Not sure which stone?" line and price note were removed, and lab,
colored and natural tiles gained Reserve. "Ask about this stone" on each stone's
page is unchanged. The guide on `lab-grown-diamonds` and the guide text of all
12 landing pages (store metafields `custom.guide_html` and the JSON file) no
longer point to the removed line; they now say "Questions about a stone? Use
Ask about this stone on its page and we will reply by email."

## 2026-10-15: colored-stone sync stuck on its withdrawal limit

- Every scheduled colored sync since Oct 12 stopped at the plan stage: 634 live colored stones, 569 eligible in the supplier feed, so 65+ would move to draft against a limit of 63 (10% of live).
- Failures now print the counts. A full preview (`review-withdrawals`) lists each stone that would move to draft with its title and reason. `sync-with-withdrawals` takes a reviewed maximum (1-500) for one manual run; hourly runs keep the 10% limit. Withdrawn stones become drafts, not deletions.

## 2026-10-18: loose-stone inquiries — natural stones get the ask form; Google Shopping shortlist

- Why no loose-stone inquiries: the stone pages get almost no real visitors.
  Google sent 19 sessions to stone pages in 45 days (216 a month to the whole
  site). URL inspection: a natural stone listed since 2026-07-28 is "unknown
  to Google", another is "crawled, not indexed", the 2 ct oval landing page is
  "discovered, not indexed"; only `lab-grown-diamonds` and `natural-diamonds`
  are indexed. 6,886 of 20,325 active lab stones were created in the last 30
  days. Loose stones are not on Google & YouTube (channel policy). One
  loose-stone order since June, so the late-September price change is not
  what moved inquiries.
- Natural stones (`product.type` Natural Diamond) lost their only form when
  Make an offer became watch-only on 2026-10-13 (#271), leaving the AI chat,
  which cannot receive the stone. They now get the same **Ask about this
  stone** form as lab stones (`snippets/product-inquiry.liquid`). No offer, no
  hold.
- Proposal, not applied: `docs/seo/2026-10-18-google-shopping-lab-shortlist.csv`
  lists 240 lab stones (the 10 lowest-priced per shape and size: Round, Oval,
  Emerald, Pear, Cushion, Radiant at 1.5, 2, 2.5 and 3 ct; D–G, VS2 or
  better, IGI, photo and video, Excellent or Ideal cut for rounds), all
  ACTIVE with the Shopify price matching the stones table on 2026-10-18.
  Publishing them to Google & YouTube reverses the channel policy in
  `lmny-feeds/config/channels.ts` and needs a merchant decision. Stones sell
  out, so the list must be refreshed from the stones table before use.

## 2026-10-22 (evening, New York) — six new Journal articles published

Merchant asked for more relevant articles, released that night. Published
directly on blog `journal` (not as `journal-draft`), author Laura Milman New
York, SEO title and description set, featured image from a linked product.
Each body passed `checkDraft` from `lmny-feeds/scripts/journal-draft.ts`
(prices, supplier names, celebrity claims, HTML allow-list, SEO lengths,
900–1,400 words, three FAQs). Its only remaining flags were links to other
live journal articles, which it counts as external, and the `Rolex` tag that
the live Rolex article already uses. All 18 linked products were ACTIVE and on
the Online Store, and all 25 linked collections were published, on
2026-10-22. Verified afterwards: all six are on the live `/blogs/journal` index,
and SEO fields and images were read back from the Admin API.

| Handle | Topic | Why |
|---|---|---|
| `lab-grown-tennis-bracelet-total-carat-weight` | Total vs per-stone carat weight, with real stone counts | Plan P12 |
| `pre-owned-cartier-love-bracelet-size-condition` | Love bracelet sizing, screws, condition | Plan P12; 303 Cartier pieces |
| `rolex-datejust-buying-guide-reference-numbers` | Reading Datejust references, sizes, metals | Largest watch inventory |
| `engagement-ring-diamond-shapes-guide` | Nine shapes, settings, ring builder | Settings and diamond pairing |
| `fancy-color-diamonds-grading-guide` | Fancy color grades and modifiers, natural vs lab | New colored lab-grown catalog |
| `holiday-jewelry-gift-guide-2026` | Gifts by recipient, sizing, policy timing | Holiday season |

Policy lines used: free insured shipping, 14-day returns on unworn jewelry and
loose diamonds, watch exchanges within 7 days, one complimentary resizing on
house rings, complimentary engraving on engagement rings, the "Not sure" ring
size option, and lab-grown savings of 60–85%. No prices.

Not done: Search Console query data could not be read for topic selection
(the agent proxy rejects the URL-encoded site path). The two job drafts from
the drafting workflow (Bulgari Pink, Sotheby's Italy sapphire necklace) are
still unpublished and were not reviewed.

## 2026-10-22 (late evening, New York) — seven pop-culture Journal articles published

Merchant asked for pop-culture articles (the editorial direction in recipe F),
released that night. Five new articles, plus the two job drafts, reviewed and
published. New articles passed `checkDraft`; the only remaining flags were
links to other live journal articles. Every linked product was ACTIVE and on
the Online Store and every linked collection was published (the pearl,
sapphire, emerald and ruby collections are not, so they are not linked).
Sources were read for each news hook. No article claims a celebrity owns or
wore a piece we sell.

| Handle | Hook | Source checked |
|---|---|---|
| `emmys-2026-red-carpet-jewelry-trends` | 2026 Emmys red carpet jewelry | Glam, Oct 1 2026 |
| `brooch-trend-2026-how-to-wear-a-brooch` | Flower-brooch revival, Olivia Rodrigo at a Liberty game | Harper's Bazaar, Oct 10 2026 |
| `knicks-championship-ring-2026` | Knicks ring unveiled at MSG | INSTORE, Oct 22 2026 |
| `watches-worn-as-jewelry-2026` | Tyla's Chopard ankle watch at the VMAs | INSTORE, Sep 29 2026 |
| `art-basel-miami-beach-2026-what-jewelry-to-wear` | Art Basel Miami Beach, Dec 4–6 | artbasel.com |
| `the-1965-sapphire-ribbon-necklace-at-sothebys-italy-...` (job draft) | Sotheby's Milan, Oct 28 | Rapaport |
| `the-bulgari-pink-and-what-makes-a-pink-diamond-rare` (job draft) | Christie's Geneva, Nov 10 | Christie's press release, JCK |

Job drafts: `journal-draft` tag removed, SEO titles given the "| Laura Milman"
suffix, featured images added. The Bulgari opening now states the confirmed
grade (24.00 ct Fancy Intense Pink, emerald cut, set by Bulgari in the 1950s)
and links the fancy color guide.

Time-sensitive: the Sotheby's piece is about an Oct 28 sale and the Bulgari
piece about a Nov 10 sale. Both read as previews and will need a results line
after those dates.

## 2026-10-23 (early morning, New York) — six audience articles, and photos in every article

Merchant asked for more articles for the core customer (women buying for
themselves, engagement and bridal, men buying for her) and fewer on watches,
then asked for photos. Six new articles published; all 19 articles from
2026-10-22 and 2026-10-23 (including the two auction pieces) now carry in-article product photos.

| Handle | Audience |
|---|---|
| `right-hand-ring-buying-diamonds-for-yourself` | Women buying for themselves |
| `milestone-jewelry-what-to-buy-yourself` | Women buying for themselves |
| `proposal-season-engagement-ring-timeline` | Engagement (December is the most popular month to propose, The Knot) |
| `how-to-match-a-wedding-band-to-an-engagement-ring` | Bridal |
| `how-to-buy-jewelry-for-her-a-guide-for-men` | Men buying for her |
| `anniversary-jewelry-gifts-by-year` | Gifting |

**Photos.** Each article has a featured image plus 2 or 3 product photos in
the body (`<img>` inside a link to the product, `width=900`, `loading="lazy"`,
descriptive alt text). All images are the products' own Shopify CDN photos,
chosen from products the article links to; no generated images. Eight articles
also gained a product link or two so every article reaches at least two photos.
Applied with `articleUpdate` on the published articles; nothing else changed.
The holiday gift guide's closing line and two other small wording fixes made at
publish time are in the live copies (for example, the guide no longer calls the
first-gold-piece edit "solid").

Notes for next time:
- `lmny-feeds/scripts/journal-draft.ts` allows no `<img>` in a body
  (`ALLOWED_HTML_TAGS`) and rejects any `src`. The weekly job therefore
  cannot produce in-body photos. Changing that is a code change for a pull
  request, not done here.
- Pearl, sapphire, emerald and ruby collections are not on the Online Store,
  so they are not linked.
- Several estate products exist twice (a `bv-` handle and a plain one) with the
  same title. Not changed.

## 2026-10-28: guides and FAQs on Cartier and David Webb

- Merchant approved showing the stored `custom.guide_html` and `custom.guide_faq` on Cartier and David Webb (reverses the 2026-10-05 "not now" for these two only). `sections/main-collection.liquid` renders `collection-longform` for those two handles; Rolex and every other collection stay as they were. The block shows under the product grid on page 1 only and adds FAQPage markup built from the visible FAQ. Both guides say 14-day returns (aligned 2026-10-26).
