# Lab-grown diamonds: collection guide and landing pages (draft for review)

Status: **draft, nothing is live.** Written 2026-10-15 for the merchant to
review. On approval the guide goes into the `lab-grown-diamonds` collection's
`custom.guide_html` and `custom.guide_faq` metafields and renders through the
long-form block from PR #202; the landing pages are new smart collections.

Why: in Search Console (Sep 25 – Oct 12) `/collections/lab-grown-diamonds`
averaged position 23 with 22 impressions, "lab grown diamond rings" sat near
position 63, and lab stone pages barely appeared. The collection page is a
grid with almost no text, so search and answer engines have little to rank or
quote. Every fact below comes from the live catalog (Supabase `stones`,
2026-10-15) or the store's own policy page (`templates/page.shipping-returns.json`).

---

## Part 1. Guide for /collections/lab-grown-diamonds

Shown under the stone grid, page 1 only. About 500 words plus a 7-question FAQ
(about 730 in all). Links point at pages
that exist today.

```html
<p>Every stone in this search is a loose lab-grown diamond with a grading
report, listed with its own photos, its report and its live price. Almost all
are graded by IGI, a few by GIA. Choose a stone here and set it in a ring with
the <a href="/pages/ring-builder">ring builder</a>, or keep it loose.</p>

<h2>What a lab-grown diamond is</h2>
<p>A lab-grown diamond is carbon crystallized in the same structure as a mined
diamond, so it has the same hardness, brilliance and fire. It is grown in a
laboratory rather than taken from the ground. A grading lab can tell the two
apart with specialist equipment; the eye cannot. For a longer comparison, read
<a href="/blogs/journal/lab-grown-vs-natural-diamonds-guide">lab-grown vs
natural diamonds</a>.</p>

<h2>How to read a stone's listing</h2>
<p>Each listing gives the four grades on the report and the measurements:</p>
<ul>
  <li><strong>Cut</strong> decides how much a stone sparkles. On round stones,
  Excellent or Ideal is worth prioritising. Fancy shapes (oval, pear,
  marquise, emerald, radiant) carry polish and symmetry grades instead; look
  for Excellent or Very Good on both.</li>
  <li><strong>Color</strong> runs from D (colorless) down the alphabet. D to F
  reads icy white; G and H read white to most people once set.</li>
  <li><strong>Clarity</strong> describes inclusions. VS1 and VS2 stones are
  usually clean to the eye in brilliant shapes. Step cuts such as emerald and
  Asscher show more through their open facets, so a higher clarity pays off
  there.</li>
  <li><strong>Carat</strong> is weight, not size. Ovals, pears and marquise
  stones spread their weight over a longer outline, so they look larger than a
  round of the same carat. Compare the millimetre measurements as well as the
  carat.</li>
</ul>

<h2>The grading report</h2>
<p>The report number is on every listing, and the report itself opens from the
stone's page. You can check it on the grading lab's own website before you
buy. The differences between the two labs are explained in
<a href="/blogs/journal/igi-vs-gia-certified-lab-diamonds">IGI vs GIA for
lab-grown diamonds</a>.</p>

<h2>Seeing the stone before you decide</h2>
<p>Most stones have a video as well as photos, so you can see how the stone
moves in the light. If you want a second opinion on a particular stone, use
<strong>Ask about this stone</strong> on its page: the question reaches our
team in New York with the stone's details attached, and we reply by email. Not
sure where to start? Use <strong>Not sure which stone?</strong> at the top of
this page and tell us the shape, size and budget you have in mind.</p>

<h2>Shipping, returns and warranty</h2>
<p>Loose diamonds ship free and insured within the United States. An unset
stone in its original condition, with its report, may be returned or exchanged
within 7 days of delivery. Every stone carries a 1-year warranty. Full terms
are on <a href="/pages/shipping-returns">shipping and returns</a>.</p>

<h2>Setting it in a ring</h2>
<p>Pick a stone, then choose a setting in the
<a href="/pages/ring-builder">ring builder</a>, or start with a setting and
come back for the stone. For ideas at different budgets, see
<a href="/blogs/journal/best-lab-grown-diamond-engagement-rings-under-3000">lab-grown
engagement rings under $3,000</a>.</p>
```

### FAQ (`custom.guide_faq`)

```json
[
  {"question": "Are lab-grown diamonds real diamonds?",
   "answer": "Yes. A lab-grown diamond is carbon in the same crystal structure as a mined diamond, with the same hardness and brilliance. Only its origin differs, and the grading report states that it is laboratory-grown."},
  {"question": "Who grades your lab-grown diamonds?",
   "answer": "Almost every stone here is graded by IGI, and a few by GIA. The report number is on each listing and the report opens from the stone's page, so you can check it on the lab's website."},
  {"question": "Can I see the actual stone before buying?",
   "answer": "Each listing shows photos of that stone, and most also have a video. To ask about a specific stone, use Ask about this stone on its page and we reply by email."},
  {"question": "What if the stone isn't right for me?",
   "answer": "An unset loose diamond in its original condition, with its report, may be returned or exchanged within 7 days of delivery. See <a href=\"/pages/shipping-returns\">shipping and returns</a>."},
  {"question": "Can you set the stone in a ring?",
   "answer": "Yes. Choose the stone, then a setting in the <a href=\"/pages/ring-builder\">ring builder</a>. Settings are priced separately."},
  {"question": "Do lab-grown diamonds keep their value?",
   "answer": "Lab-grown diamonds resell for much less than they cost, more so than natural diamonds. Buy one for how it looks and what it costs, not as an investment."},
  {"question": "How is a loose diamond shipped?",
   "answer": "Free and insured within the United States."}
]
```

### Claims for the merchant to confirm before it goes live

1. "Almost all are graded by IGI, a few by GIA." True of the feed on
   2026-10-15: 23,932 of 23,947 available lab stones are IGI or GIA. The other
   15 are GCAL or uncertified; whether any are listed was not checked. If the
   store should list only IGI and GIA stones, that is a feed rule to add.
2. "Every stone carries a 1-year warranty." From the shipping and returns page
   ("Every piece, including loose diamonds, carries a 1-year warranty").
3. "The question reaches our team in New York." The Ask form sends to the store
   inbox; confirm the team answering is in New York.
4. The resale answer (FAQ 6). It is accurate and builds trust, but it is a
   choice to say it. Keep, soften or drop.
5. No prices in the guide on purpose: prices change daily and the dated price
   note already covers comparison.

---

## Part 2. First 8 shape and carat landing pages

Picked by depth of live inventory (available lab stones in the feed,
2026-10-15) among the sizes shoppers most often ask about. There is no
search-volume data yet (Search Console shows almost no lab-grown queries), so
the list can change once the pages start earning impressions.

| # | Page | URL | Stock band (tags) | Stones (feed) |
|---|---|---|---|---:|
| 1 | 2 carat round lab-grown diamonds | `/collections/2-carat-round-lab-grown-diamonds` | `Round` + `2.0-2.5ct` | 1,689 |
| 2 | 1.5 carat round lab-grown diamonds | `/collections/1-5-carat-round-lab-grown-diamonds` | `Round` + `1.5-2.0ct` | 1,391 |
| 3 | 1 carat round lab-grown diamonds | `/collections/1-carat-round-lab-grown-diamonds` | `Round` + `1.0-1.5ct` | 1,214 |
| 4 | 2 carat oval lab-grown diamonds | `/collections/2-carat-oval-lab-grown-diamonds` | `Oval` + `2.0-2.5ct` | 837 |
| 5 | 3 carat round lab-grown diamonds | `/collections/3-carat-round-lab-grown-diamonds` | `Round` + `3.0-3.5ct` | 771 |
| 6 | 1.5 carat oval lab-grown diamonds | `/collections/1-5-carat-oval-lab-grown-diamonds` | `Oval` + `1.5-2.0ct` | 619 |
| 7 | 3 carat oval lab-grown diamonds | `/collections/3-carat-oval-lab-grown-diamonds` | `Oval` + `3.0-3.5ct` | 579 |
| 8 | 3 carat radiant lab-grown diamonds | `/collections/3-carat-radiant-lab-grown-diamonds` | `Radiant` + `3.0-3.5ct` | 449 |

Alternates if you prefer: 2 carat marquise (440), 3 carat cushion (329),
2 carat emerald (smaller stock, but a common engagement choice).

Each page has:

- **Title and h1**, e.g. "2 Carat Oval Lab-Grown Diamonds", and an SEO
  description written from that band's facts.
- **The stone grid pre-filtered** to that shape and band, so a visitor lands on
  matching stones and can still widen the search.
- **About 250 words** specific to the size and shape: how a 2 carat oval
  measures, face-up size against a round of the same weight, what to look for
  in that shape (the bow-tie in ovals, length-to-width ratio), and links to the
  main lab-grown search, the ring builder and the guide above.
- **3–4 FAQs** with FAQPage markup, built the same way as the main guide.

### How it would be built (one theme PR, previewed before merge)

1. Bring PR #202's long-form block up to date with main and make sure it
   renders on the lab-grown search page (the API-driven grid), not only the
   standard collection grid.
2. Let a collection preset the stone search: new collection metafields
   `custom.preset_shape`, `custom.preset_min_carat`, `custom.preset_max_carat`,
   read by the existing filter script when the visitor has not chosen filters.
   The script already accepts the same values from the web address
   (`?shape=Oval&min_carat=2&max_carat=2.5`); this moves them onto the page so
   each landing page has its own clean address.
3. Create the 8 smart collections (product type Lab-Grown Diamond, shape tag,
   carat-band tag) unpublished, assigned to the lab-grown search template, so
   their server-rendered stone list matches the filter.
4. Write the 8 page texts for review, then publish the collections and link
   them from the lab-grown search page ("Popular searches") so crawlers find
   them.

Nothing in this plan touches product titles, descriptions or product SEO
fields.
