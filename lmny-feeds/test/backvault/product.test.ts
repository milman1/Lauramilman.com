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
    expect((input.variants as Array<{ price: string }>)[0]!.price).toBe('4500.00');
    expect(input.id).toBeUndefined();
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

  it('throws if an image URL still names the supplier', () => {
    // The URL check runs after assertScrubbed, so we need a clean item
    // (no other scrub violations) with only the URL being problematic.
    expect(() =>
      buildProductSetInput(
        item({
          imageUrls: ['https://thebackvault.com/cdn/cartier.jpg'],
          title: 'Cartier Ring',
          descriptionHtml: '<p>18K Yellow Gold.</p>',
        }),
        '2026-08-17T00:00:00.000Z',
      ),
    ).toThrow(/still names the supplier/);
  });
});
