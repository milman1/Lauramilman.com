import { describe, expect, it, vi } from 'vitest';
import {
  archiveLegacyDuplicate,
  legacyHandleFor,
  legacyHandleFromBvHandle,
  legacyRedirectTarget,
  shouldArchiveLegacyProduct,
  type LegacyArchiveClient,
  type LegacyProduct,
} from '../../src/backvault/legacy.js';
import type { BackVaultItem } from '../../src/backvault/types.js';

function product(overrides: Partial<LegacyProduct> = {}): LegacyProduct {
  return {
    id: 'gid://shopify/Product/1',
    handle: 'cartier-love-bracelet',
    status: 'ACTIVE',
    tags: ['Estate Jewelry', 'Vintage', 'Cartier'],
    ...overrides,
  };
}

function item(overrides: Partial<BackVaultItem> = {}): BackVaultItem {
  return {
    sourceHandle: 'cartier-love-bracelet',
    title: 'Cartier Love Bracelet',
    vendorRaw: 'Cartier',
    vendor: 'Cartier',
    productType: 'Bracelet',
    descriptionHtml: '<p>18K.</p>',
    priceUsd: 4500,
    available: true,
    imageUrls: [],
    specs: {},
    ...overrides,
  };
}

describe('legacyHandleFromBvHandle', () => {
  it('strips the bv- prefix', () => {
    expect(legacyHandleFromBvHandle('bv-cartier-love-bracelet')).toBe('cartier-love-bracelet');
  });

  it('returns null for non-bv handles', () => {
    expect(legacyHandleFromBvHandle('cartier-love-bracelet')).toBeNull();
    expect(legacyHandleFromBvHandle('bv-')).toBeNull();
    expect(legacyHandleFromBvHandle('nd-123')).toBeNull();
  });
});

describe('legacyHandleFor', () => {
  it('matches the pre-prefix CSV handle', () => {
    expect(legacyHandleFor(item())).toBe('cartier-love-bracelet');
    expect(legacyHandleFor(item({ sourceHandle: 'Weird_Handle!!123' }))).toBe('weird-handle-123');
  });
});

describe('shouldArchiveLegacyProduct', () => {
  it('archives an active CSV-imported twin', () => {
    expect(shouldArchiveLegacyProduct(product(), 'bv-cartier-love-bracelet')).toBe(true);
  });

  it('skips missing, archived, and same-handle rows', () => {
    expect(shouldArchiveLegacyProduct(null, 'bv-cartier-love-bracelet')).toBe(false);
    expect(shouldArchiveLegacyProduct(product({ status: 'ARCHIVED' }), 'bv-cartier-love-bracelet')).toBe(false);
    expect(shouldArchiveLegacyProduct(product({ handle: 'bv-cartier-love-bracelet' }), 'bv-cartier-love-bracelet')).toBe(
      false,
    );
  });

  it('never archives other feed pipelines', () => {
    expect(shouldArchiveLegacyProduct(product({ handle: 'nd-abc' }), 'bv-cartier-love-bracelet')).toBe(false);
    expect(shouldArchiveLegacyProduct(product({ handle: 'lg-abc' }), 'bv-cartier-love-bracelet')).toBe(false);
    expect(shouldArchiveLegacyProduct(product({ handle: 'w-abc' }), 'bv-cartier-love-bracelet')).toBe(false);
    expect(shouldArchiveLegacyProduct(product({ handle: 'bv-other' }), 'bv-cartier-love-bracelet')).toBe(false);
    expect(shouldArchiveLegacyProduct(product({ tags: ['backvault-feed'] }), 'bv-cartier-love-bracelet')).toBe(false);
    expect(shouldArchiveLegacyProduct(product({ tags: ['lmny-feed'] }), 'bv-cartier-love-bracelet')).toBe(false);
  });
});

describe('legacyRedirectTarget', () => {
  it('points at the new listing, or the jewelry catalog when that SKU left the feed', () => {
    expect(legacyRedirectTarget('bv-cartier-love-bracelet', false)).toBe('/products/bv-cartier-love-bracelet');
    expect(legacyRedirectTarget('bv-cartier-love-bracelet', true)).toBe('/collections/all');
  });
});

describe('archiveLegacyDuplicate', () => {
  function mockClient(legacy: LegacyProduct | null): LegacyArchiveClient & {
    archiveProduct: ReturnType<typeof vi.fn>;
    upsertUrlRedirect: ReturnType<typeof vi.fn>;
  } {
    return {
      findProductByHandle: vi.fn(async () => legacy),
      archiveProduct: vi.fn(async () => []),
      upsertUrlRedirect: vi.fn(async () => []),
    };
  }

  it('archives the CSV twin and redirects to the bv- product', async () => {
    const client = mockClient(product());
    const result = await archiveLegacyDuplicate(client, {
      bvHandle: 'bv-cartier-love-bracelet',
      replacementArchived: false,
      dryRun: false,
    });
    expect(result).toEqual({ action: 'archived', handle: 'cartier-love-bracelet', reason: 'csv_duplicate', errors: [] });
    expect(client.archiveProduct).toHaveBeenCalledWith('gid://shopify/Product/1');
    expect(client.upsertUrlRedirect).toHaveBeenCalledWith(
      '/products/cartier-love-bracelet',
      '/products/bv-cartier-love-bracelet',
    );
  });

  it('redirects to /collections/all when the replacement left the feed', async () => {
    const client = mockClient(product());
    await archiveLegacyDuplicate(client, {
      bvHandle: 'bv-cartier-love-bracelet',
      replacementArchived: true,
      dryRun: false,
    });
    expect(client.upsertUrlRedirect).toHaveBeenCalledWith('/products/cartier-love-bracelet', '/collections/all');
  });

  it('does not write in a dry run', async () => {
    const client = mockClient(product());
    const result = await archiveLegacyDuplicate(client, {
      bvHandle: 'bv-cartier-love-bracelet',
      replacementArchived: false,
      dryRun: true,
    });
    expect(result.action).toBe('planned');
    expect(client.archiveProduct).not.toHaveBeenCalled();
    expect(client.upsertUrlRedirect).not.toHaveBeenCalled();
  });

  it('skips when there is no CSV twin', async () => {
    const client = mockClient(null);
    const result = await archiveLegacyDuplicate(client, {
      bvHandle: 'bv-cartier-love-bracelet',
      replacementArchived: false,
      dryRun: false,
    });
    expect(result.action).toBe('skipped');
    expect(result.reason).toBe('not_found');
    expect(client.archiveProduct).not.toHaveBeenCalled();
  });
});
