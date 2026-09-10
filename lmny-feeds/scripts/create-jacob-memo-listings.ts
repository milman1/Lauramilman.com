/**
 * Create or update Jacob & Co. memo listings and activate every Jacob watch
 * that is still a draft. Photos come later — watches are ACTIVE with
 * `media-missing`. Accessories stay DRAFT. The already-photographed H-24 is
 * not duplicated.
 *
 *   npx tsx scripts/create-jacob-memo-listings.ts --preview
 *   npx tsx scripts/create-jacob-memo-listings.ts --dry-run
 *   npx tsx scripts/create-jacob-memo-listings.ts
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { exchangeClientCredentials, ShopifyClient } from '../src/shopify.js';
import {
  ALREADY_LIVE_WITH_PHOTOS,
  JACOB_COLLECTION_HANDLE,
  JACOB_COLLECTION_TITLE,
  JACOB_MEMO_ITEMS,
  JACOB_VENDOR,
  buildJacobMemoProductSetInput,
  handleForItem,
  isJacobWatchDraft,
  jacobCoWatchesCollectionInput,
  statusForItem,
} from '../src/jacobMemoListings.js';

async function resolveToken(domain: string): Promise<string> {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (clientId && clientSecret) {
    const { token } = await exchangeClientCredentials(domain, clientId, clientSecret);
    return token;
  }
  throw new Error('Set SHOPIFY_ADMIN_TOKEN, or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET');
}

type ProductHit = {
  id: string;
  handle: string;
  status: string;
  productType: string;
  vendor: string;
  tags: string[];
};

async function findProduct(client: ShopifyClient, handle: string): Promise<ProductHit | null> {
  const data = await client.gql<{ products: { nodes: ProductHit[] } }>(
    `query($q: String!) {
      products(first: 1, query: $q) {
        nodes { id handle status productType vendor tags }
      }
    }`,
    { q: `handle:${handle}` },
  );
  return data.products.nodes[0] ?? null;
}

async function listJacobWatchDrafts(client: ShopifyClient): Promise<ProductHit[]> {
  const hits: ProductHit[] = [];
  let cursor: string | null = null;
  for (;;) {
    const data = await client.gql<{
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: ProductHit[];
      };
    }>(
      `query($cursor: String) {
        products(first: 50, after: $cursor, query: "status:draft") {
          pageInfo { hasNextPage endCursor }
          nodes { id handle status productType vendor tags }
        }
      }`,
      { cursor },
    );
    for (const node of data.products.nodes) {
      if (isJacobWatchDraft(node)) hits.push(node);
    }
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return hits;
}

async function primaryLocationId(client: ShopifyClient): Promise<string | undefined> {
  const override = process.env.SHOPIFY_LOCATION_ID?.trim();
  if (override) {
    return override.startsWith('gid://') ? override : `gid://shopify/Location/${override}`;
  }
  try {
    const data = await client.gql<{
      locations: { nodes: Array<{ id: string; isActive: boolean }> };
    }>(`{ locations(first: 20, includeLegacy: true) { nodes { id isActive } } }`);
    return data.locations.nodes.find((l) => l.isActive)?.id ?? data.locations.nodes[0]?.id;
  } catch {
    return undefined;
  }
}

type PreviewRow = {
  handle: string;
  title: string;
  status: string;
  price: string;
  compareAtPrice: string;
  sku: string;
  condition: string;
  skipped?: string;
};

function listingPreview(
  item: (typeof JACOB_MEMO_ITEMS)[number],
  input: Record<string, unknown>,
  skipped?: string,
): PreviewRow {
  const variant = (input.variants as Array<{ price: string; compareAtPrice: string; sku: string }>)[0]!;
  const condition =
    (input.metafields as Array<{ namespace: string; key: string; value: string }>).find(
      (m) => m.namespace === 'custom' && m.key === 'condition',
    )?.value ?? '';
  return {
    handle: handleForItem(item),
    title: String(input.title),
    status: String(input.status),
    price: variant.price,
    compareAtPrice: variant.compareAtPrice,
    sku: variant.sku,
    condition,
    skipped,
  };
}

async function writePreviewPayloads(): Promise<PreviewRow[]> {
  const listings = JACOB_MEMO_ITEMS.map((item) => {
    const skipped = ALREADY_LIVE_WITH_PHOTOS.has(item.itemNumber)
      ? 'already live with photos'
      : undefined;
    const input = buildJacobMemoProductSetInput(item);
    return listingPreview(item, input, skipped);
  });
  await mkdir('out', { recursive: true });
  await writeFile('out/jacob-memo-listing-preview.json', JSON.stringify(listings, null, 2));
  return listings;
}

async function ensureJacobCollection(client: ShopifyClient): Promise<{ handle: string; created: boolean }> {
  const existing = await client.gql<{
    collections: {
      nodes: Array<{
        id: string;
        title: string;
        handle: string;
        resourcePublications: { nodes: Array<{ isPublished: boolean }> };
      }>;
    };
  }>(
    `query($q: String!) {
      collections(first: 10, query: $q) {
        nodes {
          id title handle
          resourcePublications(first: 10) { nodes { isPublished } }
        }
      }
    }`,
    { q: `handle:${JACOB_COLLECTION_HANDLE}` },
  );
  const match =
    existing.collections.nodes.find((c) => c.handle === JACOB_COLLECTION_HANDLE) ??
    existing.collections.nodes.find((c) => c.title === JACOB_COLLECTION_TITLE);
  const publicationId = await client.onlineStorePublicationId();
  if (match) {
    const published = match.resourcePublications.nodes.some((p) => p.isPublished);
    if (!published) {
      const errors = await client.publishResource(match.id, publicationId);
      if (errors.length) throw new Error(`publish ${match.handle}: ${errors.join('; ')}`);
    }
    return { handle: match.handle, created: false };
  }
  const data = await client.gql<{
    collectionCreate: { collection: { id: string; handle: string } | null; userErrors: Array<{ message: string }> };
  }>(
    `mutation($input: CollectionInput!) {
      collectionCreate(input: $input) { collection { id handle } userErrors { message } }
    }`,
    { input: jacobCoWatchesCollectionInput() },
  );
  if (data.collectionCreate.userErrors.length) {
    throw new Error(`collectionCreate: ${data.collectionCreate.userErrors.map((e) => e.message).join('; ')}`);
  }
  const collection = data.collectionCreate.collection;
  if (!collection) throw new Error('collectionCreate returned no collection');
  const errors = await client.publishResource(collection.id, publicationId);
  if (errors.length) throw new Error(`publish ${collection.handle}: ${errors.join('; ')}`);
  return { handle: collection.handle, created: true };
}

async function activateDraft(client: ShopifyClient, product: ProductHit): Promise<string[]> {
  const data = await client.gql<{ productUpdate: { userErrors: Array<{ message: string }> } }>(
    `mutation($product: ProductUpdateInput!) {
      productUpdate(product: $product) { userErrors { message } }
    }`,
    { product: { id: product.id, status: 'ACTIVE' } },
  );
  return data.productUpdate.userErrors.map((e) => e.message);
}

async function main() {
  const previewOnly = process.argv.includes('--preview');
  if (previewOnly) {
    const preview = await writePreviewPayloads();
    console.log(`Preview: ${preview.length} listings. Watches ACTIVE (photos later). Accessories DRAFT.`);
    for (const row of preview) {
      const skip = row.skipped ? `\tSKIP ${row.skipped}` : '';
      console.log(`${row.handle}\t${row.status}\t${row.price}\t${row.title}${skip}`);
    }
    return;
  }

  const dryRun = process.argv.includes('--dry-run');
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN is not set');

  const client = new ShopifyClient(domain, await resolveToken(domain));
  const { shop } = await client.verifyAuth();
  console.log(`Jacob memo listings → ${shop} (${dryRun ? 'DRY RUN' : 'LIVE'}) vendor=${JACOB_VENDOR}`);

  const scopes = dryRun ? [] : await client.grantedScopes();
  const canWriteInventory = scopes.includes('write_inventory');
  const locationId = canWriteInventory || dryRun ? await primaryLocationId(client) : undefined;
  if (locationId) console.log(`Inventory location: ${locationId}`);
  if (!dryRun && !canWriteInventory) {
    console.warn('write_inventory is not granted — listings still create; qty 1 is omitted.');
  }

  const publicationId = dryRun ? null : await client.onlineStorePublicationId();
  const created: string[] = [];
  const updated: string[] = [];
  const activated: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  const preview: PreviewRow[] = [];
  const writtenIds = new Set<string>();

  for (const item of JACOB_MEMO_ITEMS) {
    const handle = handleForItem(item);
    const input = buildJacobMemoProductSetInput(item, {
      locationId: canWriteInventory ? locationId : undefined,
    });
    if (ALREADY_LIVE_WITH_PHOTOS.has(item.itemNumber)) {
      preview.push(listingPreview(item, input, 'already live with photos'));
      skipped.push(handle);
      console.log(`skip ${handle} — already live with photos`);
      continue;
    }
    preview.push(listingPreview(item, input));

    if (dryRun) continue;

    const existing = await findProduct(client, handle);
    if (existing) {
      if (existing.status === 'ARCHIVED') {
        errors.push(`${handle}: refusing to touch ARCHIVED product`);
        continue;
      }
      input.id = existing.id;
    }

    const result = await client.productSet(input);
    if (result.errors.length) {
      errors.push(`${handle}: ${result.errors.join('; ')}`);
      continue;
    }
    const id = result.id ?? existing?.id;
    if (id) writtenIds.add(id);
    if (id && publicationId && statusForItem(item) === 'ACTIVE') {
      const pubErrors = await client.publishResource(id, publicationId);
      if (pubErrors.length) errors.push(`${handle} publish: ${pubErrors.join('; ')}`);
    }
    if (existing) {
      updated.push(handle);
      console.log(`updated ${handle} — ${input.title} (${input.status})`);
    } else {
      created.push(handle);
      console.log(`created ${handle} — ${input.title} (${input.status})`);
    }
  }

  if (!dryRun) {
    const drafts = await listJacobWatchDrafts(client);
    for (const draft of drafts) {
      if (writtenIds.has(draft.id)) continue;
      if (ALREADY_LIVE_WITH_PHOTOS.has(draft.handle.replace(/^jc-/, ''))) continue;
      const activateErrors = await activateDraft(client, draft);
      if (activateErrors.length) {
        errors.push(`${draft.handle}: ${activateErrors.join('; ')}`);
        continue;
      }
      if (publicationId) {
        const pubErrors = await client.publishResource(draft.id, publicationId);
        if (pubErrors.length) errors.push(`${draft.handle} publish: ${pubErrors.join('; ')}`);
      }
      activated.push(draft.handle);
      console.log(`activated draft ${draft.handle}`);
    }
    const collection = await ensureJacobCollection(client);
    console.log(`${collection.created ? 'created' : 'existing'} /collections/${collection.handle}`);
  }

  const summary = { shop, dryRun, created, updated, activated, skipped, errors, preview };
  await mkdir('out', { recursive: true });
  await writeFile('out/jacob-memo-listings.json', JSON.stringify(summary, null, 2));
  console.log(
    dryRun
      ? `Dry run: ${preview.length} listings prepared (${skipped.length} skipped). See out/jacob-memo-listings.json`
      : `Done: created=${created.length} updated=${updated.length} activated=${activated.length} skipped=${skipped.length} errors=${errors.length}`,
  );
  if (errors.length) {
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
