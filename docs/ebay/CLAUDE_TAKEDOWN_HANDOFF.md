# eBay watch takedown — Claude handoff

## Easiest way (do this if you have eBay Seller Hub access)

**Fastest overall: bulk end on eBay, then sync Connect.**

1. **eBay Seller Hub** → Listings → Active → **Export** (CSV with Item ID + SKU).
2. Keep only rows whose SKU is in **`ebay_end_skus.csv`** (640 codes).
3. Remove any SKU in **`ebay_keeper_skus_unique.csv`** (155 codes — **never end these**).
4. Build End CSV:
   ```csv
   Action,Item number,EndingReason
   End,366652915364,NotAvailable
   ```
5. **Seller Hub → Reports → Upload** → template **End listings**.
6. **Marketplace Connect** → same SKUs → **Disabled** → Save (so they don’t relist).

**Time:** ~30–60 minutes. One upload ends hundreds of listings.

---

## If using Marketplace Connect only (browser automation)

**Do NOT** disable by prefix (`T`, `RW`, or numeric) — keepers share prefixes with takedown SKUs.

### Phase 1 — prefix-safe (~72 SKUs)

Search and disable **exact Code** (or verify each row):

- All **`P` + digits** → `docs/ebay/batches/phase1_P_codes.txt` (23 codes)
- All **`U` + digits** → `docs/ebay/batches/phase1_U_codes.txt` (48 codes)
- **`M` + digits** if found (1 code)

Save every 8–10 changes. Wait for **Listings Saved**.

### Phase 2 — batched exact codes (568 SKUs)

Work through **`docs/ebay/batches/batch_01_codes.txt`** … **`batch_13_codes.txt`** (50 codes per file).

For **each Code** in the batch file:

1. Search **exact Code** in Connect grid (one at a time).
2. If **Enabled** → **Disabled**.
3. If already Disabled or not found → skip and log.
4. **Save every 8–10** → wait for Publishing.

**Optional test:** paste multiple codes into the Code filter (space/comma/newline). If Connect only matches one, stay one-at-a-time.

### Never disable (keepers)

File: **`ebay_keeper_skus_unique.csv`**

Includes feed keepers (`3370`, `6198`, `T3431`, `RW3035`, …) and estate **`J`/`RR`** pieces.

**Extra watchlist** — archived on Shopify but still keepers:

- `J10355`, `J10493`, `RR5823`, `RR9291`

---

## Login

1. Clear cookies if rate-limited: `chrome://settings/clearBrowserData` → All time → Cookies + Cache.
2. https://admin.shopify.com/store/laura-milman
3. Email: use store admin credential (provided separately — do not commit).
4. Password: provided separately (never log in chat).

## Connect URL

https://admin.shopify.com/store/laura-milman/apps/shopify-marketplace-connect/332651/ebay/bulk

Add columns: **Code**, **Enabled** / **Listing enabled**.

---

## Files to attach for Claude

| File | Purpose |
|---|---|
| `docs/ebay/ebay_end_skus.csv` | Full takedown list (640) |
| `docs/ebay/ebay_keeper_skus_unique.csv` | Never disable (155) |
| `docs/ebay/batches/batch_XX_codes.txt` | 50 codes per session |
| `docs/ebay/batches/phase1_P_codes.txt` | Phase 1 Power Watch |
| `docs/ebay/batches/phase1_U_codes.txt` | Phase 1 Uncle Manny |

---

## Report back after each batch

- Codes **Disabled + Saved**
- **Already disabled** / **Not found**
- **Remaining** in current batch
- Confirm **zero** keeper SKUs touched

---

## Copy-paste prompt for Claude

```
Task: Disable non-keeper eBay watch listings in Shopify Marketplace Connect.

READ FIRST: docs/ebay/CLAUDE_TAKEDOWN_HANDOFF.md in the repo (or attached).

Easiest path if you have eBay access: bulk End CSV (see handoff doc). Otherwise use Connect below.

RULES:
- NEVER disable SKUs in ebay_keeper_skus_unique.csv (155 keepers).
- NEVER bulk-select by prefix for T, RW, or numeric codes.
- Phase 1: disable all P and U codes from phase1_P_codes.txt and phase1_U_codes.txt.
- Phase 2: work batch_01_codes.txt through batch_13_codes.txt — one exact Code per search.
- Save every 8-10, wait for Listings Saved.
- Do not select all 839 watch rows.

Connect URL:
https://admin.shopify.com/store/laura-milman/apps/shopify-marketplace-connect/332651/ebay/bulk

Login: Shopify admin email + password (provided separately)

Start with batch_01 (or continue phase1 U if P done). Report after each batch.
```
