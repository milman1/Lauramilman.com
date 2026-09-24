import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '../src/types.js';
import {
  isUploadifyNamespace,
  uploadifyActiveDeletesExcept,
  uploadifyActiveWrites,
  uploadifyMetafieldDeletesForDiamonds,
} from '../src/uploadifyMetafields.js';

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

describe('isUploadifyNamespace', () => {
  it('matches Uploadify-owned namespaces only', () => {
    expect(isUploadifyNamespace('uploadify')).toBe(true);
    expect(isUploadifyNamespace('uploadify_product')).toBe(true);
    expect(isUploadifyNamespace('custom')).toBe(false);
    expect(isUploadifyNamespace('lmny_feed')).toBe(false);
  });
});

describe('uploadifyMetafieldDeletesForDiamonds', () => {
  it('deletes Uploadify metafields on natural and lab diamonds', () => {
    const catalog = [
      entry({
        handle: 'nd-one',
        uploadifyMetafields: [
          { id: 'gid://shopify/Metafield/1', namespace: 'uploadify_product', key: 'uploadify_active' },
        ],
      }),
      entry({
        handle: 'lg-two',
        uploadifyMetafields: [{ id: 'gid://shopify/Metafield/2', namespace: 'uploadify', key: 'ebay_item_id' }],
      }),
    ];
    expect(uploadifyMetafieldDeletesForDiamonds(catalog)).toEqual([
      { ownerId: 'gid://shopify/Product/nd-one', namespace: 'uploadify_product', key: 'uploadify_active' },
      { ownerId: 'gid://shopify/Product/lg-two', namespace: 'uploadify', key: 'ebay_item_id' },
    ]);
  });

  it('does not delete Uploadify metafields on watches', () => {
    const catalog = [
      entry({
        handle: 'w-3194',
        uploadifyMetafields: [
          { id: 'gid://shopify/Metafield/3', namespace: 'uploadify_product', key: 'uploadify_active' },
        ],
      }),
    ];
    expect(uploadifyMetafieldDeletesForDiamonds(catalog)).toEqual([]);
  });

  it('ignores diamonds with no Uploadify metafields', () => {
    expect(
      uploadifyMetafieldDeletesForDiamonds([
        entry({ handle: 'nd-clean' }),
        entry({ handle: 'lg-clean', uploadifyMetafields: [] }),
      ]),
    ).toEqual([]);
  });

  it('dedupes the same namespace.key on one diamond', () => {
    const catalog = [
      entry({
        handle: 'lg-dup',
        uploadifyMetafields: [
          { id: 'gid://shopify/Metafield/4', namespace: 'uploadify_product', key: 'uploadify_active' },
          { id: 'gid://shopify/Metafield/4', namespace: 'uploadify_product', key: 'uploadify_active' },
        ],
      }),
    ];
    expect(uploadifyMetafieldDeletesForDiamonds(catalog)).toHaveLength(1);
  });
});

describe('uploadifyActiveWrites', () => {
  it('sets uploadify_active true on a watch that is not already on', () => {
    const { writes, missingOwner } = uploadifyActiveWrites([
      { handle: 'w-3194', ownerId: 'gid://shopify/Product/1', current: null, desired: true },
      { handle: 'w-ok', ownerId: 'gid://shopify/Product/2', current: true, desired: true },
    ]);
    expect(missingOwner).toBe(0);
    expect(writes).toEqual([
      {
        ownerId: 'gid://shopify/Product/1',
        namespace: 'uploadify_product',
        key: 'uploadify_active',
        type: 'boolean',
        value: 'true',
      },
    ]);
  });

  it('never writes the flag onto a watch that does not qualify', () => {
    const { writes, missingOwner } = uploadifyActiveWrites([
      { handle: 'w-draft', ownerId: 'gid://shopify/Product/3', current: true, desired: false },
      { handle: 'w-new-draft', ownerId: null, current: null, desired: false },
      { handle: 'bv-estate-watch', ownerId: 'gid://shopify/Product/8', current: null, desired: true },
    ]);
    expect(writes).toEqual([]);
    expect(missingOwner).toBe(0);
  });

  it('counts watches that qualify but have no Shopify id yet, and ignores diamonds', () => {
    const { writes, missingOwner } = uploadifyActiveWrites([
      { handle: 'w-new', ownerId: null, current: null, desired: true },
      { handle: 'nd-one', ownerId: 'gid://shopify/Product/9', current: null, desired: true },
    ]);
    expect(writes).toEqual([]);
    expect(missingOwner).toBe(1);
  });
});

describe('uploadifyActiveDeletesExcept', () => {
  const keep = new Set(['w-3194']);

  it('removes the flag from everything except qualifying Belgium Dia watches', () => {
    expect(
      uploadifyActiveDeletesExcept(
        [
          { id: 'gid://shopify/Product/1', handle: 'w-3194' },
          { id: 'gid://shopify/Product/2', handle: 'w-draft' },
          { id: 'gid://shopify/Product/3', handle: 'bv-cartier-ring' },
          { id: 'gid://shopify/Product/4', handle: 'nd-stone' },
          { id: 'gid://shopify/Product/5', handle: 'rolex-submariner' },
        ],
        keep,
      ),
    ).toEqual([
      { ownerId: 'gid://shopify/Product/2', namespace: 'uploadify_product', key: 'uploadify_active' },
      { ownerId: 'gid://shopify/Product/3', namespace: 'uploadify_product', key: 'uploadify_active' },
      { ownerId: 'gid://shopify/Product/4', namespace: 'uploadify_product', key: 'uploadify_active' },
      { ownerId: 'gid://shopify/Product/5', namespace: 'uploadify_product', key: 'uploadify_active' },
    ]);
  });

  it('does not keep a non-Belgium handle even if it was named by mistake', () => {
    expect(
      uploadifyActiveDeletesExcept(
        [{ id: 'gid://shopify/Product/9', handle: 'estate-watch' }],
        new Set(['estate-watch']),
      ),
    ).toEqual([
      { ownerId: 'gid://shopify/Product/9', namespace: 'uploadify_product', key: 'uploadify_active' },
    ]);
  });
});
