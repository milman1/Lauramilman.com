# lmny-feeds — Belgium Dia → Shopify sync

Shopify **is** the database. No Supabase, no external store: the sync fetches
the Belgium Dia feeds (natural diamonds, lab-grown, watches), normalizes and
prices them, then diffs against the Shopify catalog and writes via the Admin
GraphQL API. All sync state lives in `lmny_feed.*` product metafields.

## How it works

1. **Fetch** all three feeds (`src/feeds/belgiumdia.ts`).
2. **Normalize + gate** (`src/normalize.ts`): L colour / SI2 clarity floors for
   stones, curated brand list for watches. Failing rows are *held* (never
   created).
3. **Price** (`src/markup.ts`, rules in `config/pricing.ts`):
   - naturals: Rapaport × 0.75, held under a 20% margin floor
   - lab: tiered multiplier on cost (~1.55× average)
   - watches: Hours comp mid × 0.97, floored at cost × 1.05; no comp → hold.
     Most watches hold (`watch_no_market_comp` / `watch_feed_price_at_market`)
     — that is correct, not a bug: the feed prices at grey-market level and
     only genuinely-below-market pieces publish.
4. **Diff** by handle + `content_hash` (`src/diff.ts`): create / update /
   archive / skip. Unchanged hashes are skipped entirely. Items that leave the
   feed are archived, never deleted (URLs persist). A feed that fails to fetch
   never archives its catalog segment.
5. **Write** (`src/shopify.ts`): `bulkOperationRunMutation(productSet)` with a
   staged JSONL upload for ≥100 changes (initial load ~3,800), direct
   `productSet` below that. Images attach by external URL so Shopify copies
   them to its CDN. Created products are published to the Online Store channel.
   Products whose media all failed processing are quarantined next run:
   `media-missing` tag + `DRAFT`.

## Product model

- Handle = idempotency key: `nd-<stockref>` / `lg-<stockref>` / `w-<stockref>`.
- Product types: `Natural Diamond` / `Lab-Grown Diamond` / `Watch`.
- Vendor: `Laura Milman New York` for stones, the brand for watches.
- Metafields under `lmny_feed` (+ `cost_cents` under the app-reserved `$app`
  namespace so it is never exposed to the theme or Storefront API).
- No compare-at prices are ever derived from Rap or comp values.
- Three automated collections keyed on the `lmny-feed` tag + product type:
  Natural Diamonds, Lab-Grown Diamonds, Timepieces. The
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

| Var | Notes |
|---|---|
| `SHOPIFY_STORE_DOMAIN` | e.g. `laura-milman.myshopify.com` |
| `SHOPIFY_ADMIN_TOKEN` | Admin API token (`read/write_products`, `read/write_publications`) |
| `BELGIUMDIA_API_URL` | Feed base URL (repo Actions **variable**) |
| `BELGIUMDIA_API_KEY` | Secret only — never logged, sent via header. Slated for rotation |
| `HOURS_API_URL` | Direct Supabase function URL used as-is; a site root gets `/api/comps` appended |
| `HOURS_API_KEY` | Hours auth |

Optional: `BELGIUMDIA_NATURAL_PATH` / `BELGIUMDIA_LAB_PATH` /
`BELGIUMDIA_WATCH_PATH` override the default endpoint paths.

## CI / schedule

`.github/workflows/lmny-feed-sync.yml`:

- **pull_request** touching `lmny-feeds/` → always dry-run (the PR's CI signal
  *is* the dry-run report).
- **workflow_dispatch** → `mode: dry-run` (default) or `live`.
- **schedule** (daily 04:00 ET) → dry-run until the repo variable
  `LMNY_SYNC_LIVE` is set to `true`. That variable is the rollout gate: flip it
  only after a reviewed dry-run.

Every run writes `out/report.json` (audit trail artifact — counts, hold-reason
histogram, created/updated/archived lists) and renders `out/report.md` into the
Actions run summary.

## Known gaps (deliberate)

- Feed `.mp4` videos are not attached — Shopify requires staged uploads for
  video files (external URLs work for images only). Future work.
- The Belgium Dia adapter's field mapping is defensive (the original adapter
  was lost); the first dry-run against the live API is the contract test.
- Lab markup tiers and the watch brand list in `config/pricing.ts` are
  reconstructions pending review.
