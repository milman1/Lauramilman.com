import { describe, expect, it } from 'vitest';
import { channelsFor } from '../../config/channels.js';
import { fetchBackVaultCatalog, publishStateFor } from '../../src/backvault/catalog.js';
import type { ShopifyClient } from '../../src/shopify.js';

/**
 * Real `resourcePublications` shape: Shopify returns a row ONLY for a
 * publication the product is actually published to. A channel it has never
 * been published to has no row, and a DRAFT or ARCHIVED product comes back
 * with an empty array — which is why the installed set has to come from the
 * shop-level `publications` query instead of these rows.
 */
function publishedRows(names: string[]) {
  return names.map((name) => ({ isPublished: true, publication: { name } }));
}

const ESTATE = channelsFor('estate');

/** What the store actually has installed (audit 2026-09-09). */
const INSTALLED = [
  'Online Store',
  'Facebook & Instagram',
  'Google & YouTube',
  'Pinterest',
  'Shop',
  'TikTok',
  'Inbox',
  'Microsoft Channel',
  'Faire: Sell Wholesale',
  'Buy Button',
];

describe('publishStateFor', () => {
  it('is published only when every configured channel has a row', () => {
    expect(publishStateFor(publishedRows([...ESTATE]), ESTATE, INSTALLED)).toEqual({
      published: true,
      missingChannels: [],
    });
  });

  it('reports the four channels an Online-Store-only estate piece is missing', () => {
    const state = publishStateFor(publishedRows(['Online Store']), ESTATE, INSTALLED);
    expect(state.published).toBe(false);
    expect(state.missingChannels).toEqual(['Shop', 'Google & YouTube', 'Facebook & Instagram', 'Pinterest']);
  });

  it('treats an empty publication list as published nowhere, not published everywhere', () => {
    // A DRAFT or never-published product returns no rows at all. Reading the
    // installed set off these rows was the 2026-09-10 bug: it made every
    // product look fully published and killed the 404 repair path.
    const state = publishStateFor([], ESTATE, INSTALLED);
    expect(state.published).toBe(false);
    expect(state.missingChannels).toEqual([...ESTATE]);
  });

  it('reports a single missing channel', () => {
    const state = publishStateFor(
      publishedRows(['Online Store', 'Shop', 'Google & YouTube', 'Facebook & Instagram']),
      ESTATE,
      INSTALLED,
    );
    expect(state.published).toBe(false);
    expect(state.missingChannels).toEqual(['Pinterest']);
  });

  it('ignores a configured channel the store has not installed', () => {
    const state = publishStateFor(publishedRows(['Online Store', 'Shop']), ESTATE, [
      'Online Store',
      'Shop',
    ]);
    expect(state).toEqual({ published: true, missingChannels: [] });
  });

  it('does not count extra publications like TikTok or Faire as missing', () => {
    const state = publishStateFor(publishedRows([...ESTATE]), ESTATE, INSTALLED);
    expect(state.missingChannels).not.toContain('TikTok');
    expect(state.missingChannels).not.toContain('Faire: Sell Wholesale');
  });

  it('accepts the legacy Online Store 2.0 publication name on both sides', () => {
    const state = publishStateFor(
      publishedRows(['Online Store 2.0', 'Shop']),
      ['Online Store', 'Shop'],
      ['Online Store 2.0', 'Shop'],
    );
    expect(state).toEqual({ published: true, missingChannels: [] });
  });

  it('flags Online Store when the product has no storefront row', () => {
    const state = publishStateFor(publishedRows(['Shop']), ['Online Store', 'Shop'], INSTALLED);
    expect(state.published).toBe(false);
    expect(state.missingChannels).toEqual(['Online Store']);
  });

  it('honours an explicit isPublished false row', () => {
    const state = publishStateFor(
      [
        { isPublished: false, publication: { name: 'Online Store' } },
        { isPublished: true, publication: { name: 'Shop' } },
      ],
      ['Online Store', 'Shop'],
      INSTALLED,
    );
    expect(state.missingChannels).toEqual(['Online Store']);
  });

  it('reports every configured channel missing when nothing is published and all are installed', () => {
    const state = publishStateFor([], ESTATE, [...ESTATE]);
    expect(state).toEqual({ published: false, missingChannels: [...ESTATE] });
  });
});

/**
 * Response parsing, and specifically `price` — the only record of what a
 * competitor match produced, since the competitor price itself is never stored
 * on the product. A null here means the competitor-unavailable pin stands down,
 * so every way of reading it wrong matters.
 */
describe('fetchBackVaultCatalog response parsing', () => {
  function node(overrides: Record<string, unknown> = {}) {
    return {
      id: 'gid://shopify/Product/1',
      handle: 'bv-cartier-ring',
      status: 'ACTIVE',
      metafield: { value: 'hash-1' },
      media: { edges: [{ node: { status: 'READY', mediaContentType: 'IMAGE' } }] },
      resourcePublications: { nodes: [{ isPublished: true, publication: { name: 'Online Store' } }] },
      variantsCount: { count: 1 },
      variants: { nodes: [{ price: '69800.00', inventoryQuantity: 1, inventoryItem: { id: 'gid://shopify/InventoryItem/1', tracked: true } }] },
      ...overrides,
    };
  }

  /** A client that answers the catalog query with one page of these nodes. */
  function clientFor(nodes: unknown[]): ShopifyClient {
    return {
      gql: async () => ({ products: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } }),
    } as unknown as ShopifyClient;
  }

  async function priceOf(overrides: Record<string, unknown> = {}) {
    const [entry] = await fetchBackVaultCatalog(clientFor([node(overrides)]), ['Online Store']);
    return entry!;
  }

  it('asks Shopify for the fields the price guard depends on', async () => {
    // Deleting `price` or `variantsCount` from the query would otherwise leave
    // every parsing test green while the guard silently stood down forever.
    let asked = '';
    const client = {
      gql: async (query: string) => {
        asked = query;
        return { products: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } };
      },
    } as unknown as ShopifyClient;
    await fetchBackVaultCatalog(client, ['Online Store']);
    expect(asked).toMatch(/variants\(first: 1\) \{ nodes \{ price /);
    expect(asked).toContain('variantsCount { count }');
  });

  it('reads a normal price string as a number', async () => {
    const entry = await priceOf();
    expect(entry.price).toBe(69800);
    expect(entry.variantCount).toBe(1);
    expect(entry.imageCount).toBe(1);
    expect(entry.inventoryItemId).toBe('gid://shopify/InventoryItem/1');
  });

  it('reads a fractional price', async () => {
    expect((await priceOf({ variants: { nodes: [{ price: '1250.50' }] } })).price).toBe(1250.5);
  });

  it('is null when the variants array is missing', async () => {
    expect((await priceOf({ variants: undefined, variantsCount: undefined })).price).toBeNull();
    expect((await priceOf({ variants: { nodes: [] }, variantsCount: { count: 0 } })).price).toBeNull();
  });

  it('is null for a null price rather than reading it as $0', async () => {
    expect((await priceOf({ variants: { nodes: [{ price: null }] } })).price).toBeNull();
  });

  it('is null for a zero or negative price', async () => {
    expect((await priceOf({ variants: { nodes: [{ price: '0.00' }] } })).price).toBeNull();
    expect((await priceOf({ variants: { nodes: [{ price: '-100.00' }] } })).price).toBeNull();
  });

  it('is null for a non-numeric price', async () => {
    expect((await priceOf({ variants: { nodes: [{ price: 'call for price' }] } })).price).toBeNull();
    expect((await priceOf({ variants: { nodes: [{ price: '' }] } })).price).toBeNull();
  });

  it('is null when the product has more than one variant', async () => {
    const entry = await priceOf({ variantsCount: { count: 3 } });
    expect(entry.price).toBeNull();
    expect(entry.variantCount).toBe(3);
    // Kept so the warning can count the multi-variant pieces that would
    // actually have been pinned, rather than every one in the run.
    expect(entry.firstVariantPrice).toBe(69800);
  });

  it('falls back to the returned variant count when variantsCount is absent', async () => {
    const entry = await priceOf({ variantsCount: undefined });
    expect(entry.variantCount).toBe(1);
    expect(entry.price).toBe(69800);
  });
});
