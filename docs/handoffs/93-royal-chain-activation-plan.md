# Royal Chain activation plan and verifier

This change adds a read-only, checksum-bound plan and independent verifier for
the reviewed Royal Chain scope: **32 products and 93 child SKUs**. It does not
change Shopify, set a product ACTIVE, publish to Online Store, add the `ebay`
tag, or configure Marketplace Connect. Those visibility decisions remain a
person-run review step under the repository playbook.

The worker is `lmny-feeds/scripts/royalchain-activation-plan.ts` and the pure
gates are in `lmny-feeds/src/royalchain/activation.ts`. It reads the exact
JSONL plan, requires a separate `child_sku,available` manifest before proposing
inventory quantities, takes a fresh Shopify catalog read, and writes a private
snapshot with SHA-256 hashes. The snapshot contains public expected fields,
weight and price checks, availability booleans, and cost-presence checks; it
does not write cost values into the report. Supplier-name checks cover public
copy, handles, tags, SEO, metafields, media alt text, and imported media URLs.

Run from `lmny-feeds/`:

```sh
npm run plan:royalchain-activation -- \
  --plan=../../priorities/93-royal-chain-enriched-plan/royalchain-products.jsonl \
  --availability=../../priorities/93-royal-chain-enriched-plan/availability.csv \
  --output-dir=../../priorities/93-royal-chain-activation
```

The command is read-only and exits non-zero when a gate is blocked. It writes
`royal-chain-activation-snapshot.json`,
`royal-chain-activation-report.md`, and
`royal-chain-activation-checklist.md` under the chosen private output folder.
The final person-run verification uses the reviewed snapshot and a new read:

```sh
npm run plan:royalchain-activation -- \
  --verify=../../priorities/93-royal-chain-activation/royal-chain-activation-snapshot.json \
  --output-dir=../../priorities/93-royal-chain-verification
```

The guarded workflow is
`.github/workflows/royalchain-activation-plan.yml`. It is manual, read-only,
defaults to dry-run, requires a private input artifact, and never contains an
apply path. It supports a final independent verification after a person has
completed the Shopify review.

Known gates from the existing handoff are retained: the live draft handoff
reported 21 products while the reviewed enriched plan is 32 products, so the
fresh read must resolve that scope difference; and the source availability
manifest is mandatory because quantity 1 may be proposed only for an explicit
`available=true` child SKU. Media must independently show at least three READY
Shopify CDN images per product before the person removes `media-missing`.
