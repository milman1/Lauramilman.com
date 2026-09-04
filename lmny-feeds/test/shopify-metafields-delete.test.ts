import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopifyClient } from '../src/shopify.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ShopifyClient.deleteMetafields', () => {
  it('deletes identifiers in batches of 25 and ignores missing fields', async () => {
    const bodies: Array<{ query: string; variables: { metafields: unknown[] } }> = [];
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as (typeof bodies)[number]);
      return new Response(
        JSON.stringify({
          data: {
            metafieldsDelete: {
              deletedMetafields: [],
              userErrors: [{ message: 'Metafield does not exist' }],
            },
          },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const identifiers = Array.from({ length: 26 }, (_, i) => ({
      ownerId: `gid://shopify/Product/${i + 1}`,
      namespace: 'uploadify_product',
      key: 'uploadify_active',
    }));
    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    await expect(client.deleteMetafields(identifiers)).resolves.toEqual([]);

    expect(bodies).toHaveLength(2);
    expect(bodies[0]?.query).toContain('metafieldsDelete(metafields: $metafields)');
    expect(bodies[0]?.variables.metafields).toHaveLength(25);
    expect(bodies[1]?.variables.metafields).toHaveLength(1);
  });

  it('returns userErrors that are not missing-field noise', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              metafieldsDelete: {
                deletedMetafields: null,
                userErrors: [{ message: 'Access denied' }],
              },
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    await expect(
      client.deleteMetafields([
        { ownerId: 'gid://shopify/Product/1', namespace: 'uploadify', key: 'listing_id' },
      ]),
    ).resolves.toEqual(['Access denied']);
  });
});

describe('ShopifyClient.setMetafields', () => {
  it('writes metafields in batches of 25', async () => {
    const bodies: Array<{ query: string; variables: { metafields: unknown[] } }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as (typeof bodies)[number]);
        return new Response(
          JSON.stringify({ data: { metafieldsSet: { metafields: [], userErrors: [] } } }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );
    const metafields = Array.from({ length: 26 }, (_, i) => ({
      ownerId: `gid://shopify/Product/${i + 1}`,
      namespace: 'custom',
      key: 'type',
      type: 'single_line_text_field',
      value: 'Wristwatch',
    }));
    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    await expect(client.setMetafields(metafields)).resolves.toEqual([]);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]?.query).toContain('metafieldsSet(metafields: $metafields)');
    expect(bodies[0]?.variables.metafields).toHaveLength(25);
    expect(bodies[1]?.variables.metafields).toHaveLength(1);
  });
});
