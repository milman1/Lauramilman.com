# lmny-feeds — Belgium Dia → Shopify sync (+ optional Supabase dual-write)

Shopify is **currently** the live database. The sync fetches the Belgium Dia
feeds (natural diamonds, lab-grown, watches), normalizes and prices them,
then diffs against the Shopify catalog and writes via the Admin GraphQL API.
All sync state lives in `lmny_feed.*` product metafields.

**Migration in progress:** `supabase/schema.sql` defines a `stones` table the
sync dual-writes into when `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` are set.
Do **not** bulk-delete `tag:lmny-feed` diamond products until that table is
populated in a dedicated LMNY project and the storefront filter reads from it.
Today none of the three Supabase projects (Hours / Get Hours / lazrbeam)
holds a stones table — Shopify products are the only live copy.

## How it works

1. **Fetch** all three feeds (`src/feeds/belgiumdia.ts`), usually via the
   Cloudflare feed-cache Worker (`lmny-feeds/cloudflare-worker/feed-cache.js`).
2. **Normalize + gate** (`src/normalize.ts`): L colour / SI2 clarity floors for
   stones; watches whose feed condition is `aftermarket` are held out. Brands
   outside the curated list still import and are tagged `other-watch-brand`.
   Other failing rows are *held* (never created).
3. **Price** (`src/markup.ts`, rules in `config/pricing.ts`):
   - naturals: Rapaport × 0.75, held under a 20% margin floor. The floor is a
     **filter, not a floor price** — a thin stone is held out, never marked up
     to clear it. 20% margin-on-retail is why no published natural sits below
     cost × 1.25.
   - lab: tiered multiplier on total cost (~1.55× average)
   - watches: `round(comp_mid × 0.97)`; when Hours returns no mid, fall back
     to `round(cost × 1.10)`. No accessory haircut and no low→mid blend.
4. **Diff** by handle + `content_hash` (`src/diff.ts`): create / update /
   archive / skip. Unchanged hashes are skipped entirely. Items that leave the
   feed are archived, never deleted (URLs persist). A feed that fails to fetch
   never archives its catalog segment.
   Archives carry a cause: `left_feed` (the stock ref is gone — sold or
   withdrawn) or `held_in_feed` (still listed, but a gate or a pricing rule
   refused it this run). Both archive, since an unpriceable item must not stay
   buyable, but only `left_feed` gets the permanent URL redirect — redirecting
   a held item would strand its page when pricing lets it back. The run summary
   reports the split, so "N watches archived" can't be misread as sold-out
   inventory when a pricing rule moved.
5. **Write** (`src/shopify.ts`): `bulkOperationRunMutation(productSet)` with a
   staged JSONL upload for ≥100 changes, direct `productSet` below that.
   Media: every feed photo attaches by URL. `files` is re-sent only when the
   product holds fewer READY images than the feed supplies, so a settled
   product is never made to re-download its gallery. Watch videos are fetched,
   type-sniffed and staged-uploaded as real `VIDEO` media for every URL the
   feed supplies (not just the first), capped per run (`VIDEO_ATTACH_BUDGET`)
   because each one is a download plus an upload.
6. **Dual-write (optional):** upsert priced stones into Supabase `public.stones`
   when configured — preparation for moving the diamond filter off Shopify
   facets (which hide on collections over 5,000 products).

## Product model

- Handle = idempotency key: `nd-<stockref>` / `lg-<stockref>` / `w-<stockref>`.
- Product types: `Natural Diamond` / `Lab-Grown Diamond` / `Watch`.
- Vendor: `Laura Milman New York` for stones, the brand for watches.
- Metafields under `lmny_feed` (+ `cost_cents` under the app-reserved `$app`
  namespace so it is never exposed to the theme or Storefront API).
- Stone 360° videos stay embedded from the supplier rather than attached as
  Shopify media — re-hosting ~24k per run isn't affordable. `lmny_feed.video_url`
  is the first (what the diamond PDP's 360° tab reads today);
  `lmny_feed.video_urls` is the full list.
- Storefront filter facets: `custom.diamond_shape` / `carat_weight` / `color` /
  `clarity` / `cut` (PUBLIC_READ) — written for **both** natural and lab.
- No compare-at prices are ever derived from Rap or comp values.
- Four automated collections: Natural Diamonds, Lab-Grown Diamonds,
  Timepieces (all `lmny-feed` watches), and Other Watch Brands (watches whose
  brand is outside the curated `WATCH_BRANDS` list). The
  "Peaceful Diamonds by LMNY" collection is deliberately untouched.

## Running

```sh
npm ci
npm test                 # pure-function tests, no network
npm run sync:dry         # full fetch/normalize/price/diff, ZERO writes
npm run sync             # live
```

Flags: `--dry-run`, `--limit=N` (truncate each feed for testing).

### Environment

Five Actions secrets (required):

| Secret | Notes |
|---|---|
| `SHOPIFY_STORE_DOMAIN` | e.g. `laura-milman.myshopify.com` |
| `SHOPIFY_ADMIN_TOKEN` | Admin API token (`shpat_…`). **Or** use the client-credentials pair below |
| `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET` | Dev Dashboard app Client ID + Secret; exchanged for a 24h token at runtime |
| `BELGIUMDIA_API_KEY` | Secret only — never logged, sent via header |
| `HOURS_API_URL` | Direct Supabase function URL used as-is; a site root gets `/api/comps` appended |
| `HOURS_API_KEY` | Hours auth |

Optional (dual-write):

| Secret | Notes |
|---|---|
| `SUPABASE_URL` | Dedicated LMNY project URL (not Hours) |
| `SUPABASE_SERVICE_KEY` | Service-role key for `stones` upserts |

### Watch listing schema

Watch titles, descriptions, SEO, tags, and metafields follow
`docs/watch-listing-schema.md`. The pure transform lives in
`src/watchListingBuilder.ts` and is wired through `product.ts` for every
live feed sync. Specs (Dial, Bezel, Metal, MM, …) write to `custom.*`
metafields and render in the theme’s jewelry-style `.product-specs` grid on
the default product template — not as an HTML table in the description.
Condition values that do not map (`SLIDER`, blank, …) keep the legacy
brand/model/reference title and bullet-list description.

For the ~620 already-live watches still on the old bullet-list HTML:

```sh
pip install requests
export SHOPIFY_TOKEN=shpat_…   # or SHOPIFY_ADMIN_TOKEN
python scripts/lmny_watches_backfill.py --dry-run
python scripts/lmny_watches_backfill.py --limit 5   # then full run
```

The backfill is resumable (`watch_migrate_state.json`), skips titles that
already start with `Pre-Owned ` / `Unworn `, merges tags with existing ones,
and writes unrecognized conditions to `needs_review.csv`.

### Lab pricing backfill

After unpublishing Lab-Grown Diamond `lmny-feed` products:

```sh
npm run confirm:lab-unpublished   # must exit 0
npm run backfill:lab-pricing      # SYNC_FEEDS=lab; resumable via content_hash
```

Spot-check `out/report.md` lab bands before republishing.

### eBay File Exchange (Seller Hub upload)

If a bulk upload fails with **error 21917328**, the payment profile is not in the form Seller Hub’s listings template expects:

`eBay Managed Payments (246832199020) - (ID: 246832199020)`

Shipping: `Daily Deals - 1Handling Day - (ID: 258461530020)`  
Returns (watches): `No returns accepted - (ID: 24363507020)`

After a prefill pass, fill price / condition / those three policy names and re-upload `ebay/ebay_listings_ready_to_publish.csv` (`Template=eBay-listings-template_EBAY_US`). Calculated shipping also needs `PostalCode` `10036` (1145 6th Avenue) and a 2 lb `PackageThickEnvelope` weight. Do not change `TrackingId`. Do not open the CSV in Excel.

Live watches already listed with 14-day returns must be **Revise**d, not Add. Upload `ebay/ebay_listings_revise_no_returns.csv` (or the smaller `ebay/ebay_file_exchange_revise_no_returns.csv`). Do not re-upload the 52 live SKUs as Add or eBay will duplicate them.

```sh
npx tsx scripts/fix-ebay-file-exchange.ts \
  --in path/to/failed.csv \
  --out out/ebay_upload_ready_to_import.csv
```

Optional overrides: `BELGIUMDIA_API_URL` (repo Actions **variable**; defaults to
`https://api.belgiumdia.com`), and `BELGIUMDIA_NATURAL_PATH` /
`BELGIUMDIA_LAB_PATH` / `BELGIUMDIA_WATCH_PATH` for the endpoint paths.

## The Back Vault weekly sync (`src/backvault/`)

A second, independent pipeline scraped from thebackvault.com's public
Shopify `products.json` feed — no API key required.

```sh
npm run sync:backvault:dry   # fetch + normalize + diff, zero writes
npm run sync:backvault       # live (needs Shopify env vars)
```

**What it does:**

1. **Fetch** the `/collections/new-arrivals/products.json` feed
   (`src/backvault/feed.ts`), paginated at 250 rows/page.
2. **Normalize + gate** (`src/backvault/normalize.ts`): keep only items
   whose `vendor` fuzzy-matches one of the 40 curated top-designer brands
   (`src/backvault/designers.ts`), and whose variants have at least one
   available. Out-of-stock and non-designer items are silently dropped.
3. **Scrub** (`src/backvault/scrub.ts`): remove every trace of
   "The Back Vault" / "Back Vault" / "back-vault" / "thebackvault" from
   title, description, tags, SEO, and alt text per SHOPIFY_SETUP.md §3.
   A hard `assertScrubbed()` gate inside the product builder throws rather
   than publishing a surviving reference to the live store.
4. **Extract specs** (`src/backvault/specs.ts`): prefer the labeled
   `<strong>Metal Type:</strong>` block on the supplier PDP, then regex
   for metal type/weight, diamond weight, measurements, era, condition,
   gemstones — written to `custom.*` metafields (the same keys the
   estate-jewelry PDP reads from §1 of SHOPIFY_SETUP.md).
5. **Rewrite listing copy** (`src/backvault/listing.ts`) to the same
   estate / watch SEO schema already used on the store:
   - Title: `{Brand} {normalized remainder}`; watches get a `Pre-Owned` prefix
   - Body: `This {Brand} estate {type}… is offered by Laura Milman New York.`
     plus `Authenticated and hand-inspected by Laura Milman New York.`
     Specs stay in metafields, not an HTML table.
   - SEO title ≤ 60 chars (`{Title} | Laura Milman`, truncated at a word)
   - SEO description ≤ 160 chars, always ending
     `Authenticated by Laura Milman New York.`
6. **Price**: listed price from The Back Vault is passed through unchanged
   (no markup). Cost is not known, so `inventoryItem.cost` is omitted.
7. **Diff** (`src/backvault/diff.ts`): create / update / archive / skip
   against a tag-scoped catalog read (`tag:'backvault-feed'`). Handle
   prefix `bv-`. Archived products get a redirect to `/collections/all`.
8. **Write** via the same `ShopifyClient.productSet()` the Belgium Dia
   sync uses — direct (non-bulk) since weekly volume is at most a few
   hundred products.

**Vendor / collection mapping:** every item's Shopify Vendor is set to the
canonical designer name from `designers.ts`. Shopify's automated
collections (SHOPIFY_SETUP.md §2) then sort them automatically by Vendor
condition — no manual collection assignment needed.

### Environment

Inherits the same Shopify secrets as the Belgium Dia sync
(`SHOPIFY_STORE_DOMAIN` + `SHOPIFY_ADMIN_TOKEN` or client-credentials
pair). Additional optional variables:

| Variable | Default | Notes |
|---|---|---|
| `BACKVAULT_BASE_URL` | `https://thebackvault.com` | Override for testing against a mirror/fixture server |
| `BACKVAULT_COLLECTION_HANDLE` | `new-arrivals` | Collection slug to scrape |

### Schedule

`.github/workflows/backvault-feed-sync.yml` — weekly, Sunday 00:17 UTC.
Always live on the schedule (user chose no dry-run gate). Use
`workflow_dispatch` with `dry_run=true` to inspect a run without writes.

---

## CI / schedule (Belgium Dia)

`.github/workflows/lmny-feed-sync.yml`:

- **pull_request** touching `lmny-feeds/` → always dry-run (the PR's CI signal
  *is* the dry-run report).
- **workflow_dispatch** → `dry_run` input, default `true`; untick for live.
- **schedule** (hourly at :17) → live when `LMNY_SYNC_LIVE=true`.

Every run writes `out/report.json` (audit trail artifact) and renders
`out/report.md` into the Actions run summary.

## Known gaps (deliberate)

### The Back Vault sync

- Spec extraction (`src/backvault/specs.ts`) prefers labeled PDP fields and
  falls back to regex. False-negative (missed spec) is the failure mode —
  not a wrong spec. Unsigned / `vendor: The Back Vault` rows stay out of
  the sync on purpose (not a curated top designer).
- Archived products redirect to `/collections/all` rather than a
  per-designer collection because the vendor is not stored on `CatalogEntry`
  at archive time. A future pass could enrich the catalog query to include
  the vendor tag and redirect to `/collections/<designer-handle>` instead.
- The `backvault_feed` metafield namespace (`src/backvault/product.ts`) is
  not yet defined in SHOPIFY_SETUP.md §1 — add those three definitions
  (source_handle, content_hash, synced_at) the first time the sync runs or
  they will be auto-created by Shopify with no storefront access setting.

### Belgium Dia / watch / stone

- Watch body trust line (`CONFIG.trustLine` / `TRUST_LINE`) stays off until
  confirmed for feed inventory; SEO still says
  `Authenticated by Laura Milman New York.`
- Watch `OG Tag` is not on the Belgium Dia developer API — omitted from
  listings until another source exists. Dial / Bezel / Bracelet / Metal / MM /
  Links come from the feed and refresh on schema-version bumps.
- Stone `.mp4` / 360° viewers are still embedded from the supplier rather than
  attached as Shopify media (see above). Watch videos *are* attached.
- The diamond PDP renders one 360° tab from `lmny_feed.video_url`; the extra
  entries in `video_urls` are written but not yet shown.
- Archived products keep any URL redirect created for them before the
  `held_in_feed` split existed. Reactivating one of those needs the redirect
  deleted by hand (the app has no `write_online_store_navigation` scope, so
  most runs never created any).
- App Proxy / theme filter that reads `stones` instead of `collection.filters`
  is not shipped yet — schema + dual-write land first.
- Checkout for non-product stones (inquiry / draft order / JIT product) is an
  open decision; PD originally used select-for-ring + add-to-cart against a
  live API, not Shopify products.
- Lab markup tiers and the watch brand list in `config/pricing.ts` are
  reconstructions pending review.
