import { describe, expect, it } from 'vitest';
import {
  applyRememberedCompetitorPrices,
  COMPETITOR_MEMORY_DAYS,
  flatFallbackCount,
  diffBackVaultCatalog,
  promoteBackVaultCompetitorMemory,
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
  remembered: { price: number | null; at: string | null } = { price: null, at: null },
): BackVaultCatalogEntry {
  return {
    id: `gid://shopify/Product/${handle}`,
    handle,
    status,
    contentHash: hash,
    imageCount: 1,
    published,
    missingChannels,
    rememberedCompetitorPrice: remembered.price,
    rememberedCompetitorPriceAt: remembered.at,
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
 * An unmatched piece on an incomplete index is priced from what the last
 * matching run remembered about it, not from its own live ticket. The ticket
 * froze: a piece that once matched kept its old price for as long as the index
 * stayed incomplete, which on this retailer is forever, so a supplier markdown
 * could never reach the storefront. The remembered comparison recomputes the
 * midpoint against the CURRENT cost instead, and expires after
 * COMPETITOR_MEMORY_DAYS.
 */
describe('applyRememberedCompetitorPrices', () => {
  const NOW = Date.parse('2026-09-11T12:00:00Z');
  const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

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

  /** The catalog row for `item()`, carrying a remembered comparison. */
  function live(
    remembered: { price: number | null; at: string | null },
    overrides: Partial<BackVaultCatalogEntry> = {},
  ): BackVaultCatalogEntry {
    return { ...entry(handleFor(item()), 'old-hash', 'ACTIVE', true, [], remembered), ...overrides };
  }

  const HANDLE = handleFor(item());
  const FRESH = { price: 72000, at: daysAgo(7) };

  it('prices an unmatched piece from a fresh memory, against THIS run cost', () => {
    const one = item();
    const stats = applyRememberedCompetitorPrices([one], [live(FRESH)], { indexComplete: false, now: NOW });
    expect(stats).toEqual({ matchedThisRun: 0, pricedFromMemory: 1, memoryHandles: [HANDLE], expired: 0, unusable: 0, flooredToFlat: 0, unremembered: 0 });
    // (67,600 + 72,000) / 2 — the ordinary rule, no special case.
    expect(one.priceUsd).toBe(69800);
    expect(one.competitorPriceUsd).toBe(72000);
    // The date the comparison was READ, carried through, not today.
    expect(one.competitorPriceReadAt).toBe(FRESH.at);
  });

  it('follows a supplier markdown down instead of freezing the ticket', () => {
    // The whole reason the pin was wrong: the supplier cut the cost to 60,000,
    // and the storefront must follow at the same midpoint premium.
    const markedDown = item({ costUsd: 60000, priceUsd: 60500 });
    applyRememberedCompetitorPrices([markedDown], [live(FRESH)], { indexComplete: false, now: NOW });
    expect(markedDown.priceUsd).toBe(66000); // (60,000 + 72,000) / 2, below the old 69,800
  });

  it('follows the supplier up too', () => {
    const dearer = item({ costUsd: 70000, priceUsd: 70500 });
    applyRememberedCompetitorPrices([dearer], [live(FRESH)], { indexComplete: false, now: NOW });
    expect(dearer.priceUsd).toBe(71000);
  });

  it('expires a memory older than COMPETITOR_MEMORY_DAYS', () => {
    const one = item();
    const stats = applyRememberedCompetitorPrices(
      [one],
      [live({ price: 72000, at: daysAgo(COMPETITOR_MEMORY_DAYS + 1) })],
      { indexComplete: false, now: NOW },
    );
    expect(stats).toEqual({ matchedThisRun: 0, pricedFromMemory: 0, memoryHandles: [], expired: 1, unusable: 0, flooredToFlat: 0, unremembered: 0 });
    expect(one.priceUsd).toBe(68100); // flat, exactly as a piece that is not on the competitor
    expect(one.competitorPriceUsd).toBeUndefined();
  });

  it('uses a memory right on the expiry boundary', () => {
    const one = item();
    applyRememberedCompetitorPrices([one], [live({ price: 72000, at: daysAgo(COMPETITOR_MEMORY_DAYS) })], {
      indexComplete: false,
      now: NOW,
    });
    expect(one.priceUsd).toBe(69800);
  });

  it('counts a memory with no readable date as unusable, not expired', () => {
    // It never expired — it was never usable: with no date there is nothing to
    // age, and a comparison of unknown age cannot price a live listing.
    for (const at of [null, 'last tuesday', '']) {
      const one = item();
      const stats = applyRememberedCompetitorPrices([one], [live({ price: 72000, at })], {
        indexComplete: false,
        now: NOW,
      });
      expect(stats.unusable).toBe(1);
      expect(stats.expired).toBe(0);
      expect(stats.unremembered).toBe(0);
      expect(one.priceUsd).toBe(68100);
    }
  });

  it('counts a remembered midpoint that lost to the floor as a flat fallback', () => {
    // (67,600 + 60,000) / 2 = 63,800, under the flat 68,100 the piece is
    // written at. The memory decided nothing, so claiming the piece was
    // "priced from a remembered comparison" would be false.
    const one = item();
    const stats = applyRememberedCompetitorPrices([one], [live({ price: 60000, at: daysAgo(7) })], {
      indexComplete: false,
      now: NOW,
    });
    expect(stats.pricedFromMemory).toBe(0);
    expect(stats.memoryHandles).toEqual([]);
    expect(stats.flooredToFlat).toBe(1);
    expect(flatFallbackCount(stats)).toBe(1);
    expect(one.priceUsd).toBe(68100);
    // Left untouched: nothing about this piece's price came from the memory.
    expect(one.competitorPriceUsd).toBeUndefined();
  });

  it('counts a matched piece against the same set as everything else', () => {
    const matched = item({ priceUsd: 68800, competitorPriceUsd: 70000 });
    const fromMemory = item({ sourceHandle: 'rolex-datejust-rr9688' });
    const stats = applyRememberedCompetitorPrices(
      [matched, fromMemory],
      [live(FRESH), { ...live(FRESH), handle: handleFor(fromMemory) }],
      { indexComplete: false, now: NOW },
    );
    expect(stats.matchedThisRun).toBe(1);
    expect(stats.pricedFromMemory).toBe(1);
    expect(flatFallbackCount(stats)).toBe(0);
  });

  it('counts a piece with nothing remembered and leaves it flat', () => {
    const one = item();
    const stats = applyRememberedCompetitorPrices([one], [live({ price: null, at: null })], {
      indexComplete: false,
      now: NOW,
    });
    expect(stats).toEqual({ matchedThisRun: 0, pricedFromMemory: 0, memoryHandles: [], expired: 0, unusable: 0, flooredToFlat: 0, unremembered: 1 });
    expect(one.priceUsd).toBe(68100);
  });

  it('ignores memory entirely when the index is complete', () => {
    const one = item();
    const stats = applyRememberedCompetitorPrices([one], [live({ price: 72000, at: daysAgo(1) })], {
      indexComplete: true,
      now: NOW,
    });
    expect(stats.pricedFromMemory).toBe(0);
    expect(one.priceUsd).toBe(68100);
    expect(one.competitorPriceUsd).toBeUndefined();
  });

  it('leaves a piece that matched this run alone, and stamps today on it', () => {
    const matched = item({ priceUsd: 68800, competitorPriceUsd: 70000 });
    const stats = applyRememberedCompetitorPrices([matched], [live({ price: 72000, at: daysAgo(1) })], {
      indexComplete: false,
      now: NOW,
    });
    expect(stats.pricedFromMemory).toBe(0);
    // A fresh match wins over memory, in both value and date.
    expect(matched.competitorPriceUsd).toBe(70000);
    expect(matched.priceUsd).toBe(68800);
    expect(matched.competitorPriceReadAt).toBe(new Date(NOW).toISOString());
  });

  it('ignores a piece that is not on the store yet', () => {
    const one = item();
    const stats = applyRememberedCompetitorPrices([one], [], { indexComplete: false, now: NOW });
    expect(stats).toEqual({ matchedThisRun: 0, pricedFromMemory: 0, memoryHandles: [], expired: 0, unusable: 0, flooredToFlat: 0, unremembered: 0 });
    expect(one.priceUsd).toBe(68100);
  });

  it('keeps the hash stable across two runs on the same memory', () => {
    const runOne = item();
    const catalog = [live(FRESH)];
    applyRememberedCompetitorPrices([runOne], catalog, { indexComplete: false, now: NOW });
    const hash = contentHashFor(runOne);
    const runTwo = item();
    applyRememberedCompetitorPrices([runTwo], catalog, {
      indexComplete: false,
      now: NOW + 7 * 24 * 60 * 60 * 1000,
    });
    // The read date is not in the hash, so a week later nothing is dirty.
    expect(contentHashFor(runTwo)).toBe(hash);
  });

  it('still updates, publishes and reactivates a piece priced from memory', () => {
    const changed = item({ imageUrls: ['https://cdn.example.com/new.jpg'] });
    applyRememberedCompetitorPrices([changed], [live(FRESH)], { indexComplete: false, now: NOW });
    const want = [{ handle: HANDLE, contentHash: contentHashFor(changed) }];
    expect(diffBackVaultCatalog(want, [live(FRESH)])[0]).toMatchObject({
      action: 'update',
      reason: 'hash_changed',
    });
    expect(
      diffBackVaultCatalog(want, [
        live(FRESH, { contentHash: want[0]!.contentHash, published: false, missingChannels: ['Pinterest'] }),
      ])[0],
    ).toMatchObject({ action: 'publish', reason: 'unpublished' });
    expect(
      diffBackVaultCatalog(want, [live(FRESH, { contentHash: want[0]!.contentHash, status: 'DRAFT' })])[0],
    ).toMatchObject({ action: 'update', reason: 'reactivate' });
  });
});

/**
 * The memory is only written when the product is written, and the read date is
 * deliberately not in the content hash, so a piece that matches every week but
 * never otherwise changes would let its own memory expire. This promotion is
 * what stops that.
 */
describe('promoteBackVaultCompetitorMemory', () => {
  const NOW = Date.parse('2026-09-11T12:00:00Z');
  const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

  function matched(): BackVaultItem {
    return {
      sourceHandle: 'cartier-dolphin-ring-j10605',
      title: 'Cartier Dolphin Ring',
      vendorRaw: 'Cartier',
      vendor: 'Cartier',
      productType: 'Ring',
      descriptionHtml: '<p>18K Yellow Gold.</p>',
      costUsd: 67600,
      priceUsd: 69800,
      competitorPriceUsd: 72000,
      available: true,
      sku: 'J10605',
      imageUrls: ['https://cdn.example.com/J10605.jpg'],
      specs: {},
    };
  }

  function skipDecision(handle: string) {
    return [{ handle, action: 'skip' as const, reason: 'unchanged', productId: 'gid://shopify/Product/1' }];
  }

  it('rewrites a piece whose remembered comparison is going stale', () => {
    const one = matched();
    const handle = handleFor(one);
    const decisions = skipDecision(handle);
    const promoted = promoteBackVaultCompetitorMemory(
      decisions,
      [one],
      [entry(handle, 'hash', 'ACTIVE', true, [], { price: 72000, at: daysAgo(45) })],
      { now: NOW },
    );
    expect(promoted).toBe(1);
    expect(decisions[0]).toMatchObject({ action: 'update', reason: 'competitor_memory_refresh' });
  });

  it('rewrites a piece with nothing remembered, or a different price remembered', () => {
    const one = matched();
    const handle = handleFor(one);
    for (const remembered of [
      { price: null, at: null },
      { price: 70000, at: daysAgo(1) },
    ]) {
      const decisions = skipDecision(handle);
      promoteBackVaultCompetitorMemory(
        decisions,
        [one],
        [entry(handle, 'hash', 'ACTIVE', true, [], remembered)],
        { now: NOW },
      );
      expect(decisions[0]!.action).toBe('update');
    }
  });

  it('compares the remembered value on the two decimals it is stored at', () => {
    // The metafield round-trips through toFixed(2), so 72,000.004 and 72,000
    // are the same stored price. Comparing raw floats here would leave the
    // decision resting on where the subtraction happens to land.
    const one = matched();
    one.competitorPriceUsd = 72000.004;
    const handle = handleFor(one);
    const same = skipDecision(handle);
    expect(
      promoteBackVaultCompetitorMemory(same, [one], [entry(handle, 'hash', 'ACTIVE', true, [], { price: 72000, at: daysAgo(3) })], {
        now: NOW,
      }),
    ).toBe(0);
    expect(same[0]!.action).toBe('skip');

    // A cent apart is a different price and must be rewritten.
    one.competitorPriceUsd = 72000.01;
    const differs = skipDecision(handle);
    expect(
      promoteBackVaultCompetitorMemory(differs, [one], [entry(handle, 'hash', 'ACTIVE', true, [], { price: 72000, at: daysAgo(3) })], {
        now: NOW,
      }),
    ).toBe(1);
    expect(differs[0]!.action).toBe('update');
  });

  it('leaves a fresh, matching memory alone', () => {
    const one = matched();
    const handle = handleFor(one);
    const decisions = skipDecision(handle);
    const promoted = promoteBackVaultCompetitorMemory(
      decisions,
      [one],
      [entry(handle, 'hash', 'ACTIVE', true, [], { price: 72000, at: daysAgo(3) })],
      { now: NOW },
    );
    expect(promoted).toBe(0);
    expect(decisions[0]!.action).toBe('skip');
  });

  it('never promotes a piece that did not match this run', () => {
    const one = matched();
    delete one.competitorPriceUsd;
    const handle = handleFor(one);
    const decisions = skipDecision(handle);
    promoteBackVaultCompetitorMemory(
      decisions,
      [one],
      [entry(handle, 'hash', 'ACTIVE', true, [], { price: null, at: null })],
      { now: NOW },
    );
    expect(decisions[0]!.action).toBe('skip');
  });
});

describe('promoteBackVaultCompetitorMemory never rewrites a memory-priced piece', () => {
  const NOW = Date.parse('2026-09-11T12:00:00Z');
  const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

  it('leaves a piece priced FROM memory alone, however stale that memory is', () => {
    // It carries a competitorPriceUsd like a matched piece, but rewriting it
    // would store the same value under the same old date, every week forever.
    const one: BackVaultItem = {
      sourceHandle: 'cartier-dolphin-ring-j10605',
      title: 'Cartier Dolphin Ring',
      vendorRaw: 'Cartier',
      vendor: 'Cartier',
      productType: 'Ring',
      descriptionHtml: '<p>18K Yellow Gold.</p>',
      costUsd: 67600,
      priceUsd: 69800,
      competitorPriceUsd: 72000,
      competitorPriceReadAt: daysAgo(60),
      available: true,
      sku: 'J10605',
      imageUrls: ['https://cdn.example.com/J10605.jpg'],
      specs: {},
    };
    const handle = handleFor(one);
    const decisions = [
      { handle, action: 'skip' as const, reason: 'unchanged', productId: 'gid://shopify/Product/1' },
    ];
    const promoted = promoteBackVaultCompetitorMemory(
      decisions,
      [one],
      [entry(handle, 'hash', 'ACTIVE', true, [], { price: 72000, at: daysAgo(60) })],
      { now: NOW, pricedFromMemory: [handle] },
    );
    expect(promoted).toBe(0);
    expect(decisions[0]!.action).toBe('skip');
  });
});
