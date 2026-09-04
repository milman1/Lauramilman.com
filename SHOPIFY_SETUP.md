# Shopify Setup — Laura Milman

One-time configuration needed in Shopify Admin before the first CSV product
import. Work through the sections in order.

---

## 1. Product Metafield Definitions

**Where:** Shopify Admin → Settings → Custom data → Products → Add definition

For each row below, create a definition with the given Name, Namespace/key,
Type, and Description. Leave Validation open unless noted.

| # | Name           | Namespace and key        | Type             | Description                                  |
|---|----------------|--------------------------|------------------|----------------------------------------------|
| 1 | Metal Type     | `custom.metal_type`      | Single line text | Metal composition (e.g., 18K Yellow Gold)    |
| 2 | Metal Weight   | `custom.metal_weight`    | Single line text | Weight of metal in grams                     |
| 3 | Diamond Weight | `custom.diamond_weight`  | Single line text | Total carat weight of diamonds               |
| 4 | Measurements   | `custom.measurements`    | Single line text | Size / dimensions of the piece               |
| 5 | Gemstones      | `custom.gemstones`       | Single line text | Non-diamond stones (emerald, sapphire, etc.) |
| 6 | Era            | `custom.era`             | Single line text | Period or approximate date (e.g., Art Deco, c. 1925) |
| 7 | Condition      | `custom.condition`       | Single line text | Pre-owned condition / authentication note    |

**CSV column headers** (for the import file) must match exactly:

```
Metafield: custom.metal_type [single_line_text_field]
Metafield: custom.metal_weight [single_line_text_field]
Metafield: custom.diamond_weight [single_line_text_field]
Metafield: custom.measurements [single_line_text_field]
Metafield: custom.gemstones [single_line_text_field]
Metafield: custom.era [single_line_text_field]
Metafield: custom.condition [single_line_text_field]
```

Also include the Shopify standard columns in §11 (Status, Variant SKU,
inventory, Product Category). Marketplace apps will not keep a listing
without them.

---

## 2. Brand Auto-Collections

Goal: every product imported for a known designer lands in that designer's
collection automatically, with no manual tagging per upload.

**Mechanism:** Shopify automated (smart) collections, matched on the product's
**Vendor** field.

### 2a. CSV convention

In the import CSV, set the `Vendor` column to the **exact brand name** from
the table below. One brand per row. Do not include retailer names
(see §3 on the Back Vault scrub).

### 2b. Create one automated collection per brand

**Where:** Shopify Admin → Products → Collections → Create collection

For each brand:

1. **Title:** brand display name (column 1 below)
2. **Handle:** set to the handle in column 2 (must match — the storefront
   dropdown in `sections/estate-designers.liquid` links to these URLs)
3. **Collection type:** Automated
4. **Conditions:** `Product vendor` `is equal to` `<brand display name>`
5. Save.

### 2c. Brand → collection handle map

These 38 brands already have dropdown entries wired up in
`sections/estate-designers.liquid`. Keep the handles exact.

| Vendor (display name) | Collection handle        |
|-----------------------|--------------------------|
| Adler                 | adler                    |
| Aldo Cipullo          | aldo-cipullo             |
| Aletto Brothers       | aletto-brothers          |
| Angela Cummings       | angela-cummings          |
| Asch Grossbardt       | asch-grossbardt          |
| Asprey                | asprey                   |
| Audemars Piguet       | audemars-piguet          |
| Bailey Banks & Biddle | bailey-banks-biddle      |
| Bert H. Satz          | bert-h-satz              |
| Boucheron             | boucheron                |
| Buccellati            | buccellati               |
| Bvlgari               | bvlgari                  |
| Carrera Y Carrera     | carrera-y-carrera        |
| Cartier               | cartier                  |
| Carvin French         | carvin-french            |
| Chanel                | chanel                   |
| Charles Krypell       | charles-krypell          |
| Chaumet               | chaumet                  |
| Chopard               | chopard                  |
| Christian Dior        | christian-dior           |
| Craiger Drake         | craiger-drake            |
| David Webb            | david-webb               |
| De Grisogono          | de-grisogono             |
| Demner                | demner                   |
| Di Modolo             | di-modolo                |
| Dinh Van              | dinh-van                 |
| Dominique Paris       | dominique-paris          |
| Fabergé               | faberge                  |
| Franck Muller         | franck-muller            |
| Fred                  | fred                     |
| Graff                 | graff                    |
| Harry Winston         | harry-winston            |
| Hermès                | hermes                   |
| Ilias Lalaounis       | ilias-lalaounis          |
| Jean Schlumberger     | jean-schlumberger        |
| Marina B              | marina-b                 |
| Mikimoto              | mikimoto                 |
| Patek Philippe        | patek-philippe           |
| Tiffany & Co.         | tiffany-co               |
| Van Cleef & Arpels    | van-cleef-arpels         |

### 2d. Adding a new brand later

1. Add a row to the table above.
2. Create the automated collection (steps 2b.1–5) with the matching handle.
3. Add an `<option value="/collections/<handle>">Brand Name</option>` entry
   to the appropriate `<optgroup>` in `sections/estate-designers.liquid`.

---

## 3. Pre-Import Content Scrub

**Rule:** the phrase **"The Back Vault"** (and variants: "Back Vault",
"back-vault", "thebackvault") must not appear anywhere on a Laura Milman
product. Scrub the CSV before import and re-audit post-import.

### 3a. Fields to check per product

These live on the product row in Shopify and must all be clean:

- **Title**
- **Body (HTML)** — the long description
- **Vendor** — must be the brand name, not a retailer
- **Tags** — remove any tag containing the phrase
- **SEO Title** (`Metafield: title_tag`)
- **SEO Description** (`Metafield: description_tag`)
- **Image Alt Text** — all images, including variant images
- **All 7 custom metafields** listed in §1
- **URL handle** — no `back-vault` in the slug

### 3b. Pre-import CSV check (run before upload)

From the directory containing the CSV:

```bash
grep -in "back[- ]*vault" products.csv
```

Expect zero matches. If any rows hit, fix the value in the CSV before
importing.

### 3c. Post-import audit (run after upload)

In Shopify Admin:

1. **Products → search bar:** search `back vault` — should return 0 products.
2. **Content → Files:** search `back-vault` in filenames.
3. **Online Store → Blog posts / Pages:** search `back vault`.
4. **Navigation:** confirm no menu item links to a `back-vault` collection
   or page.

### 3d. Theme code

Confirmed clean as of this commit — no references in any `.liquid`, `.json`,
`.js`, `.css`, or `.md` file in the repo.

---

## 4. Import Order

1. Create all 7 metafield definitions (§1).
2. Create all 38 brand auto-collections (§2).
3. Run the CSV scrub (§3b).
4. Run the jewelry CSV marketplace check (§11).
5. Import the CSV (Products → Import).
6. Run the post-import audit (§3c).
7. Spot-check 3–5 products to confirm metafields populated and the
   product appears in the correct brand collection.

---

## 5. All Jewelry collection (exclude watches)

`/collections/all` is Shopify's automatic catalog and currently mixes Rolex
and other timepieces into "All Jewelry". The theme now hides watches on that
URL by pulling from jewelry collections only, but you should still create a
proper automated collection for merchandising and the Shop channel.

**Where:** Shopify Admin → Products → Collections → Create collection

1. Title: `All Jewelry`
2. Handle: `all-jewelry` (optional; the theme already special-cases `all`)
3. Type: Automated
4. Conditions (match **all**):
   - Product type `is not equal to` `Watch`
   - Product type `is not equal to` `Watches`
   - Product type `is not equal to` `Timepiece`
5. Save. Do **not** use this collection for Timepieces.

Also update **Sales channels → Shop** featured collections to jewelry
collections (rings, necklaces, earrings) — never the mixed All catalog.
Upload `assets/shop-channel-cover.jpg` as the Shop cover image.
Create an Online Store page with handle `shop` and template **shop**.

---

## 6. Welcome discount `LMNYWELCOME`

**Where:** Shopify Admin → Discounts → Create discount → Amount off order

- Code: `LMNYWELCOME`
- 10% off
- Purchase type: Jewelry collections only (exclude Timepieces / Watch product type)
- Customer eligibility: new customers / one use per customer
- Combinations: off

The storefront popup and newsletter reveal this code after signup.

---

## 7. Branded emails

Paste-ready HTML lives in `/emails`. Shopify **Basic** has no
`abandoned_checkout` Notifications template (404). Messaging cannot replace
locked blocks.

**Already live:** order confirmation and shipping confirmation.

**Welcome:** Marketing → Automations → Custom Liquid →
`emails/welcome.messaging-block.html`. From:
`Laura Milman New York <hello@lauramilman.com>`.

**Abandoned cart (Basic):** keep **You left items in your cart** Active.
Add Custom Liquid → `emails/abandoned-cart.messaging-block.html`.
Do not Draft that automation — it is the only recovery email on Basic.

**Account:** Settings → Notifications → Edit code for customer account
welcome and invite.

| File | Use in |
|------|--------|
| `emails/welcome.messaging-block.html` | Messaging → Welcome → Custom Liquid |
| `emails/abandoned-cart.messaging-block.html` | Messaging → You left items in your cart → Custom Liquid |
| `emails/abandoned-checkout.messaging-block.html` | Messaging → Abandoned checkout → Custom Liquid (if that automation exists) |
| `emails/customer-account-welcome.html` | Settings → Notifications → Customer account welcome |
| `emails/customer-account-invite.html` | Settings → Notifications → Customer account invite |
| `emails/order-confirmation.html` | Already saved |
| `emails/shipping-confirmation.html` | Already saved |

Full steps: `emails/README.md`. Set **Settings → General → Store address**.
Verify sender `hello@lauramilman.com`. Update **Settings → Policies → Refund
policy** to match `/pages/shipping-returns`.

---

## 8. Journal pages (corporate NYC)

Create three Online Store pages and assign the matching templates:

| Page title | Handle | Theme template |
|------------|--------|----------------|
| Best After-Work Bars in New York | `best-bars-nyc` | `best-bars-nyc` |
| Power Dressing Jewelry for New York | `power-dressing-nyc` | `power-dressing-nyc` |
| The Hotel Bar Edit | `hotel-bars-nyc` | `hotel-bars-nyc` |

Optional: paste the same copy into Journal blog posts tagged `style` so they
also appear at `/blogs/journal`.

---

## 9. Reviews

The homepage and product pages embed the existing Google reviews widget
(SociableKit id `25387276`) and Shopify Product Reviews (`spr`) when that
app is installed. To collect on-site reviews: Shopify Admin → Apps →
Product Reviews (or Judge.me) → enable. The product template already
renders `#shopify-product-reviews`.

---

## 10. Watch & vintage holds (phone)

Product pages for timepieces and estate/vintage show **Hold this piece** and
**Private viewing**. Both require a phone number and land in **Admin → Inbox**.

Shopify customer tags applied when the hidden customer form succeeds:

- `hold-request` — asked to hold a specific piece
- `watch-interest`
- `vintage-interest`
- `private-viewing` — booked from `/pages/private-clients`

If a tag is missing on the customer record, add it from the Inbox thread.
Optional: Shopify Flow → “Customer created” / form submit → add the same tags.

Do **not** print a different website price vs viewing price on the storefront.
Talk numbers on the call.

---

## 11. Jewelry CSV — marketplace import rules (Uploadify)

A jewelry CSV must match the same contract as feed watches and diamonds or
Uploadify will skip the piece / delist it on the next pull: **ACTIVE**,
**SKU**, **qty > 0**, plus a real Shopify **Category**.

Required Shopify columns (in addition to §1 metafields):

| Column | Value for a piece you want listed |
|---|---|
| `Status` | `active` |
| `Published` | `true` |
| `Variant SKU` | Unique stock number, never blank |
| `Variant Inventory Tracker` | `shopify` |
| `Variant Inventory Qty` | `1` (one-of-one) |
| `Variant Inventory Policy` | `deny` |
| `Product Category` | Standard taxonomy breadcrumb or id from the table below |
| `Type` | `Rings` / `Necklaces` / `Earrings` / `Bracelets` / `Watch` / … |

When the piece sells, set qty to `0` or archive it so Uploadify delists.

### Product Category values

| Type | Product Category (CSV) | Id |
|---|---|---|
| Rings | `Apparel & Accessories > Jewelry > Rings` | `aa-6-9` |
| Bracelets | `Apparel & Accessories > Jewelry > Bracelets` | `aa-6-3` |
| Necklaces | `Apparel & Accessories > Jewelry > Necklaces` | `aa-6-8` |
| Earrings | `Apparel & Accessories > Jewelry > Earrings` | `aa-6-6` |
| Brooches | `Apparel & Accessories > Jewelry > Brooches & Lapel Pins > Brooches` | `aa-6-4-1` |
| Pendants | `Apparel & Accessories > Jewelry > Charms & Pendants > Pendants` | `aa-6-5-1` |
| Cufflinks | `Apparel & Accessories > Clothing Accessories > Cufflinks` | `aa-2-10` |
| Watch | `Apparel & Accessories > Jewelry > Watches` | `aa-6-11` |
| Jewelry (generic) | `Apparel & Accessories > Jewelry` | `aa-6` |

Either the breadcrumb or the short id is accepted.

### Pre-import check

From the repo, with the CSV path:

```sh
cd lmny-feeds
npx tsx scripts/validate-jewelry-csv.ts ../products.csv
```

Expect exit 0 and `Jewelry CSV OK`. Fix every listed row before Shopify
Admin → Products → Import. This is the same idea as the Back Vault scrub
in §3b: catch blanks before they go live.

