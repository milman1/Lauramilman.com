/**
 * Pre-flight for the lab pricing backfill.
 *
 * The live storefront was selling lab stones at ~1/20th value. Before any
 * write that republishes corrected prices, confirm Lab-Grown Diamond feed
 * products are unpublished from the Online Store.
 *
 * Exit 0 = safe to backfill. Exit 1 = still published (abort).
 *
 *   npx tsx scripts/confirm-lab-unpublished.ts
 */

import { exchangeClientCredentials, ShopifyClient } from '../src/shopify.js';

const QUERY = `#graphql
  query LabPublished($cursor: String) {
    products(first: 50, after: $cursor, query: "tag:lmny-feed AND product_type:Lab-Grown Diamond AND published_status:published") {
      pageInfo { hasNextPage endCursor }
      edges { node { id handle onlineStoreUrl } }
    }
  }
`;

async function token(domain: string): Promise<string> {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  if (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET) {
    const exchanged = await exchangeClientCredentials(
      domain,
      process.env.SHOPIFY_CLIENT_ID,
      process.env.SHOPIFY_CLIENT_SECRET,
    );
    return exchanged.token;
  }
  throw new Error('Set SHOPIFY_ADMIN_TOKEN or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET');
}

async function main() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN is not set');
  const client = new ShopifyClient(domain, await token(domain));

  let cursor: string | null = null;
  let published = 0;
  const samples: string[] = [];
  for (;;) {
    const data = await client.gql<{
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        edges: Array<{ node: { handle: string } }>;
      };
    }>(QUERY, { cursor });
    for (const e of data.products.edges) {
      published += 1;
      if (samples.length < 10) samples.push(e.node.handle);
    }
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
    // Cap the scan — we only need to know if ANY remain published.
    if (published >= 200) break;
  }

  if (published === 0) {
    console.log('OK: no published Lab-Grown Diamond lmny-feed products found. Safe to backfill.');
    return;
  }

  console.error(
    `ABORT: at least ${published} lab feed products are still published` +
      (published >= 200 ? '+' : '') +
      '. Unpublish tag:lmny-feed + product type Lab-Grown Diamond before backfill.',
  );
  console.error('Samples: ' + samples.join(', '));
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
