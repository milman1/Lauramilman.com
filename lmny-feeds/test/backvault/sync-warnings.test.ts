import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Run-level behaviour of the competitor fail-safe. The 2026-09-11 dry run
 * (Actions 34558143992) exited 1 on nothing but a competitor 429 that the sync
 * had already handled by design: a degraded competitor fetch is a WARNING, and
 * only `errors` may fail the job. The other half of that fix is the price pin —
 * the piece is still updated, only its price is left as it stands — counted on
 * the Done line and in the report.
 */

const SUPPLIER_ROW = {
  id: 1,
  handle: 'cartier-dolphin-ring-j10605',
  title: 'Cartier Dolphin Ring',
  body_html: '<p>18K Yellow Gold.</p>',
  vendor: 'Cartier',
  product_type: 'Ring',
  tags: '',
  variants: [{ id: 10, title: 'Default Title', price: '67600.00', available: true, sku: 'J10605' }],
  images: [{ src: 'https://cdn.example.com/J10605.jpg' }],
};

/** Set per test: what the competitor fetch does, and what the catalog holds. */
const state: { competitor: () => Promise<unknown[]>; catalog: unknown[] } = {
  competitor: async () => [],
  catalog: [],
};

const writes = new Map<string, string>();

vi.mock('../../src/backvault/feed.js', () => ({
  fetchBackVaultFeed: async () => [SUPPLIER_ROW],
  fetchBackVaultAllProducts: async () => [SUPPLIER_ROW],
}));

vi.mock('../../src/backvault/competitor.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/backvault/competitor.js')>()),
  fetchCompetitorCatalog: () => state.competitor(),
}));

vi.mock('../../src/backvault/catalog.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/backvault/catalog.js')>()),
  fetchBackVaultCatalog: async () => state.catalog,
}));

vi.mock('../../src/shopify.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/shopify.js')>();
  const channels = ['Online Store', 'Shop', 'Google & YouTube', 'Facebook & Instagram', 'Pinterest'];
  class StubClient {
    async verifyAuth(): Promise<void> {}
    async grantedScopes(): Promise<string[]> {
      return ['write_products', 'write_publications', 'write_inventory', 'read_locations'];
    }
    async publicationIdsByName(names: string[]): Promise<{ ids: Map<string, string>; installedNames: string[] }> {
      return { ids: new Map(names.map((n) => [n, `gid://shopify/Publication/${n}`])), installedNames: channels };
    }
    async primaryLocationId(): Promise<string> {
      return 'gid://shopify/Location/1';
    }
  }
  return { ...original, ShopifyClient: StubClient };
});

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  mkdir: async () => undefined,
  writeFile: async (path: string, content: string) => {
    writes.set(String(path), String(content));
  },
}));

const { handleFor } = await import('../../src/backvault/product.js');
const { normalizeBackVaultFeed } = await import('../../src/backvault/normalize.js');
const { run } = await import('../../src/backvault/sync.js');

/** The handle the sync will compute for SUPPLIER_ROW. */
const HANDLE = handleFor(normalizeBackVaultFeed([SUPPLIER_ROW]).items[0]!);

function catalogEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gid://shopify/Product/1',
    handle: HANDLE,
    status: 'ACTIVE',
    contentHash: 'stale-hash',
    imageCount: 1,
    published: true,
    missingChannels: [],
    inventoryTracked: true,
    inventoryItemId: 'gid://shopify/InventoryItem/1',
    inventoryQuantity: 1,
    price: 69800,
    variantCount: 1,
    ...overrides,
  };
}

let exitCodeBefore: number | string | null | undefined;

beforeEach(() => {
  writes.clear();
  state.competitor = async () => [];
  state.catalog = [];
  exitCodeBefore = process.exitCode;
  process.exitCode = 0;
  process.env.SHOPIFY_STORE_DOMAIN = 'example.myshopify.com';
  process.env.SHOPIFY_ADMIN_TOKEN = 'shpat_test';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  process.exitCode = exitCodeBefore ?? 0;
  vi.restoreAllMocks();
});

function report(): { md: string; json: Record<string, any> } {
  return {
    md: writes.get('out/backvault-report.md') ?? '',
    json: JSON.parse(writes.get('out/backvault-report.json') ?? '{}'),
  };
}

describe('a failed competitor fetch', () => {
  beforeEach(() => {
    state.competitor = async () => {
      throw new Error('Competitor feed: HTTP 429 for page 61');
    };
  });

  it('is a warning, not an error, and does not fail the run', async () => {
    state.catalog = [catalogEntry()];
    await run(['--dry-run']);
    const { json } = report();
    expect(json.errors).toEqual([]);
    expect(json.warnings).toHaveLength(2); // the fetch, plus the pinned price
    expect(json.warnings[0]).toContain('competitor fetch: Competitor feed: HTTP 429 for page 61');
    expect(process.exitCode).toBe(0);
  });

  it('keeps the exit code at 0 with warnings but no errors', async () => {
    state.catalog = [];
    await run(['--dry-run']);
    expect(report().json.warnings.length).toBeGreaterThan(0);
    expect(report().json.errors).toEqual([]);
    expect(process.exitCode).toBe(0);
  });

  it('pins the price, still writes the update, and says so in a warning', async () => {
    state.catalog = [catalogEntry()];
    await run(['--dry-run']);
    const { json, md } = report();
    expect(json.pricePinned).toBe(1);
    // The piece is UPDATED, not held: it keeps this week's images, cost and
    // channels; only the ticket is left where it stands.
    expect(json.decisions[0]).toMatchObject({ action: 'update', reason: 'hash_changed' });
    expect(json.warnings.some((w: string) => w.includes('1 piece updated with the price left as it stands'))).toBe(
      true,
    );
    expect(md).toContain('## Warnings (2)');
    expect(md).toContain('- Price pinned to the live ticket (competitor unavailable): 1');
    expect(md).toContain('## Competitor prices');
    expect(md).toContain('- FAILED: Competitor feed: HTTP 429 for page 61');
  });

  it('leaves a price that does not fall alone', async () => {
    state.catalog = [catalogEntry({ price: 100 })];
    await run(['--dry-run']);
    const { json } = report();
    expect(json.decisions[0]).toMatchObject({ action: 'update', reason: 'hash_changed' });
    expect(json.pricePinned).toBe(0);
  });

  it('stands down on a multi-variant piece and names it in the warning', async () => {
    state.catalog = [catalogEntry({ price: null, variantCount: 4 })];
    await run(['--dry-run']);
    const { json, md } = report();
    expect(json.pricePinned).toBe(0);
    expect(json.multiVariantUnchecked).toBe(1);
    expect(json.decisions[0]).toMatchObject({ action: 'update', reason: 'hash_changed' });
    expect(json.warnings.some((w: string) => w.includes('1 piece with more than one variant'))).toBe(true);
    expect(md).toContain('- Multi-variant pieces with no readable live price: 1');
  });

  it('still reaches the report when the fetch runs out of wall clock', async () => {
    state.competitor = async () => {
      throw new Error('Competitor feed: the 6-minute fetch deadline passed after 12 of up to 200 pages (3000 rows read)');
    };
    state.catalog = [catalogEntry()];
    await run(['--dry-run']);
    const { json, md } = report();
    expect(json.errors).toEqual([]);
    expect(process.exitCode).toBe(0);
    expect(md).toContain('- FAILED: Competitor feed: the 6-minute fetch deadline passed after 12');
    expect(json.pricePinned).toBe(1);
  });
});

describe('a successful competitor fetch', () => {
  it('writes the update, warns about nothing, and holds nothing', async () => {
    state.competitor = async () => [];
    state.catalog = [catalogEntry()];
    await run(['--dry-run']);
    const { json, md } = report();
    expect(json.warnings).toEqual([]);
    expect(json.pricePinned).toBe(0);
    expect(json.decisions[0]).toMatchObject({ action: 'update', reason: 'hash_changed' });
    expect(md).not.toContain('## Warnings');
    expect(process.exitCode).toBe(0);
  });
});
