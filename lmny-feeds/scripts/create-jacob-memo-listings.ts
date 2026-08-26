/**
 * Create or update Jacob & Co. memo listings in Shopify.
 *
 * Existing handles are updated in place (price, copy, condition) so a
 * re-run applies later memo corrections without duplicating products.
 *
 *   npx tsx scripts/create-jacob-memo-listings.ts --preview
 *   npx tsx scripts/create-jacob-memo-listings.ts --dry-run
 *   npx tsx scripts/create-jacob-memo-listings.ts
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { exchangeClientCredentials, ShopifyClient } from '../src/shopify.js';
import {
  JACOB_MEMO_ITEMS,
  buildJacobMemoProductSetInput,
  handleForItem,
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

async function findProductId(client: ShopifyClient, handle: string): Promise<string | null> {
  const data = await client.gql<{
    products: { nodes: Array<{ id: string; handle: string }> };
  }>(
    `query($q: String!) {
      products(first: 1, query: $q) { nodes { id handle } }
    }`,
    { q: `handle:${handle}` },
  );
  return data.products.nodes[0]?.id ?? null;
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
};

function listingPreview(item: (typeof JACOB_MEMO_ITEMS)[number], input: Record<string, unknown>): PreviewRow {
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
  };
}

async function writePreviewPayloads(): Promise<PreviewRow[]> {
  const listings = JACOB_MEMO_ITEMS.map((item) => {
    const input = buildJacobMemoProductSetInput(item);
    return { item: listingPreview(item, input), input };
  });
  await mkdir('out', { recursive: true });
  await writeFile(
    'out/jacob-memo-listing-preview.json',
    JSON.stringify(
      listings.map((row) => ({ ...row.item, seo: (row.input as { seo: unknown }).seo, tags: row.input.tags })),
      null,
      2,
    ),
  );
  return listings.map((row) => row.item);
}

async function main() {
  const previewOnly = process.argv.includes('--preview');
  if (previewOnly) {
    const preview = await writePreviewPayloads();
    console.log(`Preview: ${preview.length} listings. See out/jacob-memo-listing-preview.json`);
    for (const row of preview) {
      console.log(`${row.handle}\t${row.price}\t${row.compareAtPrice}\t${row.condition}\t${row.title}`);
    }
    return;
  }

  const dryRun = process.argv.includes('--dry-run');
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN is not set');

  const client = new ShopifyClient(domain, await resolveToken(domain));
  const { shop } = await client.verifyAuth();
  console.log(`Jacob memo listings → ${shop} (${dryRun ? 'DRY RUN' : 'LIVE'})`);

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
  const errors: string[] = [];
  const preview: PreviewRow[] = [];

  for (const item of JACOB_MEMO_ITEMS) {
    const handle = handleForItem(item);
    const input = buildJacobMemoProductSetInput(item, {
      locationId: canWriteInventory ? locationId : undefined,
    });
    preview.push(listingPreview(item, input));

    if (dryRun) continue;

    const existing = await findProductId(client, handle);
    if (existing) input.id = existing;

    const result = await client.productSet(input);
    if (result.errors.length) {
      errors.push(`${handle}: ${result.errors.join('; ')}`);
      continue;
    }
    const id = result.id ?? existing;
    if (id && publicationId) {
      const pubErrors = await client.publishResource(id, publicationId);
      if (pubErrors.length) errors.push(`${handle} publish: ${pubErrors.join('; ')}`);
    }
    if (existing) {
      updated.push(handle);
      console.log(`updated ${handle} — ${input.title}`);
    } else {
      created.push(handle);
      console.log(`created ${handle} — ${input.title}`);
    }
  }

  const summary = { shop, dryRun, created, updated, errors, preview };
  await mkdir('out', { recursive: true });
  await writeFile('out/jacob-memo-listings.json', JSON.stringify(summary, null, 2));
  console.log(
    dryRun
      ? `Dry run: ${preview.length} listings prepared. See out/jacob-memo-listings.json`
      : `Done: created=${created.length} updated=${updated.length} errors=${errors.length}`,
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
