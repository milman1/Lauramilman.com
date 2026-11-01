import { afterEach, expect, it, vi } from 'vitest';
import { ShopifyClient } from '../src/shopify.js';

afterEach(() => vi.unstubAllGlobals());

it('archives by ID without deleting or changing prices', async () => {
  const requests: any[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return Response.json({ data: { productUpdate: { userErrors: [] } } });
  }));
  const client = new ShopifyClient('example.myshopify.com', 'test-token');
  expect(await client.archiveProduct('gid://shopify/Product/123')).toEqual([]);
  expect(requests[0].variables).toEqual({ product: { id: 'gid://shopify/Product/123', status: 'ARCHIVED' } });
  expect(requests[0].query).not.toContain('productDelete');
});

it('reads all redirect pages so later-page redirects are not recreated', async () => {
  const requests: any[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    requests.push(JSON.parse(init.body));
    const first = requests.length === 1;
    return Response.json({ data: { urlRedirects: {
      nodes: [{ path: first ? '/products/nd-one' : '/products/nd-two' }],
      pageInfo: { hasNextPage: first, endCursor: first ? 'next' : 'last' },
    } } });
  }));
  const client = new ShopifyClient('example.myshopify.com', 'test-token');
  expect(await client.redirectPaths()).toEqual(new Set(['/products/nd-one', '/products/nd-two']));
  expect(requests.map(r => r.variables)).toEqual([{ after: null }, { after: 'next' }]);
});
