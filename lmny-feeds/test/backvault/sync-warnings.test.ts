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

type CompetitorCatalog = import('../../src/backvault/competitor.js').CompetitorCatalog;

/** A clean walk that read the retailer's whole catalogue. */
function complete(rows: unknown[] = []): CompetitorCatalog {
  return { rows, complete: true, pagesRead: Math.max(1, Math.ceil(rows.length / 250)), stoppedReason: 'exhausted' };
}

/**
 * The 2026-09-11 shape — 100 full pages, then HTTP 400 on page 101 with page 1
 * still alive — produced by running the REAL walk against a stubbed fetch,
 * rather than hand-copying its wording into a literal here. A fixture copied
 * by hand keeps passing after the production message changes, which is exactly
 * the drift these tests are supposed to catch.
 */
async function buildPaginationCapped(match?: unknown): Promise<CompetitorCatalog> {
  const actual = await vi.importActual<typeof import('../../src/backvault/competitor.js')>(
    '../../src/backvault/competitor.js',
  );
  const filler = { handle: 'filler-row' };
  const page = (n: number): unknown[] =>
    Array.from({ length: 250 }, (_, i) => (n === 1 && i === 0 && match ? match : filler));
  const realFetch = globalThis.fetch;
  const quiet = [
    vi.spyOn(console, 'log').mockImplementation(() => {}),
    vi.spyOn(console, 'warn').mockImplementation(() => {}),
  ];
  vi.stubGlobal('fetch', async (url: string) => {
    const n = Number(new URL(String(url)).searchParams.get('page'));
    if (n <= 100) return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ products: page(n) }) };
    return {
      ok: false,
      status: 400,
      body: { cancel: async () => {} },
      headers: { get: () => null },
      json: async () => ({}),
    };
  });
  let clock = 0;
  try {
    return await actual.fetchCompetitorCatalog({
      sleep: async (ms: number) => {
        clock += ms;
      },
      now: () => clock,
    });
  } finally {
    vi.stubGlobal('fetch', realFetch);
    for (const spy of quiet) spy.mockRestore();
  }
}

/** Built once: 25,000 rows over 100 pages, with and without a matching row. */
const CAPPED = await buildPaginationCapped();
/** Priced at 70,000 on the competitor: midpoint with the 67,600 cost is 68,800. */
const COMPETITOR_ROW = {
  handle: 'cartier-dolphin-ring-j10605',
  title: 'Cartier Dolphin Ring J10605',
  variants: [{ sku: 'J10605', price: '70000.00', available: true }],
};
const CAPPED_WITH_MATCH = await buildPaginationCapped(COMPETITOR_ROW);

/** Set per test: what the competitor fetch does, and what the catalog holds. */
const state: { competitor: () => Promise<CompetitorCatalog>; catalog: unknown[] } = {
  competitor: async () => complete(),
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

/** Every productSet input a LIVE run sent, in order. */
const productSets: Array<Record<string, any>> = [];

vi.mock('../../src/shopify.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/shopify.js')>();
  const channels = ['Online Store', 'Shop', 'Google & YouTube', 'Facebook & Instagram', 'Pinterest'];
  class StubClient {
    async productSet(input: Record<string, unknown>) {
      productSets.push(input as Record<string, any>);
      return { id: 'gid://shopify/Product/1', handle: input.handle, inventoryItemId: null, inventoryQuantity: null, errors: [] };
    }
    async publishToChannels(): Promise<string[]> {
      return [];
    }
    async stockInventoryItem(): Promise<string[]> {
      return [];
    }
    async archiveProduct(): Promise<string[]> {
      return [];
    }
    async redirectProductUrl(): Promise<string[]> {
      return [];
    }
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
    firstVariantPrice: 69800,
    // 69,800 against this cost is 1,700 above the flat 68,100, so the ticket
    // carries the midpoint evidence the pin looks for. A flat-priced piece
    // (69,800 == cost + 500) is never pinned — see diff.test.ts.
    storedCost: 67600,
    ...overrides,
  };
}

let exitCodeBefore: number | string | null | undefined;

beforeEach(() => {
  writes.clear();
  productSets.length = 0;
  state.competitor = async () => complete();
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

/** The single `Done: ...` line the run logs. */
function doneLine(): string {
  const calls = (console.log as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  return calls.map((c) => String(c[0])).find((l) => l.startsWith('Done:')) ?? '';
}

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
    // The label says why the price was held, and is not the false
    // "competitor unavailable" on a run where the competitor answered.
    expect(md).toContain('- Price pinned to the live ticket (no competitor price for that piece this run): 1');
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
    state.catalog = [catalogEntry({ price: null, variantCount: 4, firstVariantPrice: 69800 })];
    await run(['--dry-run']);
    const { json, md } = report();
    expect(json.pricePinned).toBe(0);
    expect(json.multiVariantUnchecked).toBe(1);
    expect(json.decisions[0]).toMatchObject({ action: 'update', reason: 'hash_changed' });
    expect(json.warnings.some((w: string) => w.includes('1 piece with more than one variant'))).toBe(true);
    expect(md).toContain('- Multi-variant pieces with no readable live price: 1');
  });

  it('still reaches the report when the fetch fails before a single page', async () => {
    state.competitor = async () => {
      throw new Error(
        'Competitor feed: the 10-minute fetch deadline passed after 0 of up to 200 pages (0 rows read), ' +
          'after 9 retries — the competitor was throttling',
      );
    };
    state.catalog = [catalogEntry()];
    await run(['--dry-run']);
    const { json, md } = report();
    expect(json.errors).toEqual([]);
    expect(process.exitCode).toBe(0);
    expect(md).toContain('- FAILED: Competitor feed: the 10-minute fetch deadline passed after 0');
    expect(json.pricePinned).toBe(1);
  });
});

describe('a successful competitor fetch', () => {
  it('writes the update, warns about nothing, and holds nothing', async () => {
    state.competitor = async () => complete();
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

/**
 * The 2026-09-11 live run read 25,000 rows, hit the retailer's pagination cap
 * at page 101, and threw all 25,000 away, so the price comparison had still
 * never run. A partial index is now used for matching AND still arms the price
 * pin, because a piece missing from it may have a match on a page nobody read.
 */
describe('a partial competitor index', () => {
  function wrotePrice(input: Record<string, any>): string {
    return String(input.variants[0].price);
  }

  it('prices a piece that IS in it from the competitor match, and never pins it', async () => {
    state.competitor = async () => CAPPED_WITH_MATCH;
    state.catalog = [catalogEntry()];
    await run([]);
    const { json } = report();
    expect(json.feedStats.competitorMatched).toBe(1);
    expect(json.competitor.stockRefsIndexed).toBe(1);
    // cost 67,600 + competitor 70,000 -> midpoint 68,800, STRICTLY BELOW the
    // 69,800 on the store. It is still written: the piece matched, so nothing
    // about its price is missing and the pin must keep its hands off it.
    expect(wrotePrice(productSets[0]!)).toBe('68800.00');
    expect(json.pricePinned).toBe(0);
    expect(json.pinnedHandles).toEqual([]);
    expect(json.errors).toEqual([]);
    expect(process.exitCode).toBe(0);
  });

  it('still arms the price pin for a piece it could not match', async () => {
    state.competitor = async () => CAPPED;
    state.catalog = [catalogEntry()];
    await run(['--dry-run']);
    const { json } = report();
    expect(json.competitor.error).toBeUndefined();
    expect(json.competitor.state).toBe('partial');
    expect(json.competitor.complete).toBe(false);
    // Without the pin this piece would silently drop to the flat price on the
    // strength of an index that never saw the page it might be priced on.
    expect(json.pricePinned).toBe(1);
    expect(json.pinnedHandles).toEqual([HANDLE]);
  });

  it('does not arm the pin when the index is complete', async () => {
    state.competitor = async () => complete([]);
    state.catalog = [catalogEntry()];
    await run(['--dry-run']);
    const { json } = report();
    expect(json.competitor.state).toBe('complete');
    expect(json.pricePinned).toBe(0);
    expect(json.warnings).toEqual([]);
  });

  it('is a warning, not an error, and keeps the exit code at 0', async () => {
    state.competitor = async () => CAPPED;
    state.catalog = [catalogEntry()];
    await run(['--dry-run']);
    const { json } = report();
    expect(json.errors).toEqual([]);
    expect(process.exitCode).toBe(0);
    // Every clause is a counted one: no match was found in the rows read, and
    // exactly one piece kept its live price.
    expect(json.warnings[0]).toContain('competitor index is PARTIAL');
    expect(json.warnings[0]).toContain('no piece matched in the rows that were read');
    expect(json.warnings[0]).toContain('1 unmatched piece kept its live price');
  });

  it('counts the matches it really used in the warning', async () => {
    state.competitor = async () => CAPPED_WITH_MATCH;
    state.catalog = [catalogEntry()];
    await run(['--dry-run']);
    const { json } = report();
    expect(json.warnings[0]).toContain('1 piece still priced from a match in the rows that were read');
    expect(json.warnings[0]).toContain('no piece needed its live price protected');
  });

  it('says in the report how much it read, why it stopped, and what it did', async () => {
    state.competitor = async () => CAPPED;
    state.catalog = [catalogEntry()];
    await run(['--dry-run']);
    const { md } = report();
    expect(md).toContain('## Competitor prices');
    expect(md).toContain('- PARTIAL: 25000 rows over 100 pages');
    expect(md).toContain('caps page-based pagination at 100 pages of 250');
    expect(md).toContain('- Pieces priced from a competitor match: 0');
    expect(md).toContain(`- Live prices protected from a drop: 1 (${HANDLE})`);
    expect(md).toContain('This is a warning, not an error.');
    expect(md).not.toContain('- FAILED:');
  });

  it('names the pinned handles under the catalog changes too', async () => {
    state.competitor = async () => CAPPED;
    state.catalog = [catalogEntry()];
    await run(['--dry-run']);
    expect(report().md).toContain(`  - Pinned: ${HANDLE}`);
  });
});

describe('the Done line names the competitor state', () => {
  beforeEach(() => {
    state.catalog = [catalogEntry()];
  });

  it('says complete, with rows and pages, on a clean read', async () => {
    state.competitor = async () => complete([{ handle: 'x' }]);
    await run(['--dry-run']);
    expect(doneLine()).toContain('competitor=complete(1 rows/1 pages)');
  });

  it('says PARTIAL, with how far it got and why, on a capped read', async () => {
    state.competitor = async () => CAPPED;
    await run(['--dry-run']);
    const line = doneLine();
    expect(line).toContain('competitor=PARTIAL(25000 rows over 100 pages');
    expect(line).toContain('page 101 returned HTTP 400');
    // The count, not a claim: price_pinned=0 alone cannot tell "nothing needed
    // protecting" from "nothing matched".
    expect(line).toContain('competitor_matched=0');
    expect(line).toContain('price_pinned=1');
    expect(line).toContain('errors=0');
  });

  it('carries the match count on a partial run that did match', async () => {
    state.competitor = async () => CAPPED_WITH_MATCH;
    await run(['--dry-run']);
    expect(doneLine()).toContain('competitor_matched=1');
  });

  it('says failed when the fetch threw', async () => {
    state.competitor = async () => {
      throw new Error('Competitor feed: HTTP 400 for page 1');
    };
    await run(['--dry-run']);
    expect(doneLine()).toContain('competitor=failed');
  });
});

/**
 * The ordering the whole repair rests on: the pin must run BEFORE the content
 * hash is computed. Move it after, and the piece is written at the pinned price
 * with a hash taken from the flat price, so every later run finds a mismatch
 * and rewrites it forever. Two consecutive degraded LIVE runs over the same
 * piece, with run 2 reading back the hash run 1 actually stored, is what makes
 * that visible — and this also fails if the pin's effect is removed, because
 * run 1 would write the flat price.
 */
describe('the price pin runs before the content hash (two degraded runs)', () => {
  beforeEach(() => {
    state.competitor = async () => {
      throw new Error('Competitor feed: HTTP 429 for page 61');
    };
  });

  /** The price and content_hash productSet actually sent. */
  function wrote(input: Record<string, any>): { price: string; hash: string } {
    const metafield = (input.metafields as Array<Record<string, string>>).find((m) => m.key === 'content_hash');
    return { price: String(input.variants[0].price), hash: String(metafield!.value) };
  }

  it('writes the live price in run 1, then finds nothing to do in run 2', async () => {
    // Run 1: the piece is on the store at 69,800 (a competitor match), the
    // competitor is unreachable, so the recomputed flat price is 68,100.
    state.catalog = [catalogEntry({ contentHash: 'stale-hash' })];
    await run([]);
    const firstRun = report().json;
    expect(firstRun.decisions[0]).toMatchObject({ action: 'update', reason: 'hash_changed' });
    expect(firstRun.pricePinned).toBe(1);
    expect(productSets).toHaveLength(1);

    const written = wrote(productSets[0]!);
    // The pinned ticket, not the flat 68100.00 the competitor-less run computed.
    expect(written.price).toBe('69800.00');

    // Run 2: same degraded conditions, the store now holding exactly what run 1
    // wrote. The hash must match, or the piece is rewritten every week forever.
    productSets.length = 0;
    state.catalog = [catalogEntry({ contentHash: written.hash })];
    await run([]);
    const secondRun = report().json;
    expect(secondRun.decisions[0]).toMatchObject({ action: 'skip', reason: 'unchanged' });
    expect(productSets).toHaveLength(0);
    expect(process.exitCode).toBe(0);
  });

  it('writes the computed price when the competitor fetch succeeds', async () => {
    state.competitor = async () => complete();
    state.catalog = [catalogEntry({ contentHash: 'stale-hash' })];
    await run([]);
    expect(report().json.pricePinned).toBe(0);
    expect(wrote(productSets[0]!).price).toBe('68100.00');
  });
});
