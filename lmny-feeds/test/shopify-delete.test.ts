import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopifyClient } from '../src/shopify.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ShopifyClient.deleteProduct', () => {
  it('permanently deletes the requested Shopify product', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            productDelete: {
              deletedProductId: 'gid://shopify/Product/123',
              userErrors: [],
            },
          },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    await expect(client.deleteProduct('gid://shopify/Product/123')).resolves.toEqual([]);

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      query: string;
      variables: { input: { id: string } };
    };
    expect(body.query).toContain('productDelete(input: $input)');
    expect(body.variables).toEqual({
      input: { id: 'gid://shopify/Product/123' },
    });
  });
});
