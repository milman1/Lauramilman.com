# Laura Milman NY — Men's Wedding Band Migration

Hand this folder to Claude Code. Everything needed is here.

## Files

| File | Purpose |
|---|---|
| `lmny_bands_migrate.py` | The migration script. Run this. |
| `lmny-mens-bands-seo-rebuild.csv` | 108 products of rewritten copy. The script reads it. Must sit beside the script. |
| `lmny-mens-bands-handle-map.csv` | Reference only. Suggested URL handles. Nothing reads it. Do not act on it. |

Ignore any `lmny-bands-REMAINING-100.csv` or `lmny-bands-TEST-3.csv` if present. They were for a
Shopify CSV import that turned out to be impossible (see Gotchas). Delete them.

## The job

108 men's wedding bands on lauramilman.com. Two independent workstreams:

1. **SEO pass.** Rewrite title, description, SEO title, meta description, tags. All 108 previously
   read "Men's Wedding Band 47" with the body text "*Description coming soon" — 95 pages of
   duplicate content. New copy is written per product from the actual ring images. Heavy on
   Celtic knotwork, Greek key, Claddagh, custom name, and Roman numeral pieces, which is where
   the search intent lives.
2. **Colour + variants pass.** Add a "Metal color" option (Yellow / White / Rose Gold), recolour
   the CAD render into rose and white gold, upload both, and build out 20 variants to 60.

Run them separately. Pass 1 first.

## Current state

- **12 of 108 already have the new copy**, done by hand through an MCP connector. Re-running the
  SEO pass over them is harmless; it writes identical values back.
- **`mens-wedding-band-35` is fully migrated** — it has the Metal color option, 60 variants, and
  rose/white renders attached. It was the pilot. The script detects this and skips its colour
  build automatically. Do not rebuild it.
- Nothing else has been touched.
- `migrate_state.json` does not exist yet. It gets created on first run and records completed
  handles so re-runs skip them.

## Setup

Needs a Shopify Admin API token from a custom app (Settings > Apps and sales channels >
Develop apps). Scopes: `read_products`, `write_products`, `read_files`, `write_files`.
The token is shown exactly once at install.

```
pip3 install requests pillow numpy
export SHOPIFY_TOKEN=shpat_...
```

## Run order

```bash
# 1. See what would happen. Changes nothing.
python3 lmny_bands_migrate.py --dry-run

# 2. Copy only, no images or variants. ~2 minutes. Start here.
python3 lmny_bands_migrate.py --skip-color --limit 5
#    Check those 5 in Shopify admin, then:
python3 lmny_bands_migrate.py --skip-color

# 3. Colours and variants. Slower (~20-30 min). Only after the questions below are settled.
python3 lmny_bands_migrate.py --skip-seo --limit 5
python3 lmny_bands_migrate.py --skip-seo
```

If a run fails partway, just run the same command again. Successes are recorded and skipped;
only failures are retried.

## Two open questions — do not run step 3 until Avi answers

1. **Is the rose gold right?** The renders are algorithmic recolours of the original CAD files
   (luminance remap through a colour ramp, with a saturation mask so background and shadow stay
   untouched). Geometry is bit-identical; only the metal's colour response changes. Nothing is
   AI-generated. Tune the `ROSE` and `WHITE` ramp stops near the top of the script if the colour
   reads wrong, then test with `--only mens-wedding-band-35`. Cheap to iterate before generating
   216 files, expensive after.

2. **Inventory tracking.** Currently on, with 2 units per variant, which is fiction for
   made-to-order bands. New colour variants are created with "continue selling when out of stock"
   so they're purchasable, which leaves each product inconsistent: 20 tracked, 40 untracked.
   Adding `--untracked` normalises everything. Avi has not decided.

## Gotchas

- **Shopify CSV import cannot do this.** The importer treats each row as a variant row. A
  product-level-only file on multi-variant products fails with "Product options input is required
  when updating variants." Adding option columns would need one row per variant (~2,100 rows) and
  would delete any variant not present in the file. Use the API. This is settled; don't retry it.
- **Handles are deliberately not changed.** URLs still read `/products/mens-wedding-band-47`.
  Changing them needs `redirectNewHandle: true` and a separate careful pass. Out of scope here.
- **Metal color spends the last option slot.** Shopify caps products at 3 options. After this,
  Width can never become a selectable option. This tradeoff was chosen knowingly.
- Prices are read from each product's existing variants, not hardcoded, so any product deviating
  from $1,500 / $1,900 stays correct.

## Known gaps, not covered by this script

- **~20 duplicate products** named `mens-wedding-band-with-beveled-matte-finish-milgrain-copy`
  through `-19`. Almost certainly a bulk-duplicate accident. Live, near-identical, and actively
  working against the SEO this migration is buying. Worth auditing and drafting or deleting.
- **Bands 111 through 128, plus 28 and 58** exist in the store but have no copy in the CSV. They
  were created after the source images were reviewed. Writing copy for them requires looking at
  the renders; do not invent descriptions for jewellery.
