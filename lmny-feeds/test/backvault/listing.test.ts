import { describe, expect, it } from 'vitest';
import {
  buildJewelryListing,
  canonicalProductType,
  conditionGrade,
  conditionMetafield,
} from '../../src/backvault/listing.js';
import type { BackVaultItem } from '../../src/backvault/types.js';

function item(overrides: Partial<BackVaultItem> = {}): BackVaultItem {
  return {
    sourceHandle: 'cartier-love-bracelet-yg',
    title: 'Cartier Love Bracelet',
    vendorRaw: 'Cartier',
    vendor: 'Cartier',
    productType: 'BRACL',
    descriptionHtml: '<p>supplier copy that must not ship</p>',
    priceUsd: 4500,
    available: true,
    sku: 'CLV-001',
    imageUrls: ['https://cdn.shopify.com/s/files/1/x/cartier.jpg'],
    specs: { metalType: '18K Yellow Gold', metalWeight: '32.5g', condition: 'Excellent' },
    ...overrides,
  };
}

describe('canonicalProductType', () => {
  it('maps Back Vault type codes to Shopify product types', () => {
    expect(canonicalProductType('RING')).toBe('Rings');
    expect(canonicalProductType('BRACL')).toBe('Bracelets');
    expect(canonicalProductType('EARRG')).toBe('Earrings');
    expect(canonicalProductType('NECKL')).toBe('Necklaces');
    expect(canonicalProductType('WATCH')).toBe('Watch');
    expect(canonicalProductType('CUFFL')).toBe('Cufflinks');
    expect(canonicalProductType('FSLTR')).toBe('Rings');
    expect(canonicalProductType('TNSBR')).toBe('Bracelets');
  });

  it('maps English words and empty input', () => {
    expect(canonicalProductType('Bracelet')).toBe('Bracelets');
    expect(canonicalProductType('')).toBe('Jewelry');
    expect(canonicalProductType(undefined)).toBe('Jewelry');
  });
});

describe('buildJewelryListing', () => {
  it('builds the estate jewelry title, body, and SEO fields', () => {
    const listing = buildJewelryListing(item());
    expect(listing.title).toBe('Cartier Love Bracelet');
    expect(listing.productType).toBe('Bracelets');
    expect(listing.descriptionHtml).toBe(
      '<p>This Cartier estate bracelet in 18K Yellow Gold is offered by Laura Milman New York. It is in excellent condition.</p>' +
        '<p>Authenticated and hand-inspected by Laura Milman New York.</p>',
    );
    expect(listing.seoTitle).toBe('Cartier Love Bracelet | Laura Milman');
    expect(listing.seoTitle.length).toBeLessThanOrEqual(60);
    expect(listing.seoDescription).toContain('Shop this Cartier estate bracelet in 18K Yellow Gold, excellent condition.');
    expect(listing.seoDescription).toContain('Authenticated by Laura Milman New York.');
    expect(listing.seoDescription.length).toBeLessThanOrEqual(160);
    expect(listing.descriptionHtml).not.toContain('supplier copy');
    expect(listing.descriptionHtml).not.toContain('<table>');
    expect(listing.tags).toContain('Cartier');
    expect(listing.tags).toContain('antique-estate');
    expect(listing.tags).toContain('designer-jewelry');
  });

  it('prefixes canonical brand and strips a trailing stock number', () => {
    const listing = buildJewelryListing(
      item({
        vendor: 'Hermès',
        title: 'Hermes 18K Yellow Gold Link Chain Necklace J10508',
        productType: 'NECKL',
        specs: { metalType: '18K Yellow Gold' },
      }),
    );
    expect(listing.title).toBe('Hermès 18K Yellow Gold Link Chain Necklace');
    expect(listing.productType).toBe('Necklaces');
    expect(listing.descriptionHtml).toContain('This Hermès estate necklace');
  });

  it('uses Pre-Owned watch titles matching the watch listing schema', () => {
    const listing = buildJewelryListing(
      item({
        vendor: 'Bvlgari',
        title: 'Bvlgari Serpenti 18K Yellow Gold Manual Watch',
        productType: 'WATCH',
        specs: { metalType: '18K Yellow Gold', era: 'Circa 1965', condition: 'Excellent' },
      }),
    );
    expect(listing.title).toBe('Pre-Owned Bvlgari Serpenti 18K Yellow Gold Manual Watch');
    expect(listing.productType).toBe('Watch');
    expect(listing.descriptionHtml).toContain('This Pre-Owned Bvlgari');
    expect(listing.descriptionHtml).toContain('is offered by Laura Milman New York.');
    expect(listing.seoTitle.length).toBeLessThanOrEqual(60);
    expect(listing.seoDescription).toContain('Authenticated by Laura Milman New York.');
    expect(listing.tags).toContain('Pre-Owned Watches');
  });

  it('truncates SEO title at a word boundary under 60 chars', () => {
    const listing = buildJewelryListing(
      item({
        title:
          'Cartier Diamond Elephant 18K White Gold Walking Elephant Shirt Studs and Cuff Links',
        productType: 'CUFFL',
        specs: { metalType: '18K White Gold' },
      }),
    );
    expect(listing.seoTitle.length).toBeLessThanOrEqual(60);
    expect(listing.seoTitle).not.toMatch(/\s$/);
    expect(listing.seoTitle).toContain('Cartier');
    expect(listing.seoTitle).not.toContain('|');
    expect(listing.productType).toBe('Cufflinks');
    expect(listing.descriptionHtml).toContain('pair of cufflinks');
  });

  it('escapes HTML in brand/spec text', () => {
    const listing = buildJewelryListing(
      item({
        vendor: 'Tiffany & Co.',
        title: 'Tiffany & Co. Diamond Tennis Bracelet',
        productType: 'BRACL',
        specs: { metalType: '18K Yellow Gold', gemstones: 'Mother-of-pearl' },
      }),
    );
    expect(listing.descriptionHtml).toContain('Tiffany &amp; Co.');
    expect(listing.descriptionHtml).toContain('mother-of-pearl');
  });
});

describe('condition helpers', () => {
  it('maps known grades and writes the estate condition metafield', () => {
    expect(conditionGrade('Excellent. Custom engraving.')).toBe('Excellent');
    expect(conditionGrade('unknown')).toBeNull();
    expect(conditionMetafield('Excellent')).toBe('Excellent pre-owned condition; signed and authenticated');
    expect(conditionMetafield(undefined)).toBe('Pre-owned; authenticated by Laura Milman New York');
  });
});
