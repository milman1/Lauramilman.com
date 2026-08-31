import { describe, expect, it } from 'vitest';
import {
  JACOB_BOUTIQUE_TAG,
  JACOB_COLLECTION_HANDLE,
  JACOB_H24_HANDLE,
  JACOB_H24_SKU,
  JACOB_VENDOR,
  NEW_VINTAGE,
  buildJacobH24ProductSetInput,
  jacobCoWatchesCollectionInput,
} from '../src/jacobH24Listing.js';

describe('Jacob & Co. H-24 boutique listing', () => {
  const input = buildJacobH24ProductSetInput({
    id: 'gid://shopify/Product/1',
    variantId: 'gid://shopify/ProductVariant/2',
    price: '8500.00',
  });

  it('keeps the live handle, photos, price, and ACTIVE status', () => {
    expect(input.handle).toBe(JACOB_H24_HANDLE);
    expect(input.status).toBe('ACTIVE');
    expect(input.id).toBe('gid://shopify/Product/1');
    expect('files' in input).toBe(false);
    const variant = (input.variants as Array<{ id: string; price: string; sku: string }>)[0]!;
    expect(variant.id).toBe('gid://shopify/ProductVariant/2');
    expect(variant.price).toBe('8500.00');
    expect(variant.sku).toBe(JACOB_H24_SKU);
  });

  it('matches the watch listing schema as New Vintage, not Pre-Owned or Unworn', () => {
    expect(input.title).toBe('New Vintage Jacob & Co. Five Time Zone H-24 SSSL');
    expect(String(input.title)).not.toMatch(/Pre-Owned|Unworn/);
    expect(input.vendor).toBe(JACOB_VENDOR);
    expect(input.productType).toBe('Watch');
    expect(input.category).toBe('gid://shopify/TaxonomyCategory/aa-6-11');
    expect(String(input.descriptionHtml)).toContain(
      'This New Vintage Jacob &amp; Co. Five Time Zone H-24 SSSL',
    );
    expect(String(input.descriptionHtml)).toContain('as a full set with box and papers');
    expect(String(input.descriptionHtml)).toContain('Limited edition (0796/1800)');
    expect(String(input.descriptionHtml)).not.toMatch(/WATCH - Model|METAL - Type|\$|8500/);
    expect(input.tags as string[]).toContain(NEW_VINTAGE);
    expect(input.tags as string[]).toContain('New Vintage Watches');
    expect(input.tags as string[]).toContain(JACOB_BOUTIQUE_TAG);
    expect(input.tags as string[]).not.toContain('lmny-feed');
    expect(input.tags as string[]).not.toContain('Luxury Jewelry');
    const fields = input.metafields as Array<{ namespace: string; key: string; value: string }>;
    expect(fields.find((f) => f.namespace === 'custom' && f.key === 'condition')?.value).toBe(NEW_VINTAGE);
    expect(fields.find((f) => f.key === 'reference')?.value).toBe('H-24 SSSL');
    expect(fields.find((f) => f.key === 'case_size')?.value).toBe('47.5mm');
    expect(fields.find((f) => f.key === 'metal')?.value).toBe('Stainless Steel');
    expect(fields.find((f) => f.key === 'dial')?.value).toBe('Silver Discs On Slate Guilloche');
    expect(fields.find((f) => f.key === 'box')?.value).toBe('Yes');
    expect(fields.find((f) => f.key === 'papers')?.value).toBe('Yes');
    expect(fields.some((f) => f.namespace === 'mm-google-shopping' && f.key === 'condition')).toBe(false);
    const seo = input.seo as { title: string; description: string };
    expect(seo.title).toBe('Jacob & Co. Five Time Zone H-24 SSSL – New Vintage Watch');
    expect(seo.title.length).toBeLessThanOrEqual(60);
    expect(seo.description).toContain('Authenticated by Laura Milman New York.');
    expect(seo.description.length).toBeLessThanOrEqual(160);
  });

  it('defines a watch-only Jacob & Co. smart collection', () => {
    const collection = jacobCoWatchesCollectionInput();
    expect(collection.handle).toBe(JACOB_COLLECTION_HANDLE);
    expect(collection.title).toBe('Jacob & Co. Watches');
    const rules = (collection.ruleSet as { appliedDisjunctively: boolean; rules: Array<{ column: string; condition: string }> })
      .rules;
    expect(collection.ruleSet as { appliedDisjunctively: boolean }).toMatchObject({ appliedDisjunctively: false });
    expect(rules).toEqual([
      { column: 'TYPE', relation: 'EQUALS', condition: 'Watch' },
      { column: 'VENDOR', relation: 'EQUALS', condition: JACOB_VENDOR },
    ]);
  });
});
