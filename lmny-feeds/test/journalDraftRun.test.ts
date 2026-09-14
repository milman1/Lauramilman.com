import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Run-level behaviour of the Journal drafting job's preflight (2026-09-11: a
 * dry run spent six minutes and real Anthropic spend gathering hooks, then
 * died on `fetchBlogId` with "Access denied for blogs field" — the token
 * lacked content scopes). These tests exercise `run()` end to end with the
 * Shopify client, the Anthropic client, and the filesystem all stubbed, the
 * same pattern as test/backvault/sync-warnings.test.ts.
 */

/** Every Shopify GraphQL call and every Anthropic stream call `run()` made, in order. */
const order: string[] = [];

const state: {
  /** Thrown instead of a normal blog response when set. */
  blogError: Error | null;
  scopes: string[];
  /** What `messages.stream(...).finalMessage()` resolves or throws for the hook-gathering call. */
  hookStream: () => Promise<unknown>;
} = {
  blogError: null,
  scopes: ['read_products', 'write_products'],
  hookStream: async () => {
    throw new Error('web_search unavailable in test (no default configured)');
  },
};

function blogResponse() {
  return { blogs: { nodes: [{ id: 'gid://shopify/Blog/1', handle: 'journal', title: 'Journal' }] } };
}
function emptyPagedNodes() {
  return { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] };
}

vi.mock('../src/shopify.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/shopify.js')>();
  class StubClient {
    async gql(query: string): Promise<unknown> {
      if (query.includes('JournalArticleBodies')) {
        order.push('shopify:voice-samples');
        return { articles: { nodes: [] } };
      }
      if (query.includes('JournalArticles(')) {
        order.push('shopify:housekeeping-articles');
        return { articles: emptyPagedNodes() };
      }
      if (query.includes('JournalArticleCreate')) {
        order.push('shopify:article-create');
        return {
          articleCreate: {
            article: { id: 'gid://shopify/Article/1', title: 't', handle: 't', isPublished: false, tags: [], image: null },
            userErrors: [],
          },
        };
      }
      if (query.includes('JournalBlog')) {
        order.push('shopify:blog');
        if (state.blogError) throw state.blogError;
        return blogResponse();
      }
      if (query.includes('JournalProducts')) {
        order.push('shopify:products');
        return { products: emptyPagedNodes() };
      }
      if (query.includes('JournalCollections')) {
        order.push('shopify:collections');
        return { collections: emptyPagedNodes() };
      }
      throw new Error(`unexpected GraphQL query in test: ${query.slice(0, 80)}`);
    }
    async verifyAuth() {
      return { shop: 'lmny-test.myshopify.com' };
    }
    async grantedScopes() {
      return state.scopes;
    }
  }
  return { ...original, ShopifyClient: StubClient };
});

let anthropicConstructed = 0;

vi.mock('@anthropic-ai/sdk', () => {
  class StubAnthropic {
    constructor() {
      anthropicConstructed += 1;
    }
    messages = {
      stream: (_params: { model: string }) => {
        order.push('anthropic:stream');
        return { finalMessage: () => state.hookStream() };
      },
    };
  }
  return { default: StubAnthropic };
});

const writes = new Map<string, string>();
vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  mkdir: async () => undefined,
  writeFile: async (path: string, content: string) => {
    writes.set(String(path), String(content));
  },
}));

const { run } = await import('../scripts/journal-draft.js');

let exitCodeBefore: number | string | null | undefined;

beforeEach(() => {
  writes.clear();
  order.length = 0;
  anthropicConstructed = 0;
  state.blogError = null;
  state.scopes = ['read_products', 'write_products'];
  state.hookStream = async () => {
    throw new Error('web_search unavailable in test (no default configured)');
  };
  exitCodeBefore = process.exitCode;
  process.exitCode = 0;
  process.env.SHOPIFY_STORE_DOMAIN = 'lmny-test.myshopify.com';
  process.env.SHOPIFY_ADMIN_TOKEN = 'shpat_test';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // The RSS fallback uses plain `fetch`; keep every test fast and offline.
  vi.stubGlobal('fetch', async () => {
    throw new Error('network disabled in test');
  });
});

afterEach(() => {
  process.exitCode = exitCodeBefore ?? 0;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function report(): string {
  return writes.get('out/journal-report.md') ?? '';
}

async function runAndCaptureError(argv: string[]): Promise<string> {
  try {
    await run(argv);
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  throw new Error('run() was expected to throw but resolved');
}

describe('preflight failure', () => {
  beforeEach(() => {
    state.blogError = new Error(
      "Shopify GraphQL: Access denied for blogs field. Required access: `read_content` access scope.",
    );
  });

  it('throws a plain-language error naming the missing scopes, listing what is granted, and makes no Anthropic call', async () => {
    const message = await runAndCaptureError(['--dry-run']);

    expect(message).toContain(
      "Shopify GraphQL: access denied for blogs. The Journal job needs the read_content and write_content scopes " +
        "on the app's access token; the sync scopes alone are not enough.",
    );
    expect(message).toContain('Granted scopes: read_products, write_products.');
    expect(message).toContain('No Anthropic API calls were made.');

    expect(anthropicConstructed).toBe(0);
    expect(order.filter((l) => l.startsWith('anthropic:'))).toEqual([]);
  });

  it('still writes out/journal-report.md recording that the run stopped at preflight and spent nothing', async () => {
    await runAndCaptureError(['--dry-run']);
    const md = report();
    expect(md).not.toBe('');
    expect(md).toContain('stopped at preflight');
    expect(md).toContain('Nothing was spent');
    expect(md).toContain('read_content and write_content scopes');
    // No hooks were ever gathered, so the hooks file was never written.
    expect(writes.has('out/journal-hooks.md')).toBe(false);
  });

  it('touches Shopify only for the one preflight query — no products, collections, or voice-sample reads', async () => {
    await runAndCaptureError(['--dry-run']);
    expect(order).toEqual(['shopify:blog']);
  });

  it('rethrows an unrelated fetchBlogId failure unchanged, without inventing a scopes message', async () => {
    state.blogError = new Error('Blog "journal" not found on the store');
    const message = await runAndCaptureError(['--dry-run']);
    expect(message).toBe('Blog "journal" not found on the store');
    const md = report();
    expect(md).toContain('Blog "journal" not found on the store');
    expect(md).not.toContain('read_content');
  });
});

describe('a successful preflight', () => {
  it('reads the blog, catalogue, and voice reference before making any Anthropic call', async () => {
    await run(['--dry-run']);

    expect(order[0]).toBe('shopify:blog');
    const lastCatalogueRead = Math.max(
      order.lastIndexOf('shopify:products'),
      order.lastIndexOf('shopify:collections'),
      order.lastIndexOf('shopify:voice-samples'),
    );
    const firstAnthropicCall = order.indexOf('anthropic:stream');
    expect(lastCatalogueRead).toBeGreaterThan(-1);
    expect(firstAnthropicCall).toBeGreaterThan(-1);
    expect(firstAnthropicCall).toBeGreaterThan(lastCatalogueRead);
  });

  it('proceeds past preflight and completes the run', async () => {
    await run(['--dry-run']);
    const md = report();
    expect(md).toContain('Hooks gathered: 0');
    expect(md).not.toContain('stopped at preflight');
  });
});

describe('hook-source note in the report', () => {
  it('names an org-level server tool limit distinctly from a plain call failure', async () => {
    state.hookStream = async () => {
      throw new Error('400 {"type":"error","error":{"message":"Server tool use limit exceeded"}}');
    };
    await run(['--dry-run']);
    const md = report();
    expect(md).toContain('Server tool use limit exceeded');
    expect(md).toContain('org-level limit on the web_search server tool, not a network failure');
  });

  it('does not claim an org-level limit for an ordinary call failure', async () => {
    state.hookStream = async () => {
      throw new Error('fetch failed: ECONNRESET');
    };
    await run(['--dry-run']);
    const md = report();
    expect(md).toContain('web_search call failed: fetch failed: ECONNRESET');
    expect(md).not.toContain('org-level limit');
    expect(md).not.toContain('Server tool use limit exceeded');
  });

  it('names the same org-level limit when it comes back as a tool result rather than a thrown error', async () => {
    state.hookStream = async () => ({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'web_search_tool_result',
          tool_use_id: 'x',
          content: { type: 'web_search_tool_result_error', error_code: 'too_many_requests' },
        },
      ],
    });
    await run(['--dry-run']);
    const md = report();
    expect(md).toContain('Server tool use limit exceeded');
    expect(md).toContain('org-level limit on the web_search server tool, not a network failure');
  });
});
