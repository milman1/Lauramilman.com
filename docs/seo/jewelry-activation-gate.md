# Shared jewelry intake and activation gate

Applies to every model working in this repository. Read the
[finished-jewelry checklist](finished-jewelry-activation-checklist.md) first.
Scope: finished house jewelry, chains, lab-grown finished pieces and ring
settings. Watches, loose stones, vintage, estate and pre-owned products use
their existing workflows. Never activate unrelated existing drafts or archives.

## Workflow

From `lmny-feeds`, run `npm ci`. Use environment credentials:
`SHOPIFY_STORE_DOMAIN` and either `SHOPIFY_ADMIN_TOKEN` or
`SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET`. Do not paste credentials into
chat, input JSON, git, logs, or public Actions artifacts. Review snapshots
include supplier cost: keep all inputs and outputs in restricted storage.

1. Prepare the exact source facts and optimized copy under the checklist.
   Do not create unresolved Review rows. For API creation, prepare one
   [ProductSetInput](https://shopify.dev/docs/api/admin-graphql/2026-01/input-objects/ProductSetInput)
   JSON object with explicit `status: "DRAFT"`, handle, title, descriptionHtml,
   seo, specific productType, category GID, verified custom.metal, options and
   variants with SKUs/prices. No product ID and no ebay tag. Run:

   ```sh
   npm run jewelry:gate -- draft --input=/private/product-set.json
   ```

   This performs structural preflight, creates only a draft and independently
   verifies its status. It never upserts a product by identifier. If a create
   times out or readback fails, inspect the saved handle before retrying;
   creation is not idempotent. Existing drafts are edited separately while
   remaining DRAFT, then reviewed below.

   For CSV uploads, use `npm run validate:jewelry-csv -- /private/products.csv`
   before import. Every product must explicitly be `draft` and `Published=false`,
   with no ebay tag. The check covers copy, category, every variant SKU/price,
   tracked nonnegative inventory, three distinct images and their alt text.
   Use the API path for made-to-order inventory. CSV preflight is not full
   activation approval. Do not use CSV overwrite to edit live products.

2. Finish source-specific prices, all six applicable spec fields, category,
   variant options, real availability and attached Shopify media. Lab-grown
   finished pieces are **2× verified cost, rounded to cents**; settings remain
   **3× cost, rounded to dollars**. Royal Chain stays **3×, rounded up to $5**.
   House fine jewelry is merchant-priced. Missing cost blocks formula-priced
   activation. Check exact supplier-to-SKU/eBay identifier mapping in review.
   At least three accurate photos need descriptive alt text. Skylab requires
   its matching video; all video belongs first in Shopify media, never the body.

3. Generate a fresh private snapshot and blank review for one exact product:

   ```sh
   npm run jewelry:gate -- plan --id=gid://shopify/Product/123 --out=/private/review.json
   ```

   The command also saves `/private/review.json.snapshot.json`. It deliberately
   leaves review evidence blank. Fill `kind` (`lab-grown`, `setting`,
   `royal-chain`, `house`), `source`, exact `sourceEvidence`, `reviewedBy` and
   every `checks` entry with a concrete record or observation. Check the
   saved snapshot against source facts and the desktop/mobile draft preview.
   Include weight basis, diamond origin, all variants/specs, price, stock or
   memo availability, policy applicability, matching media, taxonomy/SKU,
   theme-generated Product/Offer data and intended canonical/indexability.
   Do not claim a draft is publicly indexed. For made-to-order variants,
   `madeToOrder` maps exact variant IDs to evidence; Shopify must also allow
   selling that inventory configuration. Record the merchant's actual exact
   scope instruction in `merchantAuthorization`; a passed check is not consent.

4. Check without writes, then activate only the authorized product:

   ```sh
   npm run jewelry:gate -- check --review=/private/review.json
   npm run jewelry:gate -- activate --review=/private/review.json
   ```

   Both re-read Shopify. The review binds to the shop ID, product ID and a
   SHA-256 of the saved fields, all variants, costs, media order and metafields.
   It expires within 24 hours. Any change requires a new plan and review.
   Products with more than 250 variants/media/metafields are blocked as partial
   reads; extend the reader before approving them, never remove the check.
   A failure leaves the product unactivated unless the mutation was already
   sent; mutation/readback errors explicitly require inspecting current state
   before any retry. The only activation write is that product's status.

5. Independently verified ACTIVE is not the same as newly published. The gate
   does not change channel assignments, marketplace flags, stock, price, or
   copy. Existing channel assignments can make a product visible when activated;
   account for them in the merchant's scope and preview review. After separately
   authorized publication, verify public page, canonical, schema, availability,
   collections/internal links, sitemap and relevant merchant feeds. SEO does
   not guarantee Google or AI rankings/citations.

## What is enforced, and what is not

The draft command rejects ACTIVE creation. The activation command refuses
invalid copy, missing required data/media, wrong formula prices, incomplete
reads, absent review evidence, expired or changed snapshots, and anything
other than DRAFT. Factual interpretation and presentation checks need actual
review; text evidence is an attestation, not a cryptographic human signature.

This is an executable shared workflow, **not a Shopify-wide interception
service**. Other chat apps, direct Admin edits, CSV import without preflight,
and apps with their own write credentials can bypass it. A model must receive
this repository's instructions and use these commands. An independent chat
does not automatically receive them. Never claim that installing the Shopify
plugin makes it follow this gate.

For non-bypassable cross-app enforcement, route product writes through a
controlled service running this validator and remove direct product-write
access from upload clients. That service, credential migration and Shopify
staff/app access restrictions are not installed by this change. Do not revoke
working feed integrations as a shortcut. The API status mutation does not
provide compare-and-swap here: avoid concurrent editors during activation;
fresh reads and readback detect changes but cannot make independent writes
atomic. This workflow also does not intercept later edits to active products.

## Verification and maintenance

Run `npm test -- --run test/jewelry-gate.test.ts test/jewelryCsv.test.ts test/pricing-ssot.test.ts`.
The existing pull-request feed workflow runs the full test suite. The legacy
`validateJewelryCsv(text, 'marketplace-audit')` library option remains for
read-only audits; the upload CLI always selects the draft preflight.

API operations use [Product](https://shopify.dev/docs/api/admin-graphql/2026-01/objects/Product)
and [productUpdate](https://shopify.dev/docs/api/admin-graphql/2026-01/mutations/productUpdate).
The six existing custom specs are read, not redefined by this gate. Never
publish snapshots, costs or source evidence as product custom fields.
