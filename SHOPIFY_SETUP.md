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
4. Import the CSV (Products → Import).
5. Run the post-import audit (§3c).
6. Spot-check 3–5 products to confirm metafields populated and the
   product appears in the correct brand collection.
