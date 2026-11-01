# Gold and vintage jewelry: SEO and AEO audit — 2026-10-26

Read-only audit of the gold jewelry and the vintage / pre-owned signed jewelry
sections. Sources: Shopify Admin API (read-only), ShopifyQL (28 days; session
counts include bots), live pages via Firecrawl (server HTML, no JavaScript),
Search Console URL Inspection (read-only service account) and a handful of
web searches to see who ranks for buyer questions. Nothing in the store was
changed. Rendered JSON-LD was not validated with Google's Rich Results test;
schema findings come from the live theme source.

## Site-wide

1. **Return window conflict.** Since 2026-10-21 (#328) the theme, product
   schema (`merchantReturnDays: 14`), header, popup and product pages say 14
   days. The Shopify refund policy (updated 2026-09-27), the descriptions of
   `chains`, `chain-bracelets`, `chain-necklaces`, `gifts-under-1000` and
   several designer collections, the Cartier and David Webb FAQ metafields and
   two Journal articles still say 7 days. Google's snippet for
   `/collections/cartier` shows "7-day returns". Merchant to confirm which is
   right; then align everything.
2. **Collection guides and FAQs do not render on jewelry collections.**
   `sections/main-collection.liquid` renders `collection-guide` (one reading
   link) but not `collection-longform`. Cartier and David Webb already have
   `custom.guide_html` and `custom.guide_faq`; they stay hidden by the
   merchant's 2026-10-05 decision ("not now").
3. **No FAQPage markup** on any gold or vintage collection or on the three
   relevant Journal articles, although the articles show FAQ sections. Article
   author is the Organization, not a person.
4. **Thin, templated copy.** Most gold collections have 9–50 words; 9 of 14
   designer meta descriptions share one template; Graff, Buccellati and Harry
   Winston have identical bodies.

## Gold jewelry

| Collection | Google | Copy words | Sessions 28d | Main issues |
|---|---|---:|---:|---|
| gold-jewelry | Unknown | 36 | 3 | Thin; no buyer answers; logo as og:image |
| gold-chains | Discovered, not indexed | 19 | 2 | Duplicates chains / chain-necklaces; says "16 to 24 inches" (a Cuban chain comes in 26) |
| gold-bracelets | Unknown | 16 | 2 | Overlaps chain-bracelets |
| gold-rings | Discovered, not indexed | 9 | 0 | Thinnest; 7 products; meta description 93 chars |
| first-gold-piece | Unknown | 23 | 0 | Linked only from gold chips |
| chains | Unknown | 50 | 7 | Meta says "yellow, white, and rose" (no white gold chain); says 7-day returns |
| chain-bracelets | Indexed (10-22) | 34 | 6 | Says 7 days; rule pulls in a 3-inch extender |
| chain-necklaces | Indexed (09-28) | 36 | 3 | Says 7 days; competes with gold-chains |
| gold-plated-silver | Discovered, not indexed | 20 | 0 | No internal links |
| work-essentials | Unknown | 39 | 0 | No internal links; title 72 chars |
| gifts-under-1000 | Not published (404) | 30 | 0 | 112 products; says 7-day returns |
| Article: gold chain guide | Indexed (10-20) | ~1,180 | 5 | No FAQPage; hollow-chain sentence needs a jeweler's check; no box chain; no product links |

Other findings: five chain collections list nearly the same products under
near-identical titles (Google indexed only the two narrow ones); breadcrumbs
are flat (no Gold Jewelry or Chains parent; products always "All Jewelry");
no gold collection has an image. Product content for the merchant: chain
pages do not say "solid" or give a weight, which ranking competitors do.

## Vintage and pre-owned

| Collection | Google | Copy words | Sessions 28d | Main issues |
|---|---|---:|---:|---|
| vintage-jewelry | Indexed (09-29) | 31 | 24 | Rule pulls in 4 watches; image is a watch |
| estate-jewelry | Indexed (10-24) | 44 | 5 | Hub with little copy |
| cartier | Indexed (10-19) | 58 | 27 | Guide hidden; no link to the Love bracelet article |
| van-cleef-arpels | Indexed (10-14) | 55 | 16 | Copy overlaps Tiffany |
| tiffany | Indexed (10-22) | 50 | 26 | Says 7 days |
| david-webb | **Crawled, not indexed** (09-09) | 55 | 0 | 434 products; guide hidden; no link to the David Webb article |
| bvlgari | Indexed (10-21) | 11 | 24 | h1 is the bare brand name |
| hermes | Indexed (10-09) | 32 | 26 | Overlaps Chopard; live meta differs from Admin |
| chopard | Indexed (10-05) | 49 | 15 | h1 bare brand |
| verdura | Indexed (10-14) | 12 | 0 | 1 product, a watch; copy names pieces not in stock |
| seaman-schepps | Indexed (08-13) | 13 | 0 | 1 product; image is an archived product |
| graff / buccellati / harry-winston | Stale 404 / soft 404 in Search Console; live 200 | 13–14 | 0 | Identical copy |
| /pages/authentication | Stale 404 (06-12); live 200 | ~180 | 19 | No FAQ; "authenticity documentation" claim unconfirmed since 2026-09-27 |
| Article: David Webb authentication | Unknown to Google | ~800 | 3 | No inbound link from the David Webb collection |

Product schema on sampled pre-owned pieces is correct (`UsedCondition`).
No "independent jeweler / not an authorized dealer" statement exists on any
page; 9 designer h1s are the bare brand name. AI-answer check: the store
ranked #8 for "pre-owned Cartier jewelry authenticated New York" and did not
appear for Cartier Love authentication, pre-owned Van Cleef Alhambra NYC, or
David Webb authenticity (the supplier ranks #2 there). Product content for
the merchant: vintage SEO titles are cut mid-word.

## Proposed fixes (merchant approves by number)

1. Confirm 7 or 14 days; align policy, collection copy, FAQs, articles, theme
   and schema.
2. Request indexing (owner step): David Webb, the David Webb article, Graff,
   Harry Winston, Buccellati, Authentication and the gold collections.
3. Render `collection-longform` on jewelry collections (reverses the
   2026-10-05 "not now").
4. Internal links: David Webb and Estate to the David Webb article; Cartier
   to the Love bracelet article; gold and chain collections to the gold chain
   guide; Work Essentials and Gold-Plated Silver in the gold chip row.
   **Done in this PR.**
5. "Pre-Owned" h1 and breadcrumb on 8 designer collections, plus one
   independence sentence (wording for merchant approval).
6. Unique copy for Graff, Buccellati, Harry Winston, Bvlgari, Hermès, Chopard;
   fix Verdura and Seaman Schepps; fix the three gold errors.
7. Guides and FAQs for Gold Jewelry, Chains, Chain Necklaces, Chain Bracelets
   and Gold Rings (needs 3).
8. Make `/collections/chains` the chain hub; redirect gold-chains to
   chain-necklaces.
9. Collection images for gold and chain collections; replace the Seaman
   Schepps and Verdura images.
10. FAQPage markup and a named author on the three articles; correct the
    hollow-chain sentence; add box chain.
