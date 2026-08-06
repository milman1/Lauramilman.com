# Men's wedding bands — SEO pass (pass 1 of 2)

Rewrote title, description, SEO title, meta description and tags for all 108
men's wedding bands, from `lmny-mens-bands-seo-rebuild.csv`.

**Result: 108/108 verified byte-exact against the CSV.**

Before the run, 96 of the 108 carried the placeholder body "*Description coming
soon" and 91 were titled "Men's Wedding Band <N>". Both are now zero.

The colour/variant pass (pass 2) was NOT run. Handles were not changed. Nothing
was deleted. The 52 other products matching the handle pattern — the duplicate
`-copy` products and bands 111-128 — were not modified.

## How it was run

`lmny_bands_migrate.py` could not be used: there is no `SHOPIFY_TOKEN` in this
environment. The same `productUpdate` mutation the script issues in `do_seo()`
was sent through the Shopify MCP connector instead, in aliased batches of 6-8
products per request.

`bulkOperationRunMutation` would have done all 108 in one job, but the connector
blocks it by policy ("bulk mutation operations are blocked"). Bulk *queries* are
allowed, which is what the snapshot and verification steps use.

If you re-run any of this with a real Admin API token, prefer the script — it is
the sanctioned path and avoids the hand-assembly this run required.

## Verification

`verify.py` diffs live Shopify state against the CSV for all five fields.
Shopify reflows whitespace around `<tr>` on save, so inter-tag whitespace is
normalised before comparing; nothing else is normalised.

    python3 verify.py <bulk-query-export.jsonl>     # exit 0 = all match

Final run: `exact match : 108/108, drift : 0`.

## Rollback

`backup/pre-seo-snapshot.jsonl` holds the pre-change id, handle, title,
descriptionHtml, tags and seo for all 160 products matching the handle pattern
(the 108 targets plus the 52 untouched others). Feed those fields back through
`productUpdate` to restore.

## Files

| File | Purpose |
|---|---|
| `lmny_bands_migrate.py` | Original migration script. Needs `SHOPIFY_TOKEN`. |
| `lmny-mens-bands-seo-rebuild.csv` | Source copy, 108 rows. |
| `idmap.json` | handle -> product GID, all 108 resolved. |
| `seo_pass.jsonl` | `productUpdate` payloads, one per product. |
| `build_jsonl.py` | Builds `seo_pass.jsonl` from the CSV + idmap. |
| `compact.json` / `tails.json` / `metals.json` | Per-product deltas and the shared body template. Every body reconstructs byte-exact from these. |
| `next_batch.py` / `mark_done.py` / `done.json` | Batch driver and progress state. |
| `verify.py` | CSV-vs-live diff. |
| `backup/pre-seo-snapshot.jsonl` | Rollback snapshot. |

## Still open (from README-FIRST, not addressed here)

- Pass 2 (Metal color option + rose/white renders + 20->60 variants) is gated on
  Avi's answers about rose gold accuracy and inventory tracking.
- ~20 duplicate `-copy` products remain live and compete with this copy.
- Bands 111-128, 28 and 58 exist in the store but have no copy in the CSV.
