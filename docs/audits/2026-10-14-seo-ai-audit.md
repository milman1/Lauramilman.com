# SEO and AI-search audit — 2026-10-14

Read-only pass over the live site: homepage, a loose lab-grown stone page
(`/products/lg-100747288540`), `/collections/lab-grown-diamonds`, a Journal
article (`lab-grown-vs-natural-diamonds-guide`), `/sitemap.xml`, `/robots.txt`,
`/llms.txt`, Admin API SEO fields, and the feed sync in `lmny-feeds/`.

Not checked, because the data is not connected: Google indexing and rankings
(Search Console), Bing, real-user speed (Core Web Vitals), and what ChatGPT or
Claude say about the store.

## What works

- `robots.txt` allows all crawlers, including AI crawlers; the sitemap index
  covers products, collections, pages, blogs and articles.
- Canonical tags are correct on every page checked.
- Stone pages carry `Product` JSON-LD with price, availability, free US
  shipping, and shape, carat, color, clarity, grading lab, polish, symmetry,
  fluorescence and measurements, plus `BreadcrumbList`.
- Site-wide `OnlineStore` JSON-LD has the 1185 6th Avenue address, the 7-day
  `MerchantReturnPolicy`, email and social profiles.
- Sold loose stones are deleted and redirected to their collection by the
  feed sync (`lmny-feeds/src/sync.ts`); 718 redirects exist, so old links,
  including links from AI answers, land on live inventory.
- 13 of 13 articles have SEO titles and descriptions.

## Findings (most important first)

| # | Finding | Fix | Who |
|---|---|---|---|
| 1 | No Bing verification tag on the site. ChatGPT search draws on Bing's index. | Verify in Bing Webmaster Tools (DNS or meta tag), submit `/sitemap.xml`. | Merchant |
| 2 | 20,087 of 25,160 live products are templated lab-grown stone pages (about 1,000 words, mostly shared), all indexable, deleted on sale. | Decide with Search Console's Pages report; keep stones but steer ranking to collection and shape pages. | Decision, after Search Console |
| 3 | Collection guides (long-form copy and FAQ under the grid) are built but unmerged (decision 2026-10-05: not now). | Merge when ready. | Merchant |
| 4 | Homepage h1 was "Your diamond. Your story.", which says nothing about what or where. | **Done 2026-10-14** (theme PR): the eyebrow "New York fine jeweler · Lab-grown diamonds & rings" is the h1; the display line is unchanged visually. | — |
| 5 | 9 published pages had no SEO title or description, `shipping-returns` had no title, and 4 customer-facing collections had neither. | **Done 2026-10-14** (Admin API; see build log). | — |
| 6 | Articles credit an Organization, not a named person; article FAQ sections have no `FAQPage` markup. | Add a named author with true credentials and FAQ markup. | Needs author facts |
| 7 | Store markup: logo is the favicon; no telephone; typed `OnlineStore` although there is a Manhattan address. | Add phone (open in PR #217), a proper logo, and `JewelryStore` with hours if clients visit by appointment. | Needs phone and hours |
| 8 | `/llms.txt` and `/agents.md` are Shopify's default: shopping-protocol text only, nothing on what the store sells or where. | Check whether Shopify allows editing; otherwise a plain facts page linked from the footer. | Later |
| 9 | Stone description template writes "...with IGI certified." when a stone has no report number (`lmny-feeds/src/product.ts`, `certification`), and no report number is shown. | Fix the sentence; show the report number when the feed has it. Changes product descriptions, so merchant's call. | Merchant decision |
| 10 | Lab-grown and natural collections had an empty description (empty in `CollectionPage` JSON-LD) and thin meta descriptions. | **Done 2026-10-14** for both descriptions and the lab-grown SEO title and description. | — |
| 11 | Homepage "In stock today" stone images load from the supplier's host (`dnalinks.in`) with `alt=""` (5 images). | Give them alt text from the stone name; consider Shopify-hosted images. | Theme |
| 12 | 3 old URLs in 4 articles work only through redirects. | Repoint to final addresses. | Low |
| 13 | Pages are heavy: 585–760 KB of HTML and about 64 scripts each. | Run PageSpeed Insights on the homepage and a stone page. | Merchant |
| 14 | 6 gemstone and gift collections are unpublished, waiting on PR #217. | Publish with #217. | Merchant |

## Claims to check (found during the audit)

- Homepage: "Every stone certified by IGI or GIA." The feed's `stones` table
  on 2026-10-14 also held 13 uncertified and 8 GCAL lab-grown stones and 5
  uncertified natural ones; whether any of those are live on the store was not
  checked. New copy written today avoids the claim.
- Care guide page: "complimentary annual inspection for the life of the
  piece." Store policy is a 1-year warranty; confirm this service is offered
  as written.
