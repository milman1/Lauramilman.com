# Brand cleanup, collection merge, favicon, Journal images — 2026-10-05

Merchant instructions, same day: update the favicon; the Google Business
Profile rename is done; remove "Peaceful Diamonds" from active collections and
products; merge the two lab-grown collections; delete or decide on the empty
Gold Jewelry collection; fill in Journal featured images; keep blog tag pages
indexed.

## Live store changes (all verified by a fresh read)

**Peaceful Diamonds removed from active products**
- 14 active Peaceful Diamonds products had no `Lab Grown Diamond` tag; added
  first, so collections and the Uploadify sync keep finding them by tag.
- Tag "Peaceful Diamonds" removed from the 11 products that carried it.
- Vendor changed from Peaceful Diamonds to Laura Milman New York on all 102
  active products (5-product checkpoint, then 97). Check after: 0 active
  products with that vendor or tag; 140 active Laura Milman New York products
  match `tag:lab-grown`, so Uploadify still sees every one.
- Not changed: 2 draft products still have the old vendor. No title,
  description or SEO field mentioned the name. On the storefront the theme
  already printed Laura Milman New York for this vendor; the remaining theme
  references are internal class and setting names.
- eBay / Marketplace Connect will now show the brand as Laura Milman New York.

**Lab-grown collections merged**
- Kept `lab-grown-diamond-jewelry` (the one the menus link to). Rule changed
  from "vendor = Peaceful Diamonds" to "tag = Lab Grown Diamond AND type is not
  Lab-Grown Diamond". It now holds 133 pieces (was 104) and no loose stones.
- Deleted `lab-grown-jewelry` (26,238 items, mostly loose stones matched by
  title). Old rule, for the record: any of tag "Lab Grown Diamond", title
  contains "Lab Grown", title contains "Lab-Grown", vendor "Peaceful Diamonds".
  Redirect `/collections/lab-grown-jewelry` → `/collections/lab-grown-diamond-jewelry`.

**Gold Jewelry**
- Deleted (0 products; rule was tag `gold-jewelry`, which no product had). The
  header already sends gold links to Chains when it is empty. Redirect
  `/collections/gold-jewelry` → `/collections/chains`.

**Journal featured images**
- All 13 articles now have a featured image with alt text, each a real photo
  of a piece in the store matched to the topic (Rolex Sky-Dweller for box and
  papers, David Webb for authentication, Cartier Love for the estate guide,
  Cuban chains for the chain guide and stacking, lab-grown rings and studs for
  the diamond guides). Shopify copied each into article storage, so selling a
  piece does not break the image.

## Theme change (this PR)

- `config/settings_data.json`: favicon set to the existing
  `favicon_LMNY.png` from Files. It is 40×40 px; Google prefers a square of at
  least 48 px, so upload a larger version (e.g. 192×192) under the same name
  when convenient.

## Not changed by decision

- Blog tag pages stay indexed (merchant: do not hide from Google).
- Google Business Profile renamed by the merchant.
