import { describe, expect, it } from 'vitest';
import {
  diffBackVaultCatalog,
  pinLivePricesWhenCompetitorUnavailable,
  promoteBackVaultInventoryUpdates,
} from '../../src/backvault/diff.js';
import type { BackVaultCatalogEntry } from '../../src/backvault/catalog.js';
import { contentHashFor, handleFor } from '../../src/backvault/product.js';
import type { BackVaultItem } from '../../src/backvault/types.js';

function entry(
  handle: string,
  hash: string | null,
  status = 'ACTIVE',
  published = true,
  missingChannels: string[] = published ? [] : ['Online Store'],
  price: number | null = null,
  variantCount = 1,
): BackVaultCatalogEntry {
  return {
    id: `gid://shopify/Product/${handle}`,
    handle,
    status,
    contentHash: hash,
    imageCount: 1,
    published,
    missingChannels,
    price,
    variantCount,
    // Mirrors the real read: the first variant's price survives even when the
    // multi-variant rule makes `price` unreadable.
    firstVariantPrice: price,
  };
}

describe('diffBackVaultCatalog', () => {
  it('creates new items not in catalog', () => {
    const decisions = diffBackVaultCatalog([{ handle: 'bv-cartier', contentHash: 'abc' }], []);
    expect(decisions).toEqual([{ handle: 'bv-cartier', action: 'create', reason: 'new' }]);
  });

  it('updates items whose hash changed', () => {
    const decisions = diffBackVaultCatalog(
      [{ handle: 'bv-cartier', contentHash: 'new-hash' }],
      [entry('bv-cartier', 'old-hash')],
    );
    expect(decisions[0]!.action).toBe('update');
    expect(decisions[0]!.reason).toBe('hash_changed');
  });

  it('skips unchanged active items', () => {
    const decisions = diffBackVaultCatalog([{ handle: 'bv-cartier', contentHash: 'abc' }], [entry('bv-cartier', 'abc')]);
    expect(decisions[0]!.action).toBe('skip');
    expect(decisions[0]!.reason).toBe('unchanged');
  });

  it('publishes active items that exist but are not on Online Store', () => {
    const decisions = diffBackVaultCatalog(
      [{ handle: 'bv-cartier', contentHash: 'abc' }],
      [entry('bv-cartier', 'abc', 'ACTIVE', false)],
    );
    expect(decisions[0]).toEqual({
      handle: 'bv-cartier',
      action: 'publish',
      reason: 'unpublished',
      productId: 'gid://shopify/Product/bv-cartier',
    });
  });

  it('publishes an item that is on the Online Store but missing a configured channel', () => {
    const decisions = diffBackVaultCatalog(
      [{ handle: 'bv-cartier', contentHash: 'abc' }],
      [entry('bv-cartier', 'abc', 'ACTIVE', false, ['Google & YouTube', 'Pinterest'])],
    );
    expect(decisions[0]).toEqual({
      handle: 'bv-cartier',
      action: 'publish',
      reason: 'unpublished',
      productId: 'gid://shopify/Product/bv-cartier',
    });
  });

  it('skips an item published to every configured channel', () => {
    const decisions = diffBackVaultCatalog(
      [{ handle: 'bv-cartier', contentHash: 'abc' }],
      [entry('bv-cartier', 'abc', 'ACTIVE', true, [])],
    );
    expect(decisions[0]!.action).toBe('skip');
  });

  it('reactivates an inactive item with a matching hash', () => {
    const decisions = diffBackVaultCatalog(
      [{ handle: 'bv-cartier', contentHash: 'abc' }],
      [entry('bv-cartier', 'abc', 'DRAFT')],
    );
    expect(decisions[0]!.action).toBe('update');
    expect(decisions[0]!.reason).toBe('reactivate');
  });

  it('archives items no longer in the feed', () => {
    const decisions = diffBackVaultCatalog([], [entry('bv-cartier', 'abc')]);
    expect(decisions[0]!.action).toBe('archive');
    expect(decisions[0]!.reason).toBe('left_feed');
  });

  it('skips already-archived items', () => {
    const decisions = diffBackVaultCatalog([], [entry('bv-cartier', 'abc', 'ARCHIVED')]);
    expect(decisions[0]!.action).toBe('skip');
    expect(decisions[0]!.reason).toBe('already_archived');
  });
});

describe('promoteBackVaultInventoryUpdates', () => {
  it('re-opens a hash-skip that is still untracked', () => {
    const catalog = [entry('bv-cartier', 'abc')];
    const d = diffBackVaultCatalog([{ handle: 'bv-cartier', contentHash: 'abc' }], catalog);
    expect(d[0]?.action).toBe('skip');
    expect(promoteBackVaultInventoryUpdates(d, catalog)).toBe(1);
    expect(d[0]).toMatchObject({ action: 'update', reason: 'inventory_untracked' });
  });
});

/**
 * Competitor-unavailable price pin. Retail is max((cost + competitor) / 2, cost
 * + markup), so a competitor-matched piece sits at or above the flat price; if
 * the competitor fetch fails, writing the flat price would cut every one of
 * them and the next good run would put them back. The piece is still updated —
 * images, cost, status, channels — with only the price left as it stands.
 */
describe('pinLivePricesWhenCompetitorUnavailable', () => {
  function item(overrides: Partial<BackVaultItem> = {}): BackVaultItem {
    return {
      sourceHandle: 'cartier-dolphin-ring-j10605',
      title: 'Cartier Dolphin Ring',
      vendorRaw: 'Cartier',
      vendor: 'Cartier',
      productType: 'Ring',
      descriptionHtml: '<p>18K Yellow Gold.</p>',
      costUsd: 67600,
      priceUsd: 68100, // flat markup: no competitor match this run
      available: true,
      sku: 'J10605',
      imageUrls: ['https://cdn.example.com/J10605.jpg'],
      specs: { metalType: '18K Yellow Gold' },
      ...overrides,
    };
  }

  /** The catalog row for `item()`, at the price a competitor match produced. */
  function live(price: number | null, overrides: Partial<BackVaultCatalogEntry> = {}): BackVaultCatalogEntry {
    return { ...entry(handleFor(item()), 'old-hash', 'ACTIVE', true, [], price), ...overrides };
  }

  it('pins a price that would fall, and leaves the rest of the item alone', () => {
    const one = item();
    const stats = pinLivePricesWhenCompetitorUnavailable([one], [live(69800)]);
    expect(stats).toEqual({ pinned: 1, multiVariant: 0 });
    expect(one.priceUsd).toBe(69800);
    expect(one.costUsd).toBe(67600);
    expect(one.imageUrls).toEqual(['https://cdn.example.com/J10605.jpg']);
  });

  it('leaves an equal or higher computed price untouched', () => {
    const equal = item({ priceUsd: 69800 });
    const higher = item({ priceUsd: 70000 });
    expect(pinLivePricesWhenCompetitorUnavailable([equal, higher], [live(69800)])).toEqual({
      pinned: 0,
      multiVariant: 0,
    });
    expect(equal.priceUsd).toBe(69800);
    expect(higher.priceUsd).toBe(70000);
  });

  it('stands down when the live price cannot be read', () => {
    const one = item();
    expect(pinLivePricesWhenCompetitorUnavailable([one], [live(null)])).toEqual({ pinned: 0, multiVariant: 0 });
    expect(one.priceUsd).toBe(68100);
  });

  it('stands down and counts a multi-variant piece whose price would have fallen', () => {
    const one = item();
    const stats = pinLivePricesWhenCompetitorUnavailable(
      [one],
      [live(null, { variantCount: 3, firstVariantPrice: 69800 })],
    );
    expect(stats).toEqual({ pinned: 0, multiVariant: 1 });
    expect(one.priceUsd).toBe(68100);
  });

  it('does not count a multi-variant piece that was never in question', () => {
    const rising = item({ priceUsd: 70000 });
    const unreadable = item({ priceUsd: 70000, sourceHandle: 'other-piece-rr9688' });
    expect(
      pinLivePricesWhenCompetitorUnavailable(
        [rising],
        [live(null, { variantCount: 3, firstVariantPrice: 69800 })],
      ),
    ).toEqual({ pinned: 0, multiVariant: 0 });
    expect(
      pinLivePricesWhenCompetitorUnavailable(
        [unreadable],
        [
          {
            ...live(null, { variantCount: 3, firstVariantPrice: null }),
            handle: handleFor(unreadable),
          },
        ],
      ),
    ).toEqual({ pinned: 0, multiVariant: 0 });
  });

  it('ignores a piece that is not on the store yet', () => {
    const one = item();
    expect(pinLivePricesWhenCompetitorUnavailable([one], [])).toEqual({ pinned: 0, multiVariant: 0 });
    expect(one.priceUsd).toBe(68100);
  });

  it('still updates a pinned piece whose other content changed', () => {
    const one = item({ imageUrls: ['https://cdn.example.com/new.jpg'], costUsd: 60000 });
    const catalog = [live(69800)];
    pinLivePricesWhenCompetitorUnavailable([one], catalog);
    const decisions = diffBackVaultCatalog(
      [{ handle: handleFor(one), contentHash: contentHashFor(one) }],
      catalog,
    );
    expect(decisions[0]).toMatchObject({ action: 'update', reason: 'hash_changed' });
    // The hash is computed from the item AS WRITTEN, so a re-run with the same
    // pinned price sees no change rather than staying dirty forever.
    const second = diffBackVaultCatalog(
      [{ handle: handleFor(one), contentHash: contentHashFor(one) }],
      [{ ...catalog[0]!, contentHash: contentHashFor(one) }],
    );
    expect(second[0]!.action).toBe('skip');
  });

  it('still publishes a pinned piece that is missing a sales channel', () => {
    const one = item();
    const catalog = [live(69800, { published: false, missingChannels: ['Pinterest'] })];
    pinLivePricesWhenCompetitorUnavailable([one], catalog);
    const catalogAtHash = [{ ...catalog[0]!, contentHash: contentHashFor(one) }];
    const decisions = diffBackVaultCatalog([{ handle: handleFor(one), contentHash: contentHashFor(one) }], catalogAtHash);
    expect(decisions[0]).toMatchObject({ action: 'publish', reason: 'unpublished' });
  });

  it('still reactivates a pinned piece that is DRAFT or ARCHIVED', () => {
    for (const status of ['DRAFT', 'ARCHIVED']) {
      const one = item();
      const catalog = [live(69800, { status })];
      pinLivePricesWhenCompetitorUnavailable([one], catalog);
      const decisions = diffBackVaultCatalog(
        [{ handle: handleFor(one), contentHash: contentHashFor(one) }],
        [{ ...catalog[0]!, contentHash: contentHashFor(one) }],
      );
      expect(decisions[0]).toMatchObject({ action: 'update', reason: 'reactivate' });
    }
  });

  it('is never consulted when the competitor fetch succeeded', () => {
    // The caller only calls it on a failure; with a successful fetch the
    // computed midpoint is written even when it is lower than the live price.
    const one = item({ priceUsd: 68100, competitorPriceUsd: 68600 });
    const catalog = [live(69800)];
    const decisions = diffBackVaultCatalog(
      [{ handle: handleFor(one), contentHash: contentHashFor(one) }],
      catalog,
    );
    expect(decisions[0]).toMatchObject({ action: 'update', reason: 'hash_changed' });
    expect(one.priceUsd).toBe(68100);
  });
});
