import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopifyClient } from '../src/shopify.js';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SHOPIFY_LOCATION_ID;
});

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data }), { headers: { 'Content-Type': 'application/json' } });
}

describe('ShopifyClient.primaryLocationId', () => {
  it('uses SHOPIFY_LOCATION_ID when set', async () => {
    process.env.SHOPIFY_LOCATION_ID = '998877';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    await expect(client.primaryLocationId()).resolves.toBe('gid://shopify/Location/998877');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('picks the first active location from Admin', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        locations: {
          nodes: [
            { id: 'gid://shopify/Location/1', name: 'Closed', isActive: false },
            { id: 'gid://shopify/Location/2', name: 'Shop', isActive: true },
          ],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    await expect(client.primaryLocationId()).resolves.toBe('gid://shopify/Location/2');
  });
});

describe('ShopifyClient.setAvailableQuantities', () => {
  it('sets available qty with ignoreCompareQuantity', async () => {
    let requestInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      requestInit = init;
      return jsonResponse({ inventorySetQuantities: { userErrors: [] } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    await expect(
      client.setAvailableQuantities('gid://shopify/Location/2', [
        { inventoryItemId: 'gid://shopify/InventoryItem/9', quantity: 1 },
      ]),
    ).resolves.toEqual([]);
    const body = JSON.parse(String(requestInit?.body)) as {
      query: string;
      variables: { input: Record<string, unknown> };
    };
    expect(body.query).toContain('inventorySetQuantities(input: $input)');
    expect(body.variables.input).toEqual({
      name: 'available',
      reason: 'correction',
      ignoreCompareQuantity: true,
      quantities: [
        {
          inventoryItemId: 'gid://shopify/InventoryItem/9',
          locationId: 'gid://shopify/Location/2',
          quantity: 1,
        },
      ],
    });
  });
});
