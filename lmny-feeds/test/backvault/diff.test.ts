import { describe, expect, it } from 'vitest';
import { diffBackVaultCatalog } from '../../src/backvault/diff.js';
import type { BackVaultCatalogEntry } from '../../src/backvault/catalog.js';

function entry(handle: string, hash: string | null, status = 'ACTIVE', published = true): BackVaultCatalogEntry {
  return { id: `gid://shopify/Product/${handle}`, handle, status, contentHash: hash, imageCount: 1, published };
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

  it('never reactivates an inactive item, even when its hash changed', () => {
    const decisions = diffBackVaultCatalog(
      [{ handle: 'bv-cartier', contentHash: 'new' }],
      [entry('bv-cartier', 'old', 'DRAFT')],
    );
    expect(decisions[0]!.action).toBe('skip');
    expect(decisions[0]!.reason).toBe('inactive_preserved');
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
