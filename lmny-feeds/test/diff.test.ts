import { describe, expect, it } from 'vitest';
import { isUnavailableProductHandle } from '../config/unavailable.js';
import {
  applyUnavailableArchives,
  diffCatalog,
  kindForHandle,
  promoteShortMediaUpdates,
  skipPricingReviewArchives,
} from '../src/diff.js';
import type { CatalogEntry, DesiredEntry, Kind } from '../src/types.js';

const ALL_KINDS = new Set<Kind>(['natural', 'lab', 'watch']);

function entry(overrides: Partial<CatalogEntry> & { handle: string }): CatalogEntry {
  return {
    id: `gid://shopify/Product/${overrides.handle}`,
    status: 'ACTIVE',
    contentHash: 'h1',
    tags: ['lmny-feed'],
    mediaCount: 1,
    imageCount: 1,
    videoCount: 0,
    ...overrides,
  };
}

function want(handle: string, contentHash = 'h1'): DesiredEntry {
  return { handle, contentHash };
}

describe('kindForHandle', () => {
  it('maps prefixes', () => {
    expect(kindForHandle('nd-abc')).toBe('natural');
    expect(kindForHandle('lg-abc')).toBe('lab');
    expect(kindForHandle('w-abc')).toBe('watch');
    expect(kindForHandle('halo-ring')).toBeNull();
  });
});

describe('diff decisions', () => {
  it('creates items not in the catalog', () => {
    const d = diffCatalog([want('nd-new')], [], ALL_KINDS);
    expect(d).toEqual([{ handle: 'nd-new', action: 'create', reason: 'new' }]);
  });

  it('updates on hash change, skips on match', () => {
    const catalog = [entry({ handle: 'nd-a', contentHash: 'h1' }), entry({ handle: 'nd-b', contentHash: 'old' })];
    const d = diffCatalog([want('nd-a', 'h1'), want('nd-b', 'h1')], catalog, ALL_KINDS);
    expect(d.find((x) => x.handle === 'nd-a')?.action).toBe('skip');
    expect(d.find((x) => x.handle === 'nd-b')?.action).toBe('update');
  });

  it('reactivates archived items that reappear, unless media-quarantined', () => {
    const catalog = [
      entry({ handle: 'nd-back', status: 'ARCHIVED' }),
      entry({ handle: 'nd-broken', status: 'DRAFT', tags: ['lmny-feed', 'media-missing'] }),
    ];
    const d = diffCatalog([want('nd-back'), want('nd-broken')], catalog, ALL_KINDS);
    expect(d.find((x) => x.handle === 'nd-back')).toMatchObject({ action: 'update', reason: 'reactivate' });
    expect(d.find((x) => x.handle === 'nd-broken')).toMatchObject({ action: 'skip', reason: 'media_missing_quarantine' });
  });

  it('archives watches that left the feed, never re-archives', () => {
    const catalog = [entry({ handle: 'w-gone' }), entry({ handle: 'w-long-gone', status: 'ARCHIVED' })];
    const d = diffCatalog([], catalog, ALL_KINDS);
    expect(d.find((x) => x.handle === 'w-gone')).toMatchObject({ action: 'archive', reason: 'left_feed' });
    expect(d.find((x) => x.handle === 'w-long-gone')?.action).toBe('skip');
  });

  it('deletes unavailable loose diamonds, including previously archived ones', () => {
    const catalog = [
      entry({ handle: 'nd-gone' }),
      entry({ handle: 'lg-long-gone', status: 'ARCHIVED' }),
    ];
    const d = diffCatalog([], catalog, ALL_KINDS);
    expect(d.find((x) => x.handle === 'nd-gone')).toMatchObject({ action: 'delete', reason: 'left_feed' });
    expect(d.find((x) => x.handle === 'lg-long-gone')).toMatchObject({ action: 'delete', reason: 'left_feed' });
  });

  it('separates a held-but-still-listed item from one that left the feed', () => {
    const catalog = [entry({ handle: 'nd-held' }), entry({ handle: 'nd-sold' })];
    // nd-held came back in the feed this run; pricing refused it, so it is not
    // in `desired`. It remains recoverable, while the unavailable stone is
    // permanently removed.
    const d = diffCatalog([], catalog, ALL_KINDS, new Set(['nd-held']));
    expect(d.find((x) => x.handle === 'nd-held')).toMatchObject({ action: 'archive', reason: 'held_in_feed' });
    expect(d.find((x) => x.handle === 'nd-sold')).toMatchObject({ action: 'delete', reason: 'left_feed' });
  });

  it('never archives a segment whose feed fetch failed', () => {
    const catalog = [entry({ handle: 'w-safe' }), entry({ handle: 'nd-gone' })];
    const fetched = new Set<Kind>(['natural', 'lab']); // watch feed down
    const d = diffCatalog([], catalog, fetched);
    expect(d.find((x) => x.handle === 'w-safe')).toMatchObject({ action: 'skip', reason: 'feed_unavailable' });
    expect(d.find((x) => x.handle === 'nd-gone')?.action).toBe('delete');
  });

  it('ignores non-feed handles', () => {
    const catalog = [entry({ handle: 'halo-black-and-white-diamond-ring' })];
    expect(diffCatalog([], catalog, ALL_KINDS)).toEqual([]);
  });

  it('does not archive watches held for pricing review', () => {
    const catalog = [entry({ handle: 'w-3613' }), entry({ handle: 'w-sold' })];
    const d = diffCatalog([], catalog, ALL_KINDS, new Set(['w-3613']));
    skipPricingReviewArchives(d, new Set(['w-3613']));
    expect(d.find((x) => x.handle === 'w-3613')).toMatchObject({ action: 'skip', reason: 'pricing_review' });
    expect(d.find((x) => x.handle === 'w-sold')).toMatchObject({ action: 'archive', reason: 'left_feed' });
  });

  it('archives a w- handle watch that left the API even without the feed tag', () => {
    const catalog = [entry({ handle: 'w-sold', tags: [] })];
    const d = diffCatalog([], catalog, ALL_KINDS);
    expect(d.find((x) => x.handle === 'w-sold')).toMatchObject({ action: 'archive', reason: 'left_feed' });
  });

  it('does not archive estate watches (non-w- handles)', () => {
    const catalog = [entry({ handle: 'pre-owned-cartier-tank', tags: [] })];
    expect(diffCatalog([], catalog, ALL_KINDS)).toEqual([]);
  });
});

describe('promoteShortMediaUpdates', () => {
  it('re-opens a hash-skip watch that still has fewer photos than the feed', () => {
    const catalog = [entry({ handle: 'w-3194', contentHash: 'h1', imageCount: 1 })];
    const d = diffCatalog([want('w-3194', 'h1')], catalog, ALL_KINDS);
    expect(d[0]?.action).toBe('skip');
    const n = promoteShortMediaUpdates(d, catalog, new Map([['w-3194', 3]]));
    expect(n).toBe(1);
    expect(d[0]).toMatchObject({ action: 'update', reason: 'media_short' });
  });

  it('leaves a full gallery skipped', () => {
    const catalog = [entry({ handle: 'w-3194', contentHash: 'h1', imageCount: 3 })];
    const d = diffCatalog([want('w-3194', 'h1')], catalog, ALL_KINDS);
    const n = promoteShortMediaUpdates(d, catalog, new Map([['w-3194', 3]]));
    expect(n).toBe(0);
    expect(d[0]?.action).toBe('skip');
  });

  it('does not promote stones or quarantined watches', () => {
    const catalog = [
      entry({ handle: 'nd-a', contentHash: 'h1', imageCount: 1 }),
      entry({ handle: 'w-broken', status: 'DRAFT', tags: ['lmny-feed', 'media-missing'], imageCount: 0 }),
    ];
    const d = diffCatalog([want('nd-a', 'h1'), want('w-broken', 'h1')], catalog, ALL_KINDS);
    const n = promoteShortMediaUpdates(
      d,
      catalog,
      new Map([
        ['nd-a', 3],
        ['w-broken', 4],
      ]),
    );
    expect(n).toBe(0);
    expect(d.find((x) => x.handle === 'nd-a')?.action).toBe('skip');
    expect(d.find((x) => x.handle === 'w-broken')?.reason).toBe('media_missing_quarantine');
  });
});

describe('applyUnavailableArchives', () => {
  it('archives a denylisted estate watch the feed diff would ignore', () => {
    const handle = 'hermes-stainless-steel-kelly-pm-double-tour-gold-tone-blue-watch-rr2954';
    const catalog = [entry({ handle, tags: [] })];
    const d = diffCatalog([], catalog, ALL_KINDS);
    expect(d).toEqual([]);
    const n = applyUnavailableArchives(d, catalog, isUnavailableProductHandle);
    expect(n).toBe(1);
    expect(d[0]).toMatchObject({ action: 'archive', reason: 'merchant_unavailable', handle });
  });

  it('archives the Back Vault duplicate of a denylisted watch', () => {
    const handle = 'bv-hermes-stainless-steel-mother-of-pearl-dial-watch-rr2613';
    const catalog = [entry({ handle, tags: ['backvault-feed'] })];
    const d = diffCatalog([], catalog, ALL_KINDS);
    const n = applyUnavailableArchives(d, catalog, isUnavailableProductHandle);
    expect(n).toBe(1);
    expect(d[0]).toMatchObject({ action: 'archive', reason: 'merchant_unavailable' });
  });

  it('does not reopen a denylisted watch for a gallery backfill', () => {
    const handle = 'hermes-stainless-steel-kelly-pm-double-tour-gold-tone-blue-watch-rr2954';
    const catalog = [entry({ handle, contentHash: 'h1', imageCount: 1 })];
    const d = diffCatalog([want(handle, 'h1')], catalog, ALL_KINDS);
    promoteShortMediaUpdates(d, catalog, new Map([[handle, 3]]));
    applyUnavailableArchives(d, catalog, isUnavailableProductHandle);
    expect(d[0]).toMatchObject({ action: 'archive', reason: 'merchant_unavailable' });
  });

  it('leaves other estate watches alone', () => {
    const catalog = [entry({ handle: 'pre-owned-cartier-tank', tags: [] })];
    const d = diffCatalog([], catalog, ALL_KINDS);
    const n = applyUnavailableArchives(d, catalog, isUnavailableProductHandle);
    expect(n).toBe(0);
    expect(d).toEqual([]);
  });
});
