import { describe, expect, it } from 'vitest';
import { parseFeedCatalogRows, parseUploadifyActiveOwnerRows } from '../src/shopify.js';

describe('parseFeedCatalogRows', () => {
  it('counts READY images and records untracked watch inventory', () => {
    const catalog = parseFeedCatalogRows([
      {
        id: 'gid://shopify/Product/1',
        handle: 'w-3194',
        status: 'ACTIVE',
        tags: ['lmny-feed'],
        metafield: { value: 'h1' },
      },
      {
        __parentId: 'gid://shopify/Product/1',
        status: 'READY',
        mediaContentType: 'IMAGE',
      },
      {
        __parentId: 'gid://shopify/Product/1',
        sku: '3194',
        inventoryQuantity: 0,
        inventoryItem: { id: 'gid://shopify/InventoryItem/9', tracked: false },
      },
    ]);
    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({
      handle: 'w-3194',
      imageCount: 1,
      mediaCount: 1,
      inventoryTracked: false,
      inventoryItemId: 'gid://shopify/InventoryItem/9',
      inventoryQuantity: 0,
      contentHash: 'h1',
      variantSku: '3194',
      uploadifyVendorSku: null,
    });
  });

  it('records tracked qty for a repaired watch', () => {
    const catalog = parseFeedCatalogRows([
      {
        id: 'gid://shopify/Product/2',
        handle: 'w-ok',
        status: 'ACTIVE',
        tags: ['lmny-feed'],
        metafield: null,
      },
      {
        __parentId: 'gid://shopify/Product/2',
        sku: 'OK',
        inventoryQuantity: 1,
        inventoryItem: { id: 'gid://shopify/InventoryItem/2', tracked: true },
      },
    ]);
    expect(catalog[0]).toMatchObject({
      inventoryTracked: true,
      inventoryQuantity: 1,
    });
  });

  it('collects uploadify metafields and ignores other namespaces', () => {
    const catalog = parseFeedCatalogRows([
      {
        id: 'gid://shopify/Product/3',
        handle: 'nd-1',
        status: 'ACTIVE',
        tags: ['lmny-feed'],
        metafield: { value: 'h' },
        uploadifyActive: {
          id: 'gid://shopify/Metafield/1',
          namespace: 'uploadify_product',
          key: 'uploadify_active',
          value: 'true',
        },
        uploadifyVendorSku: { value: '  ND1  ' },
      },
      {
        __parentId: 'gid://shopify/Product/3',
        id: 'gid://shopify/Metafield/2',
        namespace: 'uploadify',
        key: 'listing_id',
      },
      {
        __parentId: 'gid://shopify/Product/3',
        id: 'gid://shopify/Metafield/3',
        namespace: 'custom',
        key: 'color',
      },
    ]);
    expect(catalog[0]?.uploadifyActive).toBe(true);
    expect(catalog[0]?.uploadifyVendorSku).toBe('ND1');
    expect(catalog[0]?.uploadifyMetafields).toEqual([
      {
        id: 'gid://shopify/Metafield/1',
        namespace: 'uploadify_product',
        key: 'uploadify_active',
      },
      {
        id: 'gid://shopify/Metafield/2',
        namespace: 'uploadify',
        key: 'listing_id',
      },
    ]);
  });

  it('lists only products that actually have uploadify_active', () => {
    expect(
      parseUploadifyActiveOwnerRows([
        {
          id: 'gid://shopify/Product/1',
          handle: 'w-3194',
          uploadifyActive: { id: 'gid://shopify/Metafield/1' },
        },
        { id: 'gid://shopify/Product/2', handle: 'bv-ring', uploadifyActive: null },
        {
          id: 'gid://shopify/Product/3',
          handle: 'fine-necklace',
          uploadifyActive: { id: 'gid://shopify/Metafield/3' },
        },
        {
          id: 'gid://shopify/Product/3',
          handle: 'fine-necklace',
          uploadifyActive: { id: 'gid://shopify/Metafield/3' },
        },
      ]),
    ).toEqual([
      { id: 'gid://shopify/Product/1', handle: 'w-3194' },
      { id: 'gid://shopify/Product/3', handle: 'fine-necklace' },
    ]);
  });
});
