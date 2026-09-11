import { channelsFor, publicationMatchesChannel } from '../../config/channels.js';
import type { ShopifyClient } from '../shopify.js';
import { FEED_TAG, METAFIELD_NAMESPACE } from './product.js';

/** The five channels every estate piece belongs on (config/channels.ts). */
const ESTATE_CHANNELS = channelsFor('estate');

/**
 * Which of the configured channels a product is missing.
 *
 * `nodes` is the product's `resourcePublications`, which lists ONLY the
 * publications the product is published to — a channel it has never been
 * published to has no row at all, and a DRAFT or ARCHIVED product comes back
 * with an empty array. The product's own rows therefore say nothing about
 * what is installed on the store, which is why `installedNames` is a
 * required argument fed from the shop-level `publications` query
 * (`ShopifyClient.publicationIdsByName`). Reading the installed set off the
 * product was the 2026-09-10 bug: every missing channel looked uninstalled,
 * `missingChannels` was always empty, and nothing was ever republished.
 *
 * A configured channel that is not installed cannot be published to and is
 * not counted as missing, so the sync does not loop on it forever.
 * `published` is true only when nothing is missing.
 */
export function publishStateFor(
  nodes: Array<{ isPublished?: boolean; publication: { name: string } }>,
  channels: readonly string[],
  installedNames: readonly string[],
): { published: boolean; missingChannels: string[] } {
  const publishedNames = nodes
    .filter((n) => n.isPublished !== false)
    .map((n) => n.publication.name);
  const missingChannels = channels.filter((channel) => {
    const installed = installedNames.some((name) => publicationMatchesChannel(channel, name));
    if (!installed) return false;
    return !publishedNames.some((name) => publicationMatchesChannel(channel, name));
  });
  return { published: missingChannels.length === 0, missingChannels };
}

export interface BackVaultCatalogEntry {
  id: string;
  handle: string;
  status: string;
  contentHash: string | null;
  imageCount: number;
  /**
   * True when the product is published to every channel in
   * `channelsFor('estate')` that is installed on the store.
   */
  published: boolean;
  /** Configured channels this product is installed for but not published to. */
  missingChannels: string[];
  inventoryTracked?: boolean;
  inventoryItemId?: string;
  inventoryQuantity?: number;
  /**
   * The live retail price, null when it cannot be read — no variant, a
   * non-numeric or non-positive price, or MORE THAN ONE VARIANT, where one
   * variant's price says nothing about the piece's ticket. Only the
   * competitor-unavailable price pin in diff.ts uses it: the competitor price
   * itself is never stored on the product, so the price already on the store
   * is the only record of what a competitor match produced.
   */
  price: number | null;
  /** Variants on the product. >1 is why `price` can be null on a priced piece. */
  variantCount: number;
}

/**
 * Paginated read of every product this feed manages (tag:'backvault-feed').
 * Plain cursor pagination rather than the Belgium Dia sync's bulk-query path
 * (src/shopify.ts fetchCatalog): weekly volume here is at most a few hundred
 * products across 38 brands, well under what bulk operations exist to solve.
 */
export async function fetchBackVaultCatalog(
  client: ShopifyClient,
  installedNames: readonly string[],
): Promise<BackVaultCatalogEntry[]> {
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
          variantsCount?: { count?: number | null } | null;
          variants?: {
            nodes?: Array<{
              price?: string | null;
              inventoryQuantity?: number | null;
              inventoryItem?: { id?: string; tracked?: boolean } | null;
            }>;
          } | null;
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
            resourcePublications(first: 30) { nodes { isPublished publication { name } } }
            variantsCount { count }
            variants(first: 1) { nodes { price inventoryQuantity inventoryItem { id tracked } } }
          }
        }
      }`,
      { cursor, q: `tag:'${FEED_TAG}'` },
    );
    for (const node of data.products.nodes) {
      const imageCount = node.media.edges.filter(
        (e) => e.node.status === 'READY' && e.node.mediaContentType === 'IMAGE',
      ).length;
      const { published, missingChannels } = publishStateFor(
        node.resourcePublications.nodes,
        ESTATE_CHANNELS,
        installedNames,
      );
      const variants = node.variants?.nodes ?? [];
      const variant = variants[0];
      const variantCount = node.variantsCount?.count ?? variants.length;
      // `Number(null)` is 0, which would read as a real $0 ticket, so a
      // missing price stays null rather than going through Number().
      // A multi-variant product reads as unpriced: `variants(first: 1)` says
      // nothing about what the other variants cost.
      const price = variant?.price == null || variantCount > 1 ? Number.NaN : Number(variant.price);
      entries.push({
        id: node.id,
        handle: node.handle,
        status: node.status,
        contentHash: node.metafield?.value ?? null,
        imageCount,
        published,
        missingChannels,
        inventoryTracked: variant?.inventoryItem?.tracked,
        inventoryItemId: variant?.inventoryItem?.id,
        inventoryQuantity: typeof variant?.inventoryQuantity === 'number' ? variant.inventoryQuantity : undefined,
        price: Number.isFinite(price) && price > 0 ? price : null,
        variantCount,
      });
    }
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return entries;
}
