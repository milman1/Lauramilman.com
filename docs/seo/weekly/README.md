# Weekly site pulse

One report a week, committed here as `YYYY-MM-DD.md` (the Monday it covers
up to). It reports; it does not change the store. Every proposed
improvement is a numbered list item the merchant approves or declines by
replying with the numbers. Nothing in a proposal is applied until then.

## Sources

| Source | What it gives | Access today |
|---|---|---|
| Shopify analytics (ShopifyQL through the Shopify connector) | Sessions, landing pages, referrers, device, cart and checkout, orders, sales | Working |
| Google Search Console | Queries, impressions, clicks, average position, indexing | **Not connected.** Needs an export to Google Drive or a connector (below) |
| Google Analytics 4 | Engaged sessions, organic sessions, bot-filtered traffic, conversions | **Not connected.** Same |
| Shopify Admin API | Articles, collections, SEO fields, redirects, alt text | Working |

To connect Google data, the merchant does one of these:

1. Easiest: in Search Console, export Performance (last 28 days, queries and
   pages) and Pages (indexing) to Google Sheets once a week, into one Drive
   folder. Do the same for GA4's Traffic acquisition and Landing page
   reports. The weekly job reads that folder with the Google Drive connector.
2. Or connect a connector that reads Search Console and GA4 directly in
   claude.ai Settings → Connectors (none was available in this workspace on
   2026-10-05; Supermetrics covers GA4).

## Competitors (merchant's list, 2026-10-08)

| Competitor | Site | Compare against |
|---|---|---|
| Rare Carat | rarecarat.com | Loose lab-grown and natural diamonds, engagement settings, policies |
| Blue Nile | bluenile.com | Loose lab-grown and natural diamonds, settings, policies |
| Michael Gabriels | michaelgabriels.com | Lab-grown jewelry (tennis bracelets, studs, hoops), engagement rings; New York |
| J.R. Dunn | jrdunn.com | Rolex and watches, designer jewelry, bridal, store services |

Once a month (first report of the month), re-run the price check: read each
site's public listing pages through Firecrawl, match round stones by carat
(±0.06), color and clarity against the live catalog, and save the matches as
`docs/seo/YYYY-MM-DD-lab-price-comparison.csv`. If the lab-grown search note
(`templates/collection.diamonds-lab.json`, `price_note`) is still true,
propose new text and a new `price_note_until`; if it is not, propose removing
it. Never name a competitor on the storefront.

## Queries (ShopifyQL)

Last 28 days unless noted. Compare with the previous report.

```
FROM sessions SHOW sessions, online_store_visitors, sessions_with_cart_additions, sessions_that_completed_checkout, conversion_rate TIMESERIES week SINCE -56d UNTIL today
FROM sessions SHOW sessions WHERE referrer_source = 'search' TIMESERIES week SINCE -56d UNTIL today
FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_completed_checkout GROUP BY referrer_source, referrer_name SINCE -28d UNTIL today ORDER BY sessions DESC LIMIT 25
FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_completed_checkout GROUP BY landing_page_path SINCE -28d UNTIL today ORDER BY sessions DESC LIMIT 40
FROM sessions SHOW sessions GROUP BY landing_page_path WHERE landing_page_path STARTS WITH '/blogs/' SINCE -28d UNTIL today ORDER BY sessions DESC LIMIT 15
FROM sessions SHOW sessions, sessions_with_cart_additions GROUP BY session_device_type SINCE -28d UNTIL today
FROM sales SHOW orders, net_sales TIMESERIES week SINCE -56d UNTIL today
FROM sales SHOW orders, net_sales GROUP BY order_referrer_source, order_referrer_name SINCE -56d UNTIL today ORDER BY net_sales DESC LIMIT 15
```

## Report shape

1. **Pulse**: a table of this week against the last report: sessions,
   organic search sessions, AI-assistant referrals (chatgpt, perplexity,
   gemini, copilot), cart adds, orders, net sales. One line each on what
   moved and why it probably moved.
2. **Search** (once Google data is connected): top queries and pages,
   biggest gains and losses, pages with impressions but low clicks (title
   and description candidates), indexing problems.
3. **Content health**: dead internal links in articles and collection
   copy; articles, collections and pages missing an SEO title or
   description; new "30-day" or "lifetime" policy language that contradicts
   the 7-day policy; new products with missing or stale alt text.
4. **Proposed improvements**: numbered, at most five, each with the page,
   the exact change, why the data supports it, and effort. Product titles,
   descriptions and product SEO fields are excluded; the merchant handles
   those.
5. **Waiting on the merchant**: decisions still open from earlier reports.

Rules: no invented numbers. If a source is missing, say so in the report.
Shopify session counts include bots (see the 2026-10-05 report), so never
report them as people. Follow `ORCHESTRATION.md` and `AGENTS.md` for any
change the merchant approves.
