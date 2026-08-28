import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopifyClient } from '../src/shopify.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data }), { headers: { 'Content-Type': 'application/json' } });
}

describe('ShopifyClient.primaryLocationId', () => {
  it('prefers the primary active location', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          locations: {
            nodes: [
              { id: 'gid://shopify/Location/1', isActive: true, isPrimary: false, fulfillsOnlineOrders: true },
              { id: 'gid://shopify/Location/2', isActive: true, isPrimary: true, fulfillsOnlineOrders: true },
            ],
          },
        }),
      ),
    );
    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    await expect(client.primaryLocationId()).resolves.toBe('gid://shopify/Location/2');
  });
});

describe('ShopifyClient.stockInventoryItem', () => {
  it('activates inventory when the item is not yet stocked', async () => {
    let requestInit: RequestInit | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        requestInit = init;
        return jsonResponse({ inventoryActivate: { userErrors: [] } });
      }),
    );
    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    await expect(
      client.stockInventoryItem('gid://shopify/InventoryItem/9', 'gid://shopify/Location/2', 1),
    ).resolves.toEqual([]);
    const body = JSON.parse(String(requestInit?.body)) as {
      query: string;
      variables: { inventoryItemId: string; locationId: string; available: number };
    };
    expect(body.query).toContain('inventoryActivate');
    expect(body.variables).toEqual({
      inventoryItemId: 'gid://shopify/InventoryItem/9',
      locationId: 'gid://shopify/Location/2',
      available: 1,
    });
  });

  it('sets quantity when the item is already stocked at the location', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { query: string };
      if (body.query.includes('inventoryActivate')) {
        return jsonResponse({
          inventoryActivate: { userErrors: [{ message: 'The inventory item is already stocked at the location.' }] },
        });
      }
      return jsonResponse({ inventorySetQuantities: { userErrors: [] } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    await expect(
      client.stockInventoryItem('gid://shopify/InventoryItem/9', 'gid://shopify/Location/2', 0),
    ).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const setBody = JSON.parse(String(fetchMock.mock.calls[1]![1]?.body)) as {
      query: string;
      variables: { input: { quantities: Array<{ quantity: number }> } };
    };
    expect(setBody.query).toContain('inventorySetQuantities');
    expect(setBody.variables.input.quantities[0]!.quantity).toBe(0);
  });
});
