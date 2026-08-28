import type { ShopifyClient } from '../shopify.js';
import { FEED_TAG, METAFIELD_NAMESPACE } from './product.js';

export interface BackVaultCatalogEntry {
  id: string;
  handle: string;
  status: string;
  contentHash: string | null;
  imageCount: number;
  /** True when the product is published to the Online Store sales channel. */
  published: boolean;
  inventoryTracked?: boolean;
  inventoryItemId?: string;
  inventoryQuantity?: number;
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
          resourcePublications: { nodes: Array<{ isPublished: boolean; publication: { name: string } }> };
          variants: { nodes: Array<{ inventoryQuantity?: number | null; inventoryItem?: { id?: string; tracked?: boolean } | null }> };
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
            resourcePublications(first: 10) { nodes { isPublished publication { name } } }
            variants(first: 1) { nodes { inventoryQuantity inventoryItem { id tracked } } }
          }
        }
      }`,
      { cursor, q: `tag:'${FEED_TAG}'` },
    );
    for (const node of data.products.nodes) {
      const imageCount = node.media.edges.filter(
        (e) => e.node.status === 'READY' && e.node.mediaContentType === 'IMAGE',
      ).length;
      const published = node.resourcePublications.nodes.some(
        (p) => p.isPublished && (p.publication.name === 'Online Store' || p.publication.name === 'Online Store 2.0'),
      );
      const variant = node.variants.nodes[0];
      entries.push({
        id: node.id,
        handle: node.handle,
        status: node.status,
        contentHash: node.metafield?.value ?? null,
        imageCount,
        published,
        inventoryTracked: variant?.inventoryItem?.tracked,
        inventoryItemId: variant?.inventoryItem?.id,
        inventoryQuantity: typeof variant?.inventoryQuantity === 'number' ? variant.inventoryQuantity : undefined,
      });
    }
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return entries;
}
