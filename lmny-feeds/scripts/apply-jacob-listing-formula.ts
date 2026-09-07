/**
 * Apply the New Vintage watch listing formula to live Jacob & Co. PDPs and
 * activate remaining memo watches that are not already on the storefront.
 *
 * Photographed products keep their live handles, photos, and merchant prices.
 * Epic I (not live) is created as `jc-90814519`. Diamond bezels stay bundled
 * into the combo listings — they are not created as standalone products.
 *
 *   npx tsx scripts/apply-jacob-listing-formula.ts --preview
 *   npx tsx scripts/apply-jacob-listing-formula.ts --dry-run
 *   npx tsx scripts/apply-jacob-listing-formula.ts
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { exchangeClientCredentials, ShopifyClient } from '../src/shopify.js';
import {
  JACOB_COLLECTION_HANDLE,
  JACOB_COLLECTION_TITLE,
  JACOB_MEMO_ITEMS,
  JACOB_VENDOR,
  LIVE_JACOB_WATCHES,
  buildJacobMemoProductSetInput,
  buildLiveJacobProductSetInput,
  handleForItem,
  isJacobWatchDraft,
  jacobCoCollectionInput,
  memoWatchesNotYetLive,
  shouldCreateMemoItem,
  skuForLiveWatch,
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
  variants: {
    nodes: Array<{
      id: string;
      price: string;
      sku?: string | null;
      inventoryQuantity?: number | null;
    }>;
  };
};

async function findProduct(client: ShopifyClient, handle: string): Promise<ProductHit | null> {
  const data = await client.gql<{ products: { nodes: ProductHit[] } }>(
    `query($q: String!) {
      products(first: 1, query: $q) {
        nodes {
          id handle status productType vendor tags
          variants(first: 5) {
            nodes { id price sku inventoryQuantity }
          }
        }
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
          nodes {
            id handle status productType vendor tags
            variants(first: 1) { nodes { id price sku inventoryQuantity } }
          }
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
  action: string;
  handle: string;
  title: string;
  status: string;
  price: string;
  sku: string;
  condition: string;
  tags?: string[];
  skipped?: string;
};

function metafieldCondition(input: Record<string, unknown>): string {
  return (
    (input.metafields as Array<{ namespace: string; key: string; value: string }>).find(
      (m) => m.namespace === 'custom' && m.key === 'condition',
    )?.value ?? ''
  );
}

async function writePreviewPayloads(): Promise<PreviewRow[]> {
  const rows: PreviewRow[] = [];
  for (const entry of LIVE_JACOB_WATCHES) {
    const input = buildLiveJacobProductSetInput(entry, {
      productId: 'gid://shopify/Product/preview',
      variantId: 'gid://shopify/ProductVariant/preview',
      price: '(keep live)',
    });
    rows.push({
      action: 'rewrite-live',
      handle: entry.handle,
      title: String(input.title),
      status: String(input.status),
      price: '(keep live)',
      sku: skuForLiveWatch(entry),
      condition: metafieldCondition(input),
      tags: input.tags as string[],
    });
  }
  for (const item of JACOB_MEMO_ITEMS) {
    if (!shouldCreateMemoItem(item)) {
      rows.push({
        action: 'skip-create',
        handle: handleForItem(item),
        title: String(buildJacobMemoProductSetInput(item).title),
        status: statusForItem(item),
        price: '',
        sku: item.itemNumber,
        condition: '',
        skipped: item.kind === 'part' ? 'bundled into a live combo listing' : 'already live with photos',
      });
      continue;
    }
    const input = buildJacobMemoProductSetInput(item);
    const variant = (input.variants as Array<{ price: string; sku: string }>)[0]!;
    rows.push({
      action: item.kind === 'watch' ? 'create-or-activate' : 'create-draft',
      handle: handleForItem(item),
      title: String(input.title),
      status: String(input.status),
      price: variant.price,
      sku: variant.sku,
      condition: metafieldCondition(input),
    });
  }
  await mkdir('out', { recursive: true });
  await writeFile('out/jacob-listing-formula-preview.json', JSON.stringify(rows, null, 2));
  return rows;
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
    { input: jacobCoCollectionInput() },
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

async function activateDraft(client: ShopifyClient, product: { id: string }): Promise<string[]> {
  const data = await client.gql<{ productUpdate: { userErrors: Array<{ message: string }> } }>(
    `mutation($product: ProductUpdateInput!) {
      productUpdate(product: $product) { userErrors { message } }
    }`,
    { product: { id: product.id, status: 'ACTIVE' } },
  );
  return data.productUpdate.userErrors.map((e) => e.message);
}

async function writeProduct(
  client: ShopifyClient,
  input: Record<string, unknown>,
  publicationId: string | null,
  activate: boolean,
): Promise<string[]> {
  const result = await client.productSet(input);
  if (result.errors.length) return result.errors;
  if (result.id && publicationId && activate) {
    const pubErrors = await client.publishResource(result.id, publicationId);
    return pubErrors.map((e) => `publish: ${e}`);
  }
  return [];
}

async function main() {
  const previewOnly = process.argv.includes('--preview');
  if (previewOnly) {
    const preview = await writePreviewPayloads();
    console.log(`Preview: ${preview.length} rows. Live PDPs rewritten in place; remaining watches activated.`);
    for (const row of preview) {
      const skip = row.skipped ? `\tSKIP ${row.skipped}` : '';
      console.log(`${row.action}\t${row.handle}\t${row.status}\t${row.price}\t${row.title}${skip}`);
    }
    return;
  }

  const dryRun = process.argv.includes('--dry-run');
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN is not set');

  const client = new ShopifyClient(domain, await resolveToken(domain));
  const { shop } = await client.verifyAuth();
  console.log(`Jacob listing formula → ${shop} (${dryRun ? 'DRY RUN' : 'LIVE'}) vendor=${JACOB_VENDOR}`);

  const scopes = dryRun ? [] : await client.grantedScopes();
  const canWriteInventory = scopes.includes('write_inventory');
  const locationId = canWriteInventory || dryRun ? await primaryLocationId(client) : undefined;
  if (locationId) console.log(`Inventory location: ${locationId}`);
  if (!dryRun && !canWriteInventory) {
    console.warn('write_inventory is not granted — listings still write; qty is omitted.');
  }

  const publicationId = dryRun ? null : await client.onlineStorePublicationId();
  const rewritten: string[] = [];
  const created: string[] = [];
  const updated: string[] = [];
  const activated: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  const preview: PreviewRow[] = [];
  const writtenIds = new Set<string>();
  const liveHandles = new Set(LIVE_JACOB_WATCHES.map((e) => e.handle));

  for (const entry of LIVE_JACOB_WATCHES) {
    if (dryRun) {
      preview.push({
        action: 'rewrite-live',
        handle: entry.handle,
        title: String(
          buildLiveJacobProductSetInput(entry, {
            productId: 'gid://shopify/Product/preview',
            variantId: 'gid://shopify/ProductVariant/preview',
            price: '(keep live)',
          }).title,
        ),
        status: 'ACTIVE',
        price: '(keep live)',
        sku: skuForLiveWatch(entry),
        condition: 'New Vintage',
      });
      continue;
    }

    const existing = await findProduct(client, entry.handle);
    if (!existing) {
      errors.push(`${entry.handle}: live product not found`);
      continue;
    }
    if (existing.status === 'ARCHIVED') {
      errors.push(`${entry.handle}: refusing to touch ARCHIVED product`);
      continue;
    }
    const variant = existing.variants.nodes[0];
    if (!variant) {
      errors.push(`${entry.handle}: no variant`);
      continue;
    }
    const input = buildLiveJacobProductSetInput(entry, {
      productId: existing.id,
      variantId: variant.id,
      price: variant.price,
      inventoryQuantity: variant.inventoryQuantity ?? undefined,
      locationId: canWriteInventory ? locationId : undefined,
    });
    preview.push({
      action: 'rewrite-live',
      handle: entry.handle,
      title: String(input.title),
      status: String(input.status),
      price: variant.price,
      sku: skuForLiveWatch(entry),
      condition: metafieldCondition(input),
    });
    const writeErrors = await writeProduct(client, input, publicationId, true);
    if (writeErrors.length) {
      errors.push(`${entry.handle}: ${writeErrors.join('; ')}`);
      continue;
    }
    writtenIds.add(existing.id);
    rewritten.push(entry.handle);
    console.log(`rewrote ${entry.handle} — ${input.title} @ ${variant.price}`);
  }

  for (const item of JACOB_MEMO_ITEMS) {
    const handle = handleForItem(item);
    if (!shouldCreateMemoItem(item)) {
      skipped.push(handle);
      preview.push({
        action: 'skip-create',
        handle,
        title: '',
        status: statusForItem(item),
        price: '',
        sku: item.itemNumber,
        condition: '',
        skipped: item.kind === 'part' ? 'bundled into a live combo listing' : 'already live with photos',
      });
      continue;
    }
    const input = buildJacobMemoProductSetInput(item, {
      locationId: canWriteInventory ? locationId : undefined,
    });
    const variant = (input.variants as Array<{ price: string; sku: string }>)[0]!;
    preview.push({
      action: item.kind === 'watch' ? 'create-or-activate' : 'create-draft',
      handle,
      title: String(input.title),
      status: String(input.status),
      price: variant.price,
      sku: variant.sku,
      condition: metafieldCondition(input),
    });
    if (dryRun) continue;

    const existing = await findProduct(client, handle);
    if (existing?.status === 'ARCHIVED') {
      errors.push(`${handle}: refusing to touch ARCHIVED product`);
      continue;
    }
    if (existing) input.id = existing.id;
    const writeErrors = await writeProduct(client, input, publicationId, statusForItem(item) === 'ACTIVE');
    if (writeErrors.length) {
      errors.push(`${handle}: ${writeErrors.join('; ')}`);
      continue;
    }
    const id = existing?.id;
    if (id) writtenIds.add(id);
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
      if (liveHandles.has(draft.handle)) continue;
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

  const remaining = memoWatchesNotYetLive().map((i) => handleForItem(i));
  const summary = {
    shop,
    dryRun,
    rewritten,
    created,
    updated,
    activated,
    skipped,
    remainingNewWatches: remaining,
    errors,
    preview,
  };
  await mkdir('out', { recursive: true });
  await writeFile('out/jacob-listing-formula.json', JSON.stringify(summary, null, 2));
  console.log(
    dryRun
      ? `Dry run: ${preview.length} rows prepared (${skipped.length} skipped creates). See out/jacob-listing-formula.json`
      : `Done: rewrote=${rewritten.length} created=${created.length} updated=${updated.length} activated=${activated.length} skipped=${skipped.length} errors=${errors.length}`,
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
