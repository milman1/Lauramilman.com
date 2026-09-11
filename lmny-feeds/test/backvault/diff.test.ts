import { describe, expect, it } from 'vitest';
import {
  diffBackVaultCatalog,
  heldForCompetitorUnavailable,
  promoteBackVaultInventoryUpdates,
} from '../../src/backvault/diff.js';
import type { BackVaultCatalogEntry } from '../../src/backvault/catalog.js';

function entry(
  handle: string,
  hash: string | null,
  status = 'ACTIVE',
  published = true,
  missingChannels: string[] = published ? [] : ['Online Store'],
  price: number | null = null,
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
 * Competitor-unavailable guard. Retail is max((cost + competitor) / 2, cost +
 * markup), so a competitor-matched piece sits at or above the flat price; if
 * the competitor fetch fails, writing the flat price would cut every one of
 * them and the next good run would put them back. That churn is held.
 */
describe('diffBackVaultCatalog with the competitor unavailable', () => {
  const live = (price: number) => [entry('bv-cartier', 'old-hash', 'ACTIVE', true, [], price)];

  it('holds an update that would lower the live price', () => {
    const decisions = diffBackVaultCatalog(
      [{ handle: 'bv-cartier', contentHash: 'new-hash', priceUsd: 68100 }],
      live(69800),
      { competitorUnavailable: true },
    );
    expect(decisions[0]).toEqual({
      handle: 'bv-cartier',
      action: 'skip',
      reason: 'competitor-unavailable-would-lower-price',
      productId: 'gid://shopify/Product/bv-cartier',
    });
    expect(heldForCompetitorUnavailable(decisions)).toBe(1);
  });

  it('writes an update that raises the price', () => {
    const decisions = diffBackVaultCatalog(
      [{ handle: 'bv-cartier', contentHash: 'new-hash', priceUsd: 70000 }],
      live(69800),
      { competitorUnavailable: true },
    );
    expect(decisions[0]!.action).toBe('update');
    expect(heldForCompetitorUnavailable(decisions)).toBe(0);
  });

  it('writes an update that leaves the price equal', () => {
    const decisions = diffBackVaultCatalog(
      [{ handle: 'bv-cartier', contentHash: 'new-hash', priceUsd: 69800 }],
      live(69800),
      { competitorUnavailable: true },
    );
    expect(decisions[0]!.action).toBe('update');
  });

  it('does nothing when the competitor fetch succeeded, even at a lower price', () => {
    const decisions = diffBackVaultCatalog(
      [{ handle: 'bv-cartier', contentHash: 'new-hash', priceUsd: 68100 }],
      live(69800),
    );
    expect(decisions[0]!.action).toBe('update');
    expect(heldForCompetitorUnavailable(decisions)).toBe(0);
  });

  it('writes a create and an archive as normal', () => {
    const decisions = diffBackVaultCatalog(
      [{ handle: 'bv-new', contentHash: 'h', priceUsd: 1 }],
      live(69800),
      { competitorUnavailable: true },
    );
    expect(decisions.map((d) => d.action)).toEqual(['create', 'archive']);
  });

  it('writes the update when the live price cannot be read', () => {
    const decisions = diffBackVaultCatalog(
      [{ handle: 'bv-cartier', contentHash: 'new-hash', priceUsd: 68100 }],
      [entry('bv-cartier', 'old-hash', 'ACTIVE', true, [], null)],
      { competitorUnavailable: true },
    );
    expect(decisions[0]!.action).toBe('update');
  });

  it('leaves a held piece alone when inventory promotion runs', () => {
    const catalog = live(69800);
    const decisions = diffBackVaultCatalog(
      [{ handle: 'bv-cartier', contentHash: 'new-hash', priceUsd: 68100 }],
      catalog,
      { competitorUnavailable: true },
    );
    expect(promoteBackVaultInventoryUpdates(decisions, catalog)).toBe(0);
    expect(decisions[0]!.reason).toBe('competitor-unavailable-would-lower-price');
  });
});
