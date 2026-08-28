import { describe, expect, it } from 'vitest';
import {
  taxonomyForFeedKind,
  taxonomyForProductType,
  taxonomyGidForFeedKind,
  isRecognizedJewelryCategory,
  TAXONOMY,
} from '../src/taxonomy.js';

describe('taxonomyForFeedKind', () => {
  it('maps watches to Jewelry > Watches', () => {
    expect(taxonomyGidForFeedKind('watch')).toBe(TAXONOMY.watches.gid);
    expect(taxonomyForFeedKind('watch').breadcrumb).toContain('Watches');
  });

  it('maps loose diamonds to the Jewelry parent', () => {
    expect(taxonomyGidForFeedKind('natural')).toBe(TAXONOMY.jewelry.gid);
    expect(taxonomyGidForFeedKind('lab')).toBe(TAXONOMY.jewelry.gid);
  });
});

describe('taxonomyForProductType', () => {
  it('maps jewelry types to leaf categories', () => {
    expect(taxonomyForProductType('Rings').id).toBe('aa-6-9');
    expect(taxonomyForProductType('Bracelets').id).toBe('aa-6-3');
    expect(taxonomyForProductType('Necklaces').id).toBe('aa-6-8');
    expect(taxonomyForProductType('Earrings').id).toBe('aa-6-6');
    expect(taxonomyForProductType('Brooches').id).toBe('aa-6-4-1');
    expect(taxonomyForProductType('Pendants').id).toBe('aa-6-5-1');
    expect(taxonomyForProductType('Cufflinks').id).toBe('aa-2-10');
    expect(taxonomyForProductType('Watch').id).toBe('aa-6-11');
    expect(taxonomyForProductType('Jewelry').id).toBe('aa-6');
  });
});

describe('isRecognizedJewelryCategory', () => {
  it('accepts gid, short id, and breadcrumb', () => {
    expect(isRecognizedJewelryCategory(TAXONOMY.rings.gid)).toBe(true);
    expect(isRecognizedJewelryCategory('aa-6-9')).toBe(true);
    expect(isRecognizedJewelryCategory(TAXONOMY.rings.breadcrumb)).toBe(true);
    expect(isRecognizedJewelryCategory('Apparel & Accessories > Jewelry > Watches')).toBe(true);
  });

  it('rejects unrelated categories', () => {
    expect(isRecognizedJewelryCategory('')).toBe(false);
    expect(isRecognizedJewelryCategory('Home & Garden > Decor > Clocks')).toBe(false);
  });
});
