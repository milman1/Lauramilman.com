import { describe, expect, it } from 'vitest';
import { diffCatalog, kindForHandle, promoteShortMediaUpdates } from '../src/diff.js';
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

  it('archives items that left the feed, never re-archives', () => {
    const catalog = [entry({ handle: 'w-gone' }), entry({ handle: 'w-long-gone', status: 'ARCHIVED' })];
    const d = diffCatalog([], catalog, ALL_KINDS);
    expect(d.find((x) => x.handle === 'w-gone')).toMatchObject({ action: 'archive', reason: 'left_feed' });
    expect(d.find((x) => x.handle === 'w-long-gone')?.action).toBe('skip');
  });

  it('separates a held-but-still-listed item from one that left the feed', () => {
    const catalog = [entry({ handle: 'w-held' }), entry({ handle: 'w-sold' })];
    // w-held came back in the feed this run; pricing refused it, so it is not
    // in `desired`. Archiving both is right; calling both "sold" is not.
    const d = diffCatalog([], catalog, ALL_KINDS, new Set(['w-held']));
    expect(d.find((x) => x.handle === 'w-held')).toMatchObject({ action: 'archive', reason: 'held_in_feed' });
    expect(d.find((x) => x.handle === 'w-sold')).toMatchObject({ action: 'archive', reason: 'left_feed' });
  });

  it('never archives a segment whose feed fetch failed', () => {
    const catalog = [entry({ handle: 'w-safe' }), entry({ handle: 'nd-gone' })];
    const fetched = new Set<Kind>(['natural', 'lab']); // watch feed down
    const d = diffCatalog([], catalog, fetched);
    expect(d.find((x) => x.handle === 'w-safe')).toMatchObject({ action: 'skip', reason: 'feed_unavailable' });
    expect(d.find((x) => x.handle === 'nd-gone')?.action).toBe('archive');
  });

  it('ignores non-feed handles', () => {
    const catalog = [entry({ handle: 'halo-black-and-white-diamond-ring' })];
    expect(diffCatalog([], catalog, ALL_KINDS)).toEqual([]);
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
