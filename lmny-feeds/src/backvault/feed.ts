/**
 * The Back Vault feed client.
 *
 * The store runs on Shopify (its /collections/new-arrivals URL uses
 * Shopify's `filter.v.availability=1` storefront-filter query syntax), so
 * rather than scraping rendered HTML this reads the same public JSON feed
 * every Shopify storefront exposes: /collections/<handle>/products.json.
 * That endpoint doesn't understand `filter.v.availability=1` itself (that
 * param drives the storefront's search-and-discovery filter UI, not this
 * feed) — "available" is instead checked per variant on the rows it returns
 * (see filterAvailable below), which is equivalent to what the query param
 * does on the live page.
 *
 * No API key: this is the same unauthenticated JSON every visitor's browser
 * already fetches to render the collection grid.
 *
 * NOTE: this has not been exercised against the live site — the sandbox
 * that wrote this module has no network path to thebackvault.com (its
 * egress proxy returns a policy 403 for that host). The request/pagination
 * shape follows Shopify's documented products.json contract exactly, but
 * the first live run (via `npm run sync:backvault:dry`, see README) should
 * be treated as the actual validation and its out/report.md read closely.
 */

export const DEFAULT_COLLECTION_HANDLE = 'new-arrivals';
const DEFAULT_BASE_URL = 'https://thebackvault.com';
const PAGE_LIMIT = 250; // Shopify's max products.json page size.
/** Safety cap so a misbehaving pager can't loop forever. */
const MAX_PAGES = 200;

const REQUEST_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; LMNY-FeedSync/1.0; +https://lauramilman.com)',
} as const;

function baseUrl(): string {
  const url = process.env.BACKVAULT_BASE_URL || DEFAULT_BASE_URL;
  return url.replace(/\/+$/, '');
}

function collectionHandle(): string {
  return process.env.BACKVAULT_COLLECTION_HANDLE || DEFAULT_COLLECTION_HANDLE;
}

function pageUrl(page: number): string {
  return `${baseUrl()}/collections/${collectionHandle()}/products.json?limit=${PAGE_LIMIT}&page=${page}`;
}

async function fetchPage(page: number): Promise<unknown[]> {
  const url = pageUrl(page);
  let res: Response | undefined;
  let lastNetErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(url, { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(30_000) });
      break;
    } catch (err) {
      const cause = (err as { cause?: { code?: string; name?: string; message?: string } }).cause;
      lastNetErr =
        [cause?.code, cause?.name, cause?.message].filter(Boolean).join(': ') ||
        (err instanceof Error ? err.message : String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  if (!res) {
    throw new Error(`The Back Vault feed: request failed (${lastNetErr})`);
  }
  if (!res.ok) {
    throw new Error(`The Back Vault feed: HTTP ${res.status} for page ${page}`);
  }
  const body = (await res.json()) as { products?: unknown[] };
  if (!Array.isArray(body.products)) {
    throw new Error('The Back Vault feed: response had no `products` array — page shape may have changed');
  }
  return body.products;
}

/** Fetch every page of the configured collection's products.json until an empty page. */
export async function fetchBackVaultFeed(): Promise<unknown[]> {
  const all: unknown[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const rows = await fetchPage(page);
    if (rows.length === 0) break;
    all.push(...rows);
    if (rows.length < PAGE_LIMIT) break; // short page: this was the last one
  }
  return all;
}
