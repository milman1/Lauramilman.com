# AI search visibility: baseline, question panel, monthly check

Started 2026-11-01. Triggered by a customer who asked ChatGPT for "the most
affordable lab grown diamonds, D color, VVS2, ideal cut, 6-7 carats". We stock
matching stones (round, Ideal, D VVS2, IGI: 6.01, 6.05 x2, 6.29, 7.02, 7.03 ct
at the time of writing) but had no page built to be found for that question.

Nobody can guarantee placement in an AI answer. This file is how we tell
whether the work is helping.

## Baseline (Shopify analytics, 2026-08-03 to 2026-11-01)

- 19,789 sessions in total. Referrer `chatgpt`: 82 sessions (0.4%). For scale:
  Google search 556, Bing 53, Instagram 73.
- ChatGPT visitors land directly on individual stone pages (`/products/lg-...`
  lab-grown, `/products/nd-...` natural), not on collections or Journal
  articles. Product-level markup is therefore the page type that matters most.
- `robots.txt` has no AI-crawler rules (only `*` and `adsbot-google`), so
  crawlers are not blocked. `llms.txt` is Shopify's generic agent text and has
  no store-specific content; it is not a ranking factor.

## Queries to track (ask each monthly in ChatGPT, Perplexity, Google AI Mode)

1. Where can I get the most affordable lab grown diamonds, D color, VVS2, ideal cut, 6-7 carats?
2. How much bigger is a 7 carat lab-grown diamond than a 6 carat?
3. Is D color VVS2 worth it for a lab-grown diamond?
4. Where to compromise on color and clarity for a 6 carat lab-grown diamond?
5. How to buy a large lab-grown diamond online safely?
6. Best place to buy a 5 carat lab-grown oval diamond online
7. Lab-grown diamond engagement ring, 6 carat, IGI certified
8. How much does a 6 carat round lab-grown diamond measure in mm?
9. Vintage Cartier or David Webb jewelry, where to buy pre-owned in New York
10. How do I read hallmarks on vintage jewelry?
11. Best place to buy a 14K gold herringbone bracelet online
12. What is a good gold bracelet gift for her?
13. 14K gold Cuban link bracelet, 5mm, where to buy
14. Paperclip chain vs herringbone chain, which is better?
15. Is a semi-solid gold chain worth it?

Gold questions 11-15 added 2026-11-08 with the six 14K chain style pages
(`/collections/14k-gold-*-chains`) and the gold bracelet gift guide. Watch for
those URLs as landing pages and citations.

Record per query and engine: is lauramilman.com cited or linked (yes/no), which
URL, and which competitors appear. Keep results in `docs/seo/weekly/` or a dated
section below.

## Numbers to pull each month

```
FROM sessions SHOW sessions GROUP BY referrer_source, referrer_name
SINCE -30d UNTIL today ORDER BY sessions DESC LIMIT 25

FROM sessions SHOW sessions GROUP BY landing_page_path
WHERE referrer_name = 'chatgpt' SINCE -30d UNTIL today ORDER BY sessions DESC LIMIT 15
```

Watch: `chatgpt` sessions against the 82-per-90-days baseline, and whether the new
guides below appear as landing pages.

## Technical finding: big diamond collections ship no stones in the HTML

`sections/diamond-filter.liquid` runs in `api_mode` on the large loose-diamond
collections (for example `/collections/5-carat-and-up-round-lab-grown-diamonds`).
In that mode the page loads its stones with JavaScript (`diamond-query.js`) and
renders no `ItemList` JSON-LD (`include_products: false`). A crawler that does
not run JavaScript sees zero stones and no prices on those pages. Product pages
are fine: they carry Product JSON-LD with price, availability, shipping,
IGI report number and every grade.

Proposed fix (needs a theme PR and a preview check, not done): in `api_mode`,
server-render the first 24 to 48 stones as a plain linked list (carat, shape,
color, clarity, cut, report lab, price) and emit `ItemList` JSON-LD for them.

## Content shipped for this

Four buying guides, created 2026-11-01 and published 2026-11-02 (they link to
each other; each has FAQPage markup via `custom.guide_faq`):

- affordable-6-carat-lab-grown-diamond-where-to-compromise
- 6-carat-vs-7-carat-lab-grown-diamond-size-guide
- d-color-vvs2-ideal-cut-lab-grown-diamond-what-it-means
- how-to-buy-a-large-lab-grown-diamond-online

Measurements in the size guide come from our own IGI-graded round stones
(6 ct about 11.6 to 11.9 mm, 7 ct about 12.3 to 12.4 mm, 5 ct about 10.9 to
11.2 mm). Recheck them when inventory changes a lot. The guides state no prices;
they use the approved "60-85% less" line and point to live collections.

## Off-site presence (needs the merchant; nothing posted from here)

AI answers lean on pages other sites cite. Worth doing by hand: genuine answers
in lab-grown diamond communities (r/Diamonds and similar) that link a relevant
guide only where it helps, a short YouTube walkthrough of a 6 ct stone video,
and review profiles kept current. Do not post under a false identity or
mass-post links.
