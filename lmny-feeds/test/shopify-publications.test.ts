import { afterEach, describe, expect, it, vi } from 'vitest';
import { SALES_CHANNELS } from '../config/channels.js';
import { ShopifyClient } from '../src/shopify.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data }), { headers: { 'Content-Type': 'application/json' } });
}

const INSTALLED = [
  { id: 'gid://shopify/Publication/1', name: 'Online Store' },
  { id: 'gid://shopify/Publication/2', name: 'Shop' },
  { id: 'gid://shopify/Publication/3', name: 'Google & YouTube' },
  { id: 'gid://shopify/Publication/4', name: 'Facebook & Instagram' },
  { id: 'gid://shopify/Publication/5', name: 'Pinterest' },
  { id: 'gid://shopify/Publication/6', name: 'TikTok' },
];

describe('ShopifyClient.publicationIdsByName', () => {
  it('resolves every configured channel in one query, in the order asked for', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      jsonResponse({ publications: { nodes: INSTALLED } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    const { ids } = await client.publicationIdsByName([...SALES_CHANNELS]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect([...ids.keys()]).toEqual([...SALES_CHANNELS]);
    expect(ids.get('Pinterest')).toBe('gid://shopify/Publication/5');
  });

  it('returns the store publication list as the installed set', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ publications: { nodes: INSTALLED } })),
    );
    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    const { installedNames } = await client.publicationIdsByName(['Online Store']);
    // Everything on the store, not just what was asked for — the catalog read
    // needs it to tell an unpublished channel from an uninstalled one.
    expect(installedNames).toEqual(INSTALLED.map((p) => p.name));
  });

  it('leaves an uninstalled channel out of the map without warning or throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ publications: { nodes: INSTALLED.slice(0, 2) } })),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    const { ids } = await client.publicationIdsByName([...SALES_CHANNELS]);
    expect([...ids.keys()]).toEqual(['Online Store', 'Shop']);
    // The caller records the miss as a run error; the client stays silent.
    expect(warn).not.toHaveBeenCalled();
  });

  it('resolves Online Store from the legacy Online Store 2.0 publication', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          publications: { nodes: [{ id: 'gid://shopify/Publication/99', name: 'Online Store 2.0' }] },
        }),
      ),
    );
    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    const { ids } = await client.publicationIdsByName(['Online Store']);
    expect(ids.get('Online Store')).toBe('gid://shopify/Publication/99');
  });
});

describe('ShopifyClient.publishToChannels', () => {
  it('sends every publication in one publishablePublish call', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      jsonResponse({ publishablePublish: { userErrors: [] } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    const errors = await client.publishToChannels('gid://shopify/Product/1', [
      'gid://shopify/Publication/1',
      'gid://shopify/Publication/3',
    ]);
    expect(errors).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      query: string;
      variables: { id: string; input: Array<{ publicationId: string }> };
    };
    expect(body.query).toContain('publishablePublish');
    expect(body.variables.input).toEqual([
      { publicationId: 'gid://shopify/Publication/1' },
      { publicationId: 'gid://shopify/Publication/3' },
    ]);
  });

  it('returns user errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ publishablePublish: { userErrors: [{ message: 'not allowed' }] } })),
    );
    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    await expect(client.publishToChannels('gid://shopify/Product/1', ['gid://shopify/Publication/1'])).resolves.toEqual(
      ['not allowed'],
    );
  });

  it('makes no call when no publication resolved', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    const client = new ShopifyClient('example.myshopify.com', 'test-token');
    await expect(client.publishToChannels('gid://shopify/Product/1', [])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
