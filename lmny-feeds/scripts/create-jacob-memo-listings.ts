/**
 * Create (or skip existing) Jacob & Co. memo listings in Shopify.
 *
 * No photos — products are DRAFT with media-missing. Re-running is safe:
 * existing handles are left alone.
 *
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

async function main() {
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
  const skipped: string[] = [];
  const errors: string[] = [];
  const preview: Array<{ handle: string; title: string; status: string; price: string; sku: string }> = [];

  for (const item of JACOB_MEMO_ITEMS) {
    const handle = handleForItem(item);
    const input = buildJacobMemoProductSetInput(item, {
      locationId: canWriteInventory ? locationId : undefined,
    });
    const variant = (input.variants as Array<{ price: string; sku: string }>)[0]!;
    preview.push({
      handle,
      title: String(input.title),
      status: String(input.status),
      price: variant.price,
      sku: variant.sku,
    });

    if (dryRun) continue;

    const existing = await findProductId(client, handle);
    if (existing) {
      skipped.push(handle);
      console.log(`skip ${handle} (already exists)`);
      continue;
    }

    const result = await client.productSet(input);
    if (result.errors.length) {
      errors.push(`${handle}: ${result.errors.join('; ')}`);
      continue;
    }
    const id = result.id;
    if (id && publicationId) {
      const pubErrors = await client.publishResource(id, publicationId);
      if (pubErrors.length) errors.push(`${handle} publish: ${pubErrors.join('; ')}`);
    }
    created.push(handle);
    console.log(`created ${handle} — ${input.title}`);
  }

  const summary = { shop, dryRun, created, skipped, errors, preview };
  await mkdir('out', { recursive: true });
  await writeFile('out/jacob-memo-listings.json', JSON.stringify(summary, null, 2));
  console.log(
    dryRun
      ? `Dry run: ${preview.length} listings prepared. See out/jacob-memo-listings.json`
      : `Done: created=${created.length} skipped=${skipped.length} errors=${errors.length}`,
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
