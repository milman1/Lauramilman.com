import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopifyClient } from '../src/shopify.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ShopifyClient.deleteProduct', () => {
  it('permanently deletes the requested Shopify product', async () => {
    let requestInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      requestInit = init;
      return new Response(
        JSON.stringify({
          data: {
            productDelete: {
              deletedProductId: 'gid://shopify/Product/123',
              userErrors: [],
            },
          },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    await expect(client.deleteProduct('gid://shopify/Product/123')).resolves.toEqual([]);

    expect(requestInit).toBeDefined();
    const body = JSON.parse(String(requestInit?.body)) as {
      query: string;
      variables: { input: { id: string } };
    };
    expect(body.query).toContain('productDelete(input: $input)');
    expect(body.variables).toEqual({
      input: { id: 'gid://shopify/Product/123' },
    });
  });
});
