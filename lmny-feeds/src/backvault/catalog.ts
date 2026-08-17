import type { ShopifyClient } from '../shopify.js';
import { FEED_TAG, METAFIELD_NAMESPACE } from './product.js';

export interface BackVaultCatalogEntry {
  id: string;
  handle: string;
  status: string;
  contentHash: string | null;
  imageCount: number;
}

/**
 * Paginated read of every product this feed manages (tag:'backvault-feed').
 * Plain cursor pagination rather than the Belgium Dia sync's bulk-query path
 * (src/shopify.ts fetchCatalog): weekly volume here is at most a few hundred
 * products across 38 brands, well under what bulk operations exist to solve.
 */
export async function fetchBackVaultCatalog(client: ShopifyClient): Promise<BackVaultCatalogEntry[]> {
  const entries: BackVaultCatalogEntry[] = [];
  let cursor: string | null = null;
  for (;;) {
    const data: {
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: Array<{
          id: string;
          handle: string;
          status: string;
          metafield: { value: string } | null;
          media: { edges: Array<{ node: { status: string; mediaContentType: string } }> };
        }>;
      };
    } = await client.gql(
      `query($cursor: String, $q: String!) {
        products(first: 100, after: $cursor, query: $q) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            handle
            status
            metafield(namespace: "${METAFIELD_NAMESPACE}", key: "content_hash") { value }
            media(first: 50) { edges { node { status mediaContentType } } }
          }
        }
      }`,
      { cursor, q: `tag:'${FEED_TAG}'` },
    );
    for (const node of data.products.nodes) {
      const imageCount = node.media.edges.filter(
        (e) => e.node.status === 'READY' && e.node.mediaContentType === 'IMAGE',
      ).length;
      entries.push({
        id: node.id,
        handle: node.handle,
        status: node.status,
        contentHash: node.metafield?.value ?? null,
        imageCount,
      });
    }
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return entries;
}
