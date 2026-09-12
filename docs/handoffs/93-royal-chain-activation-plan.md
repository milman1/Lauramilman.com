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

## Temporary private input staging

`.github/workflows/royalchain-stage-activation-input.yml` is the only workflow
that stages the private plan. It is manual-only, accepts a validated
`bundle_ref`, and sparse-checks out only this fixed encrypted path from that
ref:

```text
.private/royalchain/activation-bundle.enc
```

The Actions secret `LMNY_CHAIN_PLAN_KEY` is used only in the decrypt step. The
workflow keeps decrypted material under `$RUNNER_TEMP`, requires an encrypted
gzip tar payload containing exactly these two regular root files, and validates
the 32-product / 93-SKU plan plus exact per-SKU availability keys before
uploading the one-day artifact
`royalchain-activation-input-${GITHUB_RUN_ID}`. It never prints file contents,
costs, source URLs, or plan rows and does not receive Shopify secrets.

The exact bundle format is a gzip tar with only
`royalchain-products.jsonl` and `availability.csv` at its root. The tarball is
wrapped by `lmny-feeds/scripts/royalchain-bundle-crypto.ts` in an authenticated
AES-256-GCM envelope with a fresh random salt and IV, explicit scrypt
parameters, and a fixed magic/version header. Create it locally, outside the
repository, with a temporary key file containing the random secret value:

```sh
tmp_dir="$(mktemp -d)"
cp /private/path/royalchain-products.jsonl "$tmp_dir/royalchain-products.jsonl"
cp /private/path/availability.csv "$tmp_dir/availability.csv"
tar --format=ustar --owner=0 --group=0 --numeric-owner \
  -czf "$tmp_dir/royalchain-activation-input.tar.gz" \
  -C "$tmp_dir" royalchain-products.jsonl availability.csv
npx tsx lmny-feeds/scripts/royalchain-bundle-crypto.ts encrypt \
  --input="$tmp_dir/royalchain-activation-input.tar.gz" \
  --output=/private/path/activation-bundle.enc \
  --key-file=/private/path/lmny-chain-plan-key
rm -rf "$tmp_dir"
```

The Actions workflow decrypts with the matching command:

```sh
npx tsx lmny-feeds/scripts/royalchain-bundle-crypto.ts decrypt \
  --input="$GITHUB_WORKSPACE/bundle-ref/.private/royalchain/activation-bundle.enc" \
  --output="$RUNNER_TEMP/lmny-chain-input.tar.gz" \
  --key-file="$RUNNER_TEMP/lmny-chain-plan-key"
```

Authentication completes before the decrypted bytes are written; malformed,
tampered, truncated, and wrong-key envelopes produce one generic failure and
leave no plaintext output.

Commit only `activation-bundle.enc` at the fixed path on the selected bundle
ref. After the staging run and review, delete the temporary encrypted bundle
ref and rotate or remove `LMNY_CHAIN_PLAN_KEY`; the short artifact retention
does not replace that cleanup. Never paste the key, plan, cost data, or source
URLs into workflow inputs or repository files.

Known gates from the existing handoff are retained: the live draft handoff
reported 21 products while the reviewed enriched plan is 32 products, so the
fresh read must resolve that scope difference; and the source availability
manifest is mandatory because quantity 1 may be proposed only for an explicit
`available=true` child SKU. Media must independently show at least three READY
Shopify CDN images per product before the person removes `media-missing`.
