/**
 * Rewrite the live Jacob & Co. H-24 PDP to the watch listing schema and
 * publish a watch-only Jacob & Co. collection for the Timepieces dropdown.
 *
 * Does not change archive/draft state, does not attach/remove photos, and
 * does not invent Pre-Owned/Unworn. Price is left as currently listed.
 *
 *   npx tsx scripts/fix-jacob-h24-listing.ts --preview
 *   npx tsx scripts/fix-jacob-h24-listing.ts --dry-run
 *   npx tsx scripts/fix-jacob-h24-listing.ts
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { exchangeClientCredentials, ShopifyClient } from '../src/shopify.js';
import {
  JACOB_COLLECTION_HANDLE,
  JACOB_COLLECTION_TITLE,
  JACOB_H24_HANDLE,
  JACOB_H24_SKU,
  buildJacobH24ProductSetInput,
  jacobCoWatchesCollectionInput,
} from '../src/jacobH24Listing.js';

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

async function writePreview(): Promise<void> {
  const input = buildJacobH24ProductSetInput({
    id: 'gid://shopify/Product/preview',
    variantId: 'gid://shopify/ProductVariant/preview',
    price: '8500.00',
  });
  await mkdir('out', { recursive: true });
  await writeFile(
    'out/jacob-h24-listing-preview.json',
    JSON.stringify({ product: input, collection: jacobCoWatchesCollectionInput() }, null, 2),
  );
  console.log(`${input.handle}\t${input.title}\t${input.status}\t${input.productType}`);
  console.log(`Preview written to out/jacob-h24-listing-preview.json`);
}

async function findProduct(
  client: ShopifyClient,
  handle: string,
): Promise<{ id: string; status: string; variantId: string; price: string; sku: string | null } | null> {
  const data = await client.gql<{
    products: {
      nodes: Array<{
        id: string;
        status: string;
        variants: { nodes: Array<{ id: string; price: string; sku: string | null }> };
      }>;
    };
  }>(
    `query($q: String!) {
      products(first: 1, query: $q) {
        nodes {
          id
          status
          variants(first: 1) { nodes { id price sku } }
        }
      }
    }`,
    { q: `handle:${handle}` },
  );
  const product = data.products.nodes[0];
  const variant = product?.variants.nodes[0];
  if (!product || !variant) return null;
  return {
    id: product.id,
    status: product.status,
    variantId: variant.id,
    price: variant.price,
    sku: variant.sku,
  };
}

async function ensureJacobCollection(client: ShopifyClient): Promise<{ handle: string; created: boolean; published: boolean }> {
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
    return { handle: match.handle, created: false, published: true };
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
  return { handle: collection.handle, created: true, published: true };
}

async function main() {
  const previewOnly = process.argv.includes('--preview');
  if (previewOnly) {
    await writePreview();
    return;
  }

  const dryRun = process.argv.includes('--dry-run');
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN is not set');

  const client = new ShopifyClient(domain, await resolveToken(domain));
  const { shop } = await client.verifyAuth();
  console.log(`Jacob H-24 listing → ${shop} (${dryRun ? 'DRY RUN' : 'LIVE'})`);

  const existing = await findProduct(client, JACOB_H24_HANDLE);
  if (!existing) throw new Error(`Product handle ${JACOB_H24_HANDLE} was not found`);
  if (existing.status !== 'ACTIVE' && existing.status !== 'DRAFT') {
    throw new Error(`Refusing to rewrite ${JACOB_H24_HANDLE} in status ${existing.status}`);
  }

  const input = buildJacobH24ProductSetInput({
    id: existing.id,
    variantId: existing.variantId,
    price: existing.price,
    sku: existing.sku || JACOB_H24_SKU,
  });
  // Never activate an archived product; never demote a live piece to draft.
  if (existing.status === 'DRAFT') input.status = 'DRAFT';

  await mkdir('out', { recursive: true });
  await writeFile('out/jacob-h24-listing.json', JSON.stringify({ shop, dryRun, existing, input }, null, 2));

  if (dryRun) {
    console.log(`Dry run: would update ${JACOB_H24_HANDLE} and ensure /collections/${JACOB_COLLECTION_HANDLE}`);
    return;
  }

  const result = await client.productSet(input);
  if (result.errors.length) {
    throw new Error(`productSet ${JACOB_H24_HANDLE}: ${result.errors.join('; ')}`);
  }
  const collection = await ensureJacobCollection(client);
  console.log(`updated ${JACOB_H24_HANDLE} — ${input.title}`);
  console.log(
    `${collection.created ? 'created' : 'existing'} collection /collections/${collection.handle} (published=${collection.published})`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
