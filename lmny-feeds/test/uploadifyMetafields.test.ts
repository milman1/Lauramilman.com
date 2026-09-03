import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '../src/types.js';
import {
  isUploadifyNamespace,
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
