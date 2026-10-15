# Loose-diamond SEO repair and audit — 2026-10-15 UTC

Owner: Codex. Issue: [#280](https://github.com/milman1/Lauramilman.com/issues/280).
Implementation: [PR #281](https://github.com/milman1/Lauramilman.com/pull/281), merged as `95368822072beeddad8991c6adfec5273df417c9`.
Status: theme repairs deployed and independently verified; first landing page published. Remaining sitemap, legacy-inventory and private-account checks are listed below. This is not a claim that Google has indexed or approved any listing.

## Confirmed before / after

| Check | Before | After |
|---|---|---|
| `/collections/lab-grown-diamonds?shape=Oval` | Crawlable cards included 2.0ct Round, 1.55ct Pear and other non-oval stones | No unrelated fallback cards or ItemList; browser API applies Oval |
| `?min_carat=2&max_carat=3` | Same unfiltered collection, including 1.55ct and 6.2ct stones | No unrelated fallback cards or ItemList |
| Combined oval/carat URL | Unfiltered fallback | Correct API request; 12 sampled responses all Oval and 2.00–2.49 ct |
| 2 carat oval landing | Existing unpublished collection returned HTTP 404; assigned unrestricted API template | HTTP 200; native server-rendered inventory, 24 matching stones checked on first page |
| Sample Product/Offer markup | Three samples already met tested core data requirements | All three still pass, with Shopify price/availability parity |

Machine-readable evidence: [before.json](diamond-seo-2026-10-15/before.json), [after.json](diamond-seo-2026-10-15/after.json).
The after audit adds an API/Shopify consistency check to the nine baseline checks.

## Cause and repairs

`sections/diamond-filter.liquid` originally rendered `collection.products` and an ItemList without applying the custom query parameters. Shopify does not apply `shape`, `min_carat` or `max_carat` to that Liquid collection. After load, `assets/diamond-storefront.js` reads those URL parameters, selects the form controls, and sends `shapes`, `min_carat`, and `max_carat` to the Supabase diamonds function. That function filters `kind`, `available=true`, exact shape membership and inclusive numeric bounds before pagination. The initial HTML therefore described a different inventory set from the JavaScript results.

API search now starts with an honest loading state, without unfiltered cards, counts or ItemList. A no-JavaScript message points shoppers toward native collection links. API search still requires JavaScript; it is not server-side filtering. The dedicated SEO collection supplies crawlable inventory.

Further repairs:
- New filter requests supersede older requests; stale responses cannot overwrite the latest selection.
- URL hydration accepts singular, plural and the existing Shopify shape parameter. Page and sort survive reloads; unrelated attribution/preview parameters are preserved.
- Prices retain cents. API values are explicitly USD, rather than being mislabeled with the cart's presentment currency.
- Cart lookup no longer falls back to an unavailable variant. Shopify cart/checkout endpoints and valid-product purchase behavior are retained.
- Diamond PDPs no longer invent “Independently certified” when the lab is absent. The certification badge requires IGI or GIA. Structured properties omit the UNCERTIFIED sentinel.
- No pricing rule, product price, handle, supplier image, sync implementation, channel policy or checkout endpoint was changed.

## Landing page

[2 Carat Oval Lab-Grown Diamonds](https://www.lauramilman.com/collections/2-carat-oval-lab-grown-diamonds)

Repaired existing collection `350222221383`; no duplicate products were created. Its existing size definition is **2.00–2.49 ct**, stated plainly in the copy. This does not mean only exactly 2.00 ct or the entire 2.00–2.99 ct band.

All four automated rules must match:
- Type: Lab-Grown Diamond
- Tag: Oval
- Tag: 2.0-2.5ct
- Tag: lmny-feed

The sync already maintains these tags, prices and product availability. The new `collection.diamond-seo.json` template uses the existing main-collection layout, Shopify pagination and original product cards/images. This avoids an independent inventory copy or additional sync job. Existing published, Online Store-visible products populate the page; this work activated no products.

The title, description, rules and template were independently read back after the update. The collection was published only to the Online Store after the template deployed. Its public page showed 518 products during verification. All 24 first-page product schemas were independently read and matched Oval and the specified carat band.

The page has a self-canonical, one meaningful H1, unique copy and no noindex directive. Page 2 has its own paginated canonical and Page 2 title. A sort URL canonicalizes to the clean landing URL. Diamond search links to the landing, and the landing links back to broader oval search and the buying guide. Mobile (390px) and desktop (1440px) checks found 24 cards and no document overflow; screenshots were inspected.

Only this first shape/carat landing was published. The reusable native template supports subsequent combinations, but no additional combination pages are claimed as delivered.

## Product / Offer validation

Checked against [Google's merchant-listing documentation](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing), using actual fetched JSON-LD and Shopify product JSON:

| Handle / SKU | Price at check | Currency | Availability |
|---|---:|---|---|
| lg-416419 / 416419 | 637.00 | USD | InStock |
| lg-929885 / 929885 | 505.00 | USD | InStock |
| lg-100742831311 / 100742831311 | 665.00 | USD | InStock |

Each had a single Product entity, name, real SKU, reachable image, canonical product URL, Offer URL, positive current price, USD currency and availability matching Shopify. Specifications include shape, carat, color, clarity and available report details. No review or aggregateRating was added. Existing shipping markup was preserved; no loose-stone returns policy, delivery deadline or certificate was invented.

Three API oval prices/availability states also matched Shopify: SKUs 100742831311, 100752861398 and 100756474140, at USD 665, 672 and 675. These are timestamped samples, not guarantees that every supplier row is synchronized.

This is a programmatic core-property and consistency validation, **not** a Google Rich Results Test result, Search Console validation or Merchant Center approval. Account-level shipping/returns policies and delivery-time recommendations still require account inspection.

## Crawl, canonical, redirects and sitemap

- robots.txt and sitemap.xml returned HTTP 200. The wildcard robots rules allow public product/collection routes. Sort and combined-filter crawl traps and private checkout/account exclusions remain unchanged.
- Googlebot and OAI-SearchBot user-agent probes received HTTP 200 for robots, sitemap, the oval URL and a representative PDP, with no blocking X-Robots-Tag. This does not verify requests from real crawler IPs or private bot-management logs.
- Custom filter URLs canonicalize to the broad lab-grown collection. No new query-parameter landing pages were introduced.
- HTTP and non-www product URLs resolved to the HTTPS www product URL.
- The sitemap index links product, collection, page, article and agentic-discovery sitemaps.
- **Outstanding:** the fetched collection sitemap still did not include the newly published landing at the final check. Shopify generates this sitemap; no fake entry or replacement sitemap was deployed. Recheck the root index and all returned collection sitemap URLs after propagation, then inspect the landing in Search Console. Public crawlability/internal links are verified; sitemap inclusion and actual indexing are not.

## Google Merchant Center and ChatGPT discovery

The repository deliberately publishes loose diamonds to Online Store and Shop, excluding Google & YouTube. This policy was preserved. Independent Admin reads of the three representative stones confirmed Online Store and Shop publication and **no Google & YouTube publication**; Microsoft Copilot and Meta AI and Muse also appeared in their resource-publication records.

Consequently, the loose-diamond work must not be reported as an active or approved Google Shopping feed. The existing `googleShopping.ts` helper supplies channel attributes for other catalog categories and explicitly excludes loose stones.

[Shopify Catalog documentation](https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts/products) distinguishes Catalog eligibility and ChatGPT access from ordinary crawler access. The sampled title, description, price, image, SKU and availability data are present. Shop/Copilot publication does not prove ChatGPT Catalog eligibility, opt-in, mapping or discovery.

Private-account checks still required:
1. Google & YouTube: linked Merchant Center account, sync status, target country/language, excluded-product settings and product approval diagnostics.
2. Merchant Center: data-source last processing time, item-level errors/warnings, destination eligibility, price/availability mismatches, identifier mapping, shipping and returns setup. For any intended loose-diamond feed, approve a curated inclusion policy first; do not override current channel policy ad hoc.
3. Search Console: URL Inspection for the landing and sampled PDPs; selected canonical, rendered HTML, indexing status, submitted sitemap and Merchant Listings enhancement report.
4. Google Rich Results Test: run the three representative PDP URLs and retain actual test outputs.
5. Shopify Admin → Agentic → Sources → Shopify Catalog: eligibility, product count and eligibility reasons; ChatGPT Catalog access setting.
6. Shopify Catalog Mapping: shape, numeric carat, origin, color, clarity, report details, category, stock and price mapping; inspect a representative SKU in the actual Catalog.
7. Real crawler logs and end-to-end supplier freshness/availability receipts. No private Google or ChatGPT account diagnosis is claimed.

## Legacy inventory requiring follow-up

An Admin query independently found eight active loose stones outside the existing IGI/GIA-only rule:
- UNCERTIFIED: lg-100757298468a, lg-l60223b, lg-907767, nd-ws351446a.
- GCAL: lg-730997, lg-730998, lg-732250, lg-402231.

The four UNCERTIFIED product titles still contain “UNCERTIFIED Certified”; lg-907767 was reconfirmed publicly. Existing main commit b0bd424 / PR #277 adds a normalization gate to exclude non-IGI/GIA stones on a subsequent live sync. **That live cleanup has not been verified.** This task did not trigger a broad supplier sync or independently archive products while leaving the API inventory stale. Verify the next live gate reconciliation in both Shopify and Supabase, including removal of misleading legacy titles from public results. The new landing copy makes no blanket certification assertion.

## Tests and reproducibility

- `cd lmny-feeds && npm test -- --reporter=dot`: **847/847 pass**.
- `cd lmny-feeds && node checks/diamond-search-browser.mjs`: **18/18 assertions pass**, production JavaScript against controlled inventory, 390px and 1440px. Covers URL shape/carat hydration, cents, unavailable variant protection, request races and reset.
- `python checks/diamond-seo-audit.py --output /tmp/diamond-seo-live.json`: **10/10 live checks pass** after deployment. Read-only; makes no cart or checkout writes. Changing/removing sample inventory can legitimately require replacing a sample.
- Shopify theme validation: changed Liquid/templates pass; existing hardcoded-route warnings remain in main-collection and main-product-diamond.
- `node --check assets/diamond-storefront.js` and `git diff --check`: pass.
- **Failed:** repository typecheck reports existing errors in unchanged `src/shopify.ts`, `src/uploadifyMetafields.ts`, `test/theme-chat-opener.test.ts` and `test/theme-storefront-fixes.test.ts`. No TypeScript production file changed here.
- An initial repository test expected the removed “Certified by” text; updated to assert the supported badge and reject invented fallback certification, then all tests passed.
- An initial browser fixture failed visibility-dependent actions; controlled DOM events now test the actual production handlers. Public mobile/desktop layout was checked separately.
- A browser wait for network-idle timed out on the live site; DOM-content-loaded plus bounded settling succeeded. Do not treat persistent third-party network activity as a page-render failure.
- PR #281's Cloudflare build passed. Its supplier dry-run CI was still in progress at the last available connector read; local tests and the deployed theme were verified independently.

## Remaining work / handoff

Keep #280 open for sitemap inclusion, legacy non-IGI/GIA cleanup verification, the private-account checks above and any additional approved landing combinations. Do not change prices or broaden marketplace publication to close those checks.

The local GitHub CLI credential began returning HTTP 401 after the implementation had merged and deployed. The connected GitHub API was used to preserve the final evidence instead; no credential was printed or replaced.
