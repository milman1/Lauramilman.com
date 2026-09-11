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
 * Response parsing, and specifically the remembered competitor comparison —
 * the only record of what a match produced, and the one thing that keeps an
 * unmatched piece off the flat markup when the competitor index is incomplete.
 * Every way of reading it wrong matters: a $0 read as real would halve a
 * price, and a missing date silently expires the memory.
 */
describe('fetchBackVaultCatalog response parsing', () => {
  function node(overrides: Record<string, unknown> = {}) {
    return {
      id: 'gid://shopify/Product/1',
      handle: 'bv-cartier-ring',
      status: 'ACTIVE',
      contentHash: { value: 'hash-1' },
      competitorPrice: { value: '72000.0' },
      competitorPriceAt: { value: '2026-09-04T12:00:00Z' },
      media: { edges: [{ node: { status: 'READY', mediaContentType: 'IMAGE' } }] },
      resourcePublications: { nodes: [{ isPublished: true, publication: { name: 'Online Store' } }] },
      variants: { nodes: [{ inventoryQuantity: 1, inventoryItem: { id: 'gid://shopify/InventoryItem/1', tracked: true } }] },
      ...overrides,
    };
  }

  /** A client that answers the catalog query with one page of these nodes. */
  function clientFor(nodes: unknown[]): ShopifyClient {
    return {
      gql: async () => ({ products: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } }),
    } as unknown as ShopifyClient;
  }

  async function entryFor(overrides: Record<string, unknown> = {}) {
    const [entry] = await fetchBackVaultCatalog(clientFor([node(overrides)]), ['Online Store']);
    return entry!;
  }

  it('asks Shopify for the fields the pricing memory depends on', async () => {
    // Deleting a metafield from the query would otherwise leave every parsing
    // test green while every unmatched piece silently dropped to flat.
    let asked = '';
    const client = {
      gql: async (query: string) => {
        asked = query;
        return { products: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } };
      },
    } as unknown as ShopifyClient;
    await fetchBackVaultCatalog(client, ['Online Store']);
    // The remembered comparison is what prices an unmatched piece on an
    // incomplete index; dropping either metafield sends every such piece to
    // the flat markup without anyone noticing.
    expect(asked).toContain('key: "competitor_price"');
    expect(asked).toContain('key: "competitor_price_at"');
    expect(asked).toContain('key: "content_hash"');
    // Nothing reads a variant price or the variant count any more: the price
    // pin that needed them was replaced by the remembered comparison, and this
    // query runs over 700-plus products every week.
    expect(asked).not.toContain('variantsCount');
    expect(asked).toMatch(/variants\(first: 1\) \{ nodes \{ inventoryQuantity /);
  });

  it('reads the fields the diff and the inventory promotion use', async () => {
    const entry = await entryFor();
    expect(entry.imageCount).toBe(1);
    expect(entry.inventoryItemId).toBe('gid://shopify/InventoryItem/1');
    expect(entry.inventoryTracked).toBe(true);
    expect(entry.inventoryQuantity).toBe(1);
  });

  it('survives a product with no variants at all', async () => {
    const entry = await entryFor({ variants: undefined });
    expect(entry.inventoryItemId).toBeUndefined();
    expect(entry.inventoryQuantity).toBeUndefined();
    expect(entry.rememberedCompetitorPrice).toBe(72000);
  });

  it('reads the remembered competitor comparison and its date', async () => {
    const entry = await entryFor();
    expect(entry.rememberedCompetitorPrice).toBe(72000);
    expect(entry.rememberedCompetitorPriceAt).toBe('2026-09-04T12:00:00Z');
    expect(entry.contentHash).toBe('hash-1');
  });

  it('is null for a missing, zero or non-numeric remembered price rather than reading it as $0', async () => {
    // A remembered $0 would price every unmatched piece at half its cost.
    for (const competitorPrice of [null, { value: null }, { value: '0.00' }, { value: '' }, { value: 'n/a' }]) {
      const entry = await entryFor({ competitorPrice });
      expect(entry.rememberedCompetitorPrice).toBeNull();
    }
  });

  it('is null for a missing read date', async () => {
    expect((await entryFor({ competitorPriceAt: null })).rememberedCompetitorPriceAt).toBeNull();
  });

});
