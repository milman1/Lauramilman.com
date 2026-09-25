import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '../src/types.js';
import {
  isUploadifyNamespace,
  uploadifyActiveDeletesExcept,
  uploadifyActiveWrites,
  uploadifyJewelryQualifies,
  uploadifyKeepHandles,
  uploadifyMetafieldDeletesForDiamonds,
  uploadifyVendorSkuDeletesFor,
  uploadifyVendorSkuForVariants,
  uploadifyVendorSkuWrites,
  type UploadifyJewelryCandidate,
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

describe('uploadifyVendorSkuWrites', () => {
  it('copies the stock number when Vendor SKU is blank', () => {
    const { writes, missingOwner } = uploadifyVendorSkuWrites([
      {
        handle: 'w-rw3036',
        ownerId: 'gid://shopify/Product/1',
        desired: true,
        stockRef: 'RW3036',
        current: null,
      },
      {
        handle: 'w-t3487',
        ownerId: 'gid://shopify/Product/2',
        desired: true,
        stockRef: 'T3487',
        current: 'T3487',
      },
    ]);
    expect(missingOwner).toBe(0);
    expect(writes).toEqual([
      {
        ownerId: 'gid://shopify/Product/1',
        namespace: 'uploadify_product',
        key: 'vendor_sku',
        type: 'single_line_text_field',
        value: 'RW3036',
      },
    ]);
  });

  it('skips watches that do not qualify, blank stock numbers, and non-watches', () => {
    const { writes, missingOwner } = uploadifyVendorSkuWrites([
      { handle: 'w-draft', ownerId: 'gid://shopify/Product/3', desired: false, stockRef: 'DRAFT', current: null },
      { handle: 'w-blank', ownerId: 'gid://shopify/Product/4', desired: true, stockRef: '  ', current: null },
      { handle: 'nd-one', ownerId: 'gid://shopify/Product/5', desired: true, stockRef: 'ND1', current: null },
      { handle: 'bv-estate', ownerId: 'gid://shopify/Product/6', desired: true, stockRef: 'J1', current: null },
    ]);
    expect(writes).toEqual([]);
    expect(missingOwner).toBe(0);
  });

  it('counts a qualifying watch that has no Shopify id yet', () => {
    const { writes, missingOwner } = uploadifyVendorSkuWrites([
      { handle: 'w-new', ownerId: null, desired: true, stockRef: 'NEW1', current: '' },
    ]);
    expect(writes).toEqual([]);
    expect(missingOwner).toBe(1);
  });
});

describe('uploadifyVendorSkuDeletesFor', () => {
  it('adds a vendor_sku delete for each uploadify_active delete', () => {
    expect(
      uploadifyVendorSkuDeletesFor([
        { ownerId: 'gid://shopify/Product/2', namespace: 'uploadify_product', key: 'uploadify_active' },
        { ownerId: 'gid://shopify/Product/9', namespace: 'uploadify', key: 'listing_id' },
      ]),
    ).toEqual([
      { ownerId: 'gid://shopify/Product/2', namespace: 'uploadify_product', key: 'vendor_sku' },
    ]);
  });
});

function jewelry(overrides: Partial<UploadifyJewelryCandidate> & { handle: string }): UploadifyJewelryCandidate {
  return {
    id: `gid://shopify/Product/${overrides.handle}`,
    status: 'ACTIVE',
    vendor: 'Peaceful Diamonds',
    productType: 'Bracelet',
    tags: ['lab-grown'],
    title: 'Lab diamond tennis bracelet',
    descriptionHtml: '<p>Lab grown diamond tennis bracelet in 14k white gold.</p>',
    categoryId: 'gid://shopify/TaxonomyCategory/aa-6-3',
    inChainsCollection: false,
    uploadifyActive: null,
    uploadifyVendorSku: null,
    variants: [{ sku: 'BC14WTSRD150P', qty: 1, tracked: true, priceUsd: 2500 }],
    ...overrides,
  };
}

describe('uploadifyJewelryQualifies', () => {
  it('accepts an active lab-grown piece with sku, quantity, price, copy, and category', () => {
    expect(uploadifyJewelryQualifies(jewelry({ handle: 'lab-diamond-tennis-bracelet' }))).toBe(true);
  });

  it('accepts an active gold chain and rejects fine jewelry', () => {
    expect(
      uploadifyJewelryQualifies(
        jewelry({
          handle: 'lmny-cuban-3-9-mm-nmc120',
          vendor: 'Laura Milman New York',
          tags: [],
          productType: 'Necklaces',
          inChainsCollection: true,
          variants: [
            { sku: 'NMC120-18', qty: 1, tracked: true, priceUsd: 900 },
            { sku: 'NMC120-20', qty: 1, tracked: true, priceUsd: 980 },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      uploadifyJewelryQualifies(
        jewelry({
          handle: 'cluster-diamond-studs',
          vendor: 'Laura Milman New York',
          tags: [],
          inChainsCollection: false,
        }),
      ),
    ).toBe(false);
  });

  it('treats a finished piece tagged Lab Grown Diamond as lab jewelry', () => {
    expect(
      uploadifyJewelryQualifies(
        jewelry({
          handle: 'lab-grown-heart-shaped-diamond-pendant-in-14k-white-gold-90ct',
          vendor: 'Laura Milman New York',
          tags: ['Lab Grown Diamond', 'Necklaces'],
          productType: '',
        }),
      ),
    ).toBe(true);
  });

  it('rejects drafts, loose stones, missing sku, zero quantity, and a blank category', () => {
    expect(uploadifyJewelryQualifies(jewelry({ handle: 'lab-draft', status: 'DRAFT' }))).toBe(false);
    expect(uploadifyJewelryQualifies(jewelry({ handle: 'lg-stone', productType: 'Lab-Grown Diamond', tags: ['lab-grown'] }))).toBe(false);
    expect(uploadifyJewelryQualifies(jewelry({ handle: 'lab-nosku', variants: [{ sku: '', qty: 1, tracked: true, priceUsd: 100 }] }))).toBe(false);
    expect(uploadifyJewelryQualifies(jewelry({ handle: 'lab-zero', variants: [{ sku: 'BC1', qty: 0, tracked: true, priceUsd: 100 }] }))).toBe(false);
    expect(uploadifyJewelryQualifies(jewelry({ handle: 'lab-nocat', categoryId: null }))).toBe(false);
    expect(uploadifyJewelryQualifies(jewelry({ handle: 'lab-nobody', descriptionHtml: '' }))).toBe(false);
  });
});

describe('uploadify jewelry writes', () => {
  it('flags jewelry and copies a single variant SKU', () => {
    const { writes } = uploadifyActiveWrites([
      { handle: 'lab-diamond-tennis-bracelet', ownerId: 'gid://shopify/Product/1', current: null, desired: true, audience: 'jewelry' },
      { handle: 'lg-stone', ownerId: 'gid://shopify/Product/2', current: null, desired: true, audience: 'jewelry' },
      { handle: 'cluster-diamond-studs', ownerId: 'gid://shopify/Product/3', current: null, desired: true },
    ]);
    expect(writes.map((write) => write.ownerId)).toEqual(['gid://shopify/Product/1']);
    expect(uploadifyVendorSkuForVariants([{ sku: 'BC14WTSRD150P' }])).toBe('BC14WTSRD150P');
    expect(uploadifyVendorSkuForVariants([{ sku: 'NMC120-18' }, { sku: 'NMC120-20' }])).toBeNull();
    const sku = uploadifyVendorSkuWrites([
      {
        handle: 'lab-diamond-tennis-bracelet',
        ownerId: 'gid://shopify/Product/1',
        desired: true,
        audience: 'jewelry',
        stockRef: 'BC14WTSRD150P',
        current: null,
      },
    ]);
    expect(sku.writes[0]?.value).toBe('BC14WTSRD150P');
  });

  it('keeps a qualifying jewelry handle and still removes everything else', () => {
    expect(
      uploadifyActiveDeletesExcept(
        [
          { id: 'gid://shopify/Product/1', handle: 'w-3194' },
          { id: 'gid://shopify/Product/2', handle: 'lab-diamond-tennis-bracelet' },
          { id: 'gid://shopify/Product/3', handle: 'lmny-cuban-3-9-mm-nmc120' },
          { id: 'gid://shopify/Product/4', handle: 'cluster-diamond-studs' },
          { id: 'gid://shopify/Product/5', handle: 'lg-stone' },
        ],
        new Set(['w-3194']),
        new Set(['lab-diamond-tennis-bracelet', 'lmny-cuban-3-9-mm-nmc120', 'lg-stone']),
      ),
    ).toEqual([
      { ownerId: 'gid://shopify/Product/4', namespace: 'uploadify_product', key: 'uploadify_active' },
      { ownerId: 'gid://shopify/Product/5', namespace: 'uploadify_product', key: 'uploadify_active' },
    ]);
  });
});

describe('uploadifyKeepHandles', () => {
  it('keeps qualifying Belgium Dia watches and TLV watches only', () => {
    expect(
      [...uploadifyKeepHandles(['w-8117', 'estate-watch'], ['w-t3505', 'nd-stone'])].sort(),
    ).toEqual(['w-8117', 'w-t3505']);
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
