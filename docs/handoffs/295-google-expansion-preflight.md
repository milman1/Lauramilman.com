# Google loose-stone expansion preflight

Issue: #295. Owner: Codex. Checked: 2026-10-18T23:49:02.286Z.
Status: staged, not published; Merchant Center pilot approval unavailable.

The merchant authorized proceeding with the staged expansion recommendation:
verify the five pilot products in Google, then expand to 50–100 stones.
The cloud browser reached Google Merchant Center's sign-in screen, and the
secure sign-in request was declined. Authentication was not retried. No Google
approval or visibility was inferred from Shopify publication.

## Prepared scope

The committed original shortlist contains 240 unique product rows (excluding
its header and blank lines). All 240 were read live from Shopify in six explicit
handle batches. The preflight passed 237 products; three were held for SKU
review. Select 100 total: the existing five plus 95 proposed additions.

Selection rotates through shape/carat cells, choosing lower current Shopify
prices within each cell. This is a coverage/price selection, not evidence of
Google demand, market-beating prices or sales performance.

| Shape | Selected |
|---|---:|
| Oval | 21 |
| Cushion | 16 |
| Emerald | 16 |
| Pear | 16 |
| Radiant | 16 |
| Round | 15 |

Carat bands: 1.5 = 24, 2 = 29, 2.5 = 24, 3 = 23.
Current selected retail range: $266–$670. Prices are recorded, never written.
The manifest is docs/seo/2026-10-18-google-expansion-100.csv.

## Preflight checks

Each candidate is ACTIVE, type Lab-Grown Diamond, published to the Online Store,
with nonempty description, a READY Shopify IMAGE, matching certificate and lab
against the source shortlist, one matching variant SKU, a positive current
price, and the existing tracked-zero/CONTINUE policy. Records tagged
media-missing or pricing-review were excluded. Exactly five of the original
240 are currently published to Google & YouTube.

Held for SKU review (not included):
- lg-100742830262a
- lg-100752522773a
- lg-100759673943a

These suffix mismatches may be aliases; this preflight does not declare them
incorrect or modify them. Supplier availability must be freshly revalidated by
the existing sync before any new publication. Shopify availability is not a
supplier-stock guarantee. Public page rendering and Merchant Center ingestion
were not verified in this pass.

## Next action

Verify Merchant Center account 117613711 pilot approval, visibility, actual
price/availability, image fetch and checkout-link issues. Then refresh the
manifest's supplier and Shopify checks, update the runtime allowlist through
its existing config/PR workflow, run the supplier-backed dry run, publish the
95 qualifying additions, and independently read back publication and prices.
Keep the live allowlist at five until the Google check passes. This branch
contains planning evidence only; no live config, publication, price, inventory,
Uploadify/eBay rule or account setting changes were made.
