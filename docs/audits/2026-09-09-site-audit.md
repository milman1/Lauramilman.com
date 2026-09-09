# Site audit — 2026-09-09

Scope: every active product (10,000+ loose diamonds sampled at 400, all
534 fine and lab-grown pieces, all 732 estate pieces, all 173 watches),
all 53 collections, all 13 pages, the Journal, the live storefront's
technical SEO, and the sales channels. Data files live in the session
scratchpad; the numbers below are from them.

Read this top to bottom: the first section is what to fix and in what
order, the rest is the evidence.

## 1. Fix list, in priority order

| # | Fix | Why it matters | Effort | Owner tier |
|---|---|---|---|---|
| 1 | **Brand collections** (done today): 12 automated vendor collections created, Tiffany links repointed. | 442 David Webb pieces had no collection page; the Pre-Owned Maison dropdown linked to 404s. | Done | Orchestrator |
| 2 | **Fine jewelry SEO titles and descriptions**: 283 of 534 (53%) have no SEO title or description; 138 titles exceed 60 characters. | Half the house catalog ships with Shopify's default `<title>` and no meta description. | Worker (Sonnet 5) writes per `docs/seo-title-formulas.md`; Opus 5 spot-checks 5% | Build + Worker |
| 3 | **Blank product type on 142 fine pieces; 23 competing type spellings** (Ring/Rings, Earring/Earrings, Necklace/Necklaces). 97 have no Shopify category. | Product type drives collections, filters, Google Shopping category, and eBay category mapping. | Classifier (Haiku 4.5) proposes a type from title; one bulk update | Classifier + Worker |
| 4 | **Vendor cleanup**: "Laura's Gems" (79) and "Milman New York" (29) are the same house as "Laura Milman New York" (266). | Splits brand signals across three vendors; the homepage review schema even names "Laura's Gems". | One bulk update | Worker |
| 5 | **PDP gallery alt text**: 7 to 11 gallery images per PDP have no alt; 58 fine pieces have at least one image with no alt; 304 fine pieces have a single image. | Image search and accessibility; the collection grid already has good alt copy, the PDP template does not apply it. | Theme fix in the product gallery snippet + alt backfill | Build |
| 6 | **Collections**: 47 of 53 have no SEO description, 46 have no image, 34 have under 100 characters of copy. | Collection pages are the category landing pages; they currently have nothing for a search engine or an AI agent to summarize. | Opus 5 writes 53 descriptions and SEO fields; images picked from best-selling product | Build |
| 7 | **BreadcrumbList schema** on collections, blog, and pages (PDPs already have it); **FAQPage** schema on the buying guides and Private Clients page. | Rich results for category and guide pages; AI answer engines lean on FAQ markup. | Theme snippet | Build |
| 8 | **Homepage review schema** names "Laura's Gems" with a corrupted address (injected by the SociableKit Google Reviews widget). | Wrong business name in structured data risks rich-result rejection and confuses AI agents about who the store is. | Replace the widget's schema with a theme-owned `LocalBusiness` block, or disable the widget's JSON-LD | Build |
| 9 | **Watches**: 35 SEO titles over 60 characters, 24 descriptions over 160, 69 bodies under 150 characters, 47 duplicate titles. | Duplicates compete with each other; short bodies give little to index. | Adjust `watchListingBuilder` limits and add reference/dial to titles | Build |
| 10 | **Estate era metafield** empty on 537 of 732; 20 pieces have one photo. | Era is a filter and a search term ("Art Deco Cartier"); the supplier rarely states it. | Haiku 4.5 infers era from title/body where safe, else leave blank | Classifier |
| 11 | **Empty pages**: `about`, `shop`, `google-reviews` have no body. | Thin pages indexed with nothing on them. | Write or unpublish | Build |
| 12 | **Old draft duplicates**: 221 draft estate pieces from the first CSV import still exist alongside the `bv-` copies. | Not indexed, but they clutter admin and eBay category mapping. | Archive once the eBay listing is confirmed working | Worker |

Loose diamonds need nothing structural: titles, SEO fields, descriptions,
category, and images are fully templated and complete across the 400
sampled. Their only gap is one image per stone, which is a supplier
limit.

## 2. Evidence

### Fine and lab-grown jewelry (534 active, not feed, not watch)

| Check | Count |
|---|---|
| Empty SEO title / description | 283 / 283 |
| SEO title over 60 chars | 138 |
| Body under 150 chars / empty | 132 / 24 |
| Single image / zero images | 304 / 1 |
| At least one image without alt | 58 |
| Blank product type | 142 |
| No Shopify category | 97 |
| No `custom.*` metafields at all | 205 |
| No SKU | 327 |
| Duplicate titles | 18 |
| Vendors | Laura Milman New York 266, Peaceful Diamonds 102, Laura's Gems 79, Milman New York 29, Cartier 27, Tiffany & Co. 11, Jacob & Co 9, Chopard 5, others 6 |

### Estate (732) and watches (173)

| Check | Estate | Watches |
|---|---|---|
| Empty SEO title / description | 0 / 0 | 0 / 0 |
| SEO title over 60 / description over 160 | 0 / 0 | 35 / 24 |
| Body under 150 chars | 8 | 69 |
| Single image | 20 | 17 |
| Images without alt | 0 | 0 |
| Empty metal type | 5 | 144 (watches use `metal`) |
| Empty era | 537 | n/a |
| Duplicate titles | 4 | 47 |

### Loose diamonds (400 sampled of ~10,000)

Fully templated: `{carat}ct {Shape} {Natural|Lab-Grown} Diamond — {Color}
{Clarity}, {Lab} Certified`, SEO title and description generated, category
set, five `custom.*` spec keys, one image each. No gaps found.

### Collections (53) and pages (13)

- 47 collections with no SEO description, 46 with no image, 34 with under
  100 characters of copy, 1 with zero products
  (`for-shopify-performance-tracking`, a Faire artifact).
- Before today only 11 of the 40 designer collections in
  `SHOPIFY_SETUP.md` existed. Missing: David Webb (442 pieces), Graff,
  Buccellati, Boucheron, Marina B, Angela Cummings, Harry Winston, Aletto
  Brothers, Chanel, Ilias Lalaounis, Chaumet, Asprey. All 12 were created
  as automated vendor collections. Tiffany links pointed at `tiffany-co`;
  the live collection is `tiffany`.
- Pages: all 13 published; `about`, `shop`, `google-reviews` have empty
  bodies.

### Storefront technical SEO (live crawl)

- `robots.txt` standard; sitemap index of 25 children, about 21,800
  product URLs; `llms.txt` present and describes the store's agentic
  commerce endpoints (`/.well-known/ucp`, `/api/ucp/mcp`,
  `sitemap_agentic_discovery.xml`). This store is ahead of most on
  AI-agent discoverability.
- JSON-LD: Product + BreadcrumbList on PDPs with all core offer fields;
  CollectionPage on collections with no breadcrumb; Article on blog
  posts with no breadcrumb or FAQ; homepage AggregateRating names the
  wrong business.
- One sampled fine-jewelry PDP has null SKU, empty category, empty
  description and meta description: the same data gaps as section 2.
- No `hreflang` (fine for a US-only store), no `noindex` anywhere.

## 3. Journal

Findings: nine articles, all published, all rendering on the storefront,
the latest on 2026-08-26. No drafts waiting. Nothing in this repository
writes articles, and no schedule exists. The n8n connector configured
for this workspace could not connect from this session, so if a writer
lives there it could not be checked.

Requested direction: pop culture, nightlife in top cities, current
events, celebrity news, always tied back to watches and jewelry.

Proposed pipeline (recipe F in `AGENTS.md`):

1. **Weekly GitHub Actions job** (Monday 09:00 New York) that gathers the
   week's hooks with web search: red carpet and premiere jewelry, watch
   sightings on athletes and musicians, auction results, brand launches,
   and the top nightlife openings in New York, Miami, Los Angeles, and
   Las Vegas. Sonnet 5 shortlists ten, the job writes them to
   `out/journal-hooks.md`.
2. **Two drafts per week**, written by Opus 5 in the existing Journal
   voice (see the nine live articles), 900 to 1,400 words, each linking
   to at least three live products or collections by handle, with a
   FAQ block of three questions. Written to Shopify as **unpublished
   articles** in the `journal` blog with tags from the existing set
   (Buying Guide, Style, Watches, Estate & Signed Jewelry, ...), SEO title
   and description filled, and a featured image chosen from the linked
   products.
3. **A person publishes.** The job never publishes. Drafts older than 21
   days are deleted by the next run so the queue does not rot.
4. **Guardrails**: no claims about a celebrity owning a specific piece
   we sell; no supplier names; no prices in the copy (they change);
   every product link checked live before the draft is saved.
5. **Needs from you**: an `ANTHROPIC_API_KEY` repository secret (the job
   calls the API from Actions), and a yes on the two-per-week cadence.

## 4. Royal Chain (basic chains)

- 901 basic chains in the category: 14K gold 492, silver 181, 10K gold
  162, 18K gold 28, vermeil 22, platinum 6. Styles: diamond-cut 142, box
  98, cable 90, cuban 62, rope 60, curb 45, figaro 41, then wheat, snake,
  Singapore, paperclip and 25 smaller styles.
- **Prices need a trade login.** Every listing and product page shows
  "Please Login To View Price"; only the live gold and silver market
  basis is public.
- **No popularity signal exists** on the site for basic chains: no
  best-seller sort (the Magento parameter is ignored), no badges, and
  the homepage "Best Selling Chains" tile links to a different category.
- Model routing: Sonnet 5 through Firecrawl scraped everything public.
  Astra is only needed if you want prices pulled from behind the trade
  login, which means giving an Astra session your Royal Chain
  credentials in a browser, never in a chat.

Decision needed before anything is created in Shopify:
1. How to pick "most popular": your own sales history, the mainstream
   styles (cable, rope, box, curb, figaro, cuban in 14K at 1.1 to 3 mm),
   or a list you give me.
2. Pricing: cost from your trade account times a multiplier, or a
   per-gram formula from the public market basis.
3. How many to add (a first batch of 40 to 60 across styles and lengths
   is a sensible start), and whether they list on eBay.

## 5. Back Vault pricing check against Robinson's Jewelers

Robinson's public catalog was read in full through Firecrawl: 20,000
products across 80 pages of `/products.json` (the catalog continues past
that). Vendors are Olas d'Oro, Royal Jewelry, Robinson's own line,
Covaloro, Afarin, and an "Estate" vendor of 1,130 unsigned house pieces.
Exactly four rows mention Cartier, Van Cleef, or Tiffany, and none carry
a Back Vault stock number in any field. Result: zero matches, every piece
priced at cost + $500. The sync re-checks weekly and switches a piece to
the midpoint rule the moment its stock number appears on their site.

## 6. Sales channels

See the channel matrix appended by the channel audit when it completes;
recommendations follow it.
