import { describe, expect, it } from 'vitest';
import { buildProductSetInput, contentHashFor, handleFor, tagsFor } from '../../src/backvault/product.js';
import type { BackVaultItem } from '../../src/backvault/types.js';

function item(overrides: Partial<BackVaultItem> = {}): BackVaultItem {
  return {
    sourceHandle: 'cartier-love-bracelet-yg',
    title: 'Cartier Love Bracelet',
    vendorRaw: 'Cartier',
    vendor: 'Cartier',
    productType: 'Bracelet',
    descriptionHtml: '<p>18K Yellow Gold, 32.5g.</p>',
    priceUsd: 4500,
    available: true,
    sku: 'CLV-001',
    imageUrls: ['https://cdn.shopify.com/s/files/1/backvault/cartier.jpg'],
    specs: { metalType: '18K Yellow Gold', metalWeight: '32.5g' },
    ...overrides,
  };
}

describe('handleFor', () => {
  it('prefixes with bv- and sanitizes', () => {
    expect(handleFor(item())).toBe('bv-cartier-love-bracelet-yg');
    expect(handleFor(item({ sourceHandle: 'Weird_Handle!!123' }))).toBe('bv-weird-handle-123');
  });
});

describe('tagsFor', () => {
  it('always includes the feed tag and vendor', () => {
    const tags = tagsFor(item());
    expect(tags).toContain('backvault-feed');
    expect(tags).toContain('Cartier');
    expect(tags).toContain('antique-estate');
    expect(tags).toContain('Bracelets');
  });
});

describe('contentHashFor', () => {
  it('is stable for identical items and changes with price', () => {
    const a = contentHashFor(item());
    const b = contentHashFor(item());
    expect(a).toBe(b);
    const c = contentHashFor(item({ priceUsd: 5000 }));
    expect(c).not.toBe(a);
  });
});

describe('buildProductSetInput', () => {
  it('builds a valid ProductSetInput for a new product', () => {
    const input = buildProductSetInput(item(), '2026-08-17T00:00:00.000Z');
    expect(input.handle).toBe('bv-cartier-love-bracelet-yg');
    expect(input.vendor).toBe('Cartier');
    expect(input.status).toBe('ACTIVE');
    expect((input.variants as Array<{ price: string; sku: string }>)[0]!.price).toBe('4500.00');
    expect((input.variants as Array<{ price: string; sku: string }>)[0]!.sku).toBe('CLV-001');
    expect((input.variants as Array<{ inventoryItem: { tracked: boolean } }>)[0]!.inventoryItem.tracked).toBe(false);
    expect(input.id).toBeUndefined();
  });

  it('tracks qty 1 at a location so marketplace apps keep the listing', () => {
    const input = buildProductSetInput(item(), '2026-08-17T00:00:00.000Z', undefined, 'gid://shopify/Location/1');
    const variant = (input.variants as Array<{
      inventoryItem: { tracked: boolean };
      inventoryQuantities: Array<{ quantity: number; locationId: string }>;
    }>)[0]!;
    expect(variant.inventoryItem.tracked).toBe(true);
    expect(variant.inventoryQuantities).toEqual([
      { locationId: 'gid://shopify/Location/1', name: 'available', quantity: 1 },
    ]);
  });

  it('rewrites title, description, and SEO to the LMNY estate schema', () => {
    const input = buildProductSetInput(item(), '2026-08-17T00:00:00.000Z');
    expect(input.title).toBe('Cartier Love Bracelet');
    expect(String(input.descriptionHtml)).toContain('is offered by Laura Milman New York');
    expect(String(input.descriptionHtml)).toContain('Authenticated and hand-inspected by Laura Milman New York.');
    expect(String(input.descriptionHtml)).not.toContain('<h3>Specifications</h3>');
    expect(input.seo).toEqual({
      title: 'Cartier Love Bracelet | Estate Jewelry',
      description: expect.stringContaining('Authenticated by Laura Milman New York.'),
    });
    expect((input.seo as { title: string }).title.length).toBeLessThanOrEqual(60);
    expect((input.seo as { description: string }).description.length).toBeLessThanOrEqual(160);
    expect(input.productType).toBe('Bracelets');
    expect(input.category).toBe('gid://shopify/TaxonomyCategory/aa-6-3');
  });

  it('sets id and conditionally re-sends files when updating an existing product', () => {
    const withEnoughImages = buildProductSetInput(item(), '2026-08-17T00:00:00.000Z', { id: 'gid://shopify/Product/1', imageCount: 1 });
    expect(withEnoughImages.id).toBe('gid://shopify/Product/1');
    expect(withEnoughImages.files).toBeUndefined();

    const withFewerImages = buildProductSetInput(item(), '2026-08-17T00:00:00.000Z', { id: 'gid://shopify/Product/1', imageCount: 0 });
    expect(withFewerImages.files).toBeDefined();
  });

  it('marks an imageless product DRAFT with a media-missing tag', () => {
    const input = buildProductSetInput(item({ imageUrls: [] }), '2026-08-17T00:00:00.000Z');
    expect(input.status).toBe('DRAFT');
    expect(input.tags).toContain('media-missing');
  });

  it('throws instead of publishing if a Back Vault reference survives into any audited field', () => {
    expect(() =>
      buildProductSetInput(item({ title: 'From The Back Vault: Cartier Love Bracelet' }), '2026-08-17T00:00:00.000Z'),
    ).toThrow(/Back Vault reference survived/);
  });

  it('writes eBay custom.* specifics on watches from title + original copy', () => {
    const input = buildProductSetInput(
      item({
        sourceHandle: 'chopard-platinum-deco-watch-rr9688',
        title: 'Chopard Platinum Deco Diamond And Green Emerald Women Watch',
        vendor: 'Chopard',
        productType: 'WATCH',
        sku: 'RR9688',
        descriptionHtml:
          '<p>The watch features a sleek satin black band and a sturdy steel buckle. The case, including lugs, measures 14mm x 75mm.</p>',
      }),
      '2026-08-17T00:00:00.000Z',
    );
    const fields = (input.metafields as Array<{ namespace: string; key: string; value: string }>).filter(
      (m) => m.namespace === 'custom',
    );
    const byKey = Object.fromEntries(fields.map((m) => [m.key, m.value]));
    expect(input.productType).toBe('Watch');
    expect(byKey.type).toBe('Wristwatch');
    expect(byKey.handedness).toBe('Right');
    expect(byKey.department).toBe("Women's");
    expect(byKey.case_size).toBe('14mm x 75mm');
    expect(byKey.band_material).toBe('Satin');
  });
});
