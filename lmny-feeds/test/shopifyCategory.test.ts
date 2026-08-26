import { describe, expect, it } from 'vitest';
import {
  TAXONOMY_CATEGORY,
  UNIQUE_QUANTITY,
  categoryGidFor,
  shouldSetUniqueQuantity,
  uniqueVariantInventory,
} from '../src/shopifyCategory.js';

describe('categoryGidFor', () => {
  it('maps feed kinds to Jewelry vs Watches', () => {
    expect(categoryGidFor({ kind: 'natural' })).toBe(TAXONOMY_CATEGORY.jewelry);
    expect(categoryGidFor({ kind: 'lab' })).toBe(TAXONOMY_CATEGORY.jewelry);
    expect(categoryGidFor({ kind: 'watch' })).toBe(TAXONOMY_CATEGORY.watches);
  });

  it('maps Shopify product types to the matching jewelry leaf', () => {
    expect(categoryGidFor({ productType: 'Bracelets' })).toBe(TAXONOMY_CATEGORY.bracelets);
    expect(categoryGidFor({ productType: 'Rings' })).toBe(TAXONOMY_CATEGORY.rings);
    expect(categoryGidFor({ productType: 'Necklaces' })).toBe(TAXONOMY_CATEGORY.necklaces);
    expect(categoryGidFor({ productType: 'Earrings' })).toBe(TAXONOMY_CATEGORY.earrings);
    expect(categoryGidFor({ productType: 'Pendants' })).toBe(TAXONOMY_CATEGORY.pendants);
    expect(categoryGidFor({ productType: 'Brooches' })).toBe(TAXONOMY_CATEGORY.brooches);
    expect(categoryGidFor({ productType: 'Cufflinks' })).toBe(TAXONOMY_CATEGORY.cufflinks);
    expect(categoryGidFor({ productType: 'Watch' })).toBe(TAXONOMY_CATEGORY.watches);
    expect(categoryGidFor({ productType: 'Jewelry' })).toBe(TAXONOMY_CATEGORY.jewelry);
    expect(categoryGidFor({ productType: 'Natural Diamond' })).toBe(TAXONOMY_CATEGORY.jewelry);
    expect(categoryGidFor({ productType: 'Lab-Grown Diamond' })).toBe(TAXONOMY_CATEGORY.jewelry);
  });

  it('uses feed handle prefixes when product type is missing', () => {
    expect(categoryGidFor({ handle: 'nd-bd-1234' })).toBe(TAXONOMY_CATEGORY.jewelry);
    expect(categoryGidFor({ handle: 'lg-lgd-55-7' })).toBe(TAXONOMY_CATEGORY.jewelry);
    expect(categoryGidFor({ handle: 'w-t3743' })).toBe(TAXONOMY_CATEGORY.watches);
  });

  it('falls back to title keywords, then Jewelry', () => {
    expect(categoryGidFor({ title: 'Cartier Love Bracelet' })).toBe(TAXONOMY_CATEGORY.bracelets);
    expect(categoryGidFor({ title: '2.01ct Round Brilliant Natural Diamond — F VS1, GIA Certified' })).toBe(
      TAXONOMY_CATEGORY.jewelry,
    );
    expect(categoryGidFor({ title: 'Pre-Owned Rolex Datejust 126331' })).toBe(TAXONOMY_CATEGORY.watches);
    expect(categoryGidFor({ title: 'Untitled estate piece' })).toBe(TAXONOMY_CATEGORY.jewelry);
  });

  it('prefers kind over a misleading title', () => {
    expect(categoryGidFor({ kind: 'watch', title: 'Rolex with diamond bracelet' })).toBe(
      TAXONOMY_CATEGORY.watches,
    );
  });
});

describe('uniqueVariantInventory', () => {
  it('tracks qty 1 at the given location and keeps DENY', () => {
    expect(uniqueVariantInventory('gid://shopify/Location/1', { cost: '10.00' })).toEqual({
      inventoryPolicy: 'DENY',
      inventoryItem: { tracked: true, requiresShipping: true, cost: '10.00' },
      inventoryQuantities: [
        { locationId: 'gid://shopify/Location/1', name: 'available', quantity: UNIQUE_QUANTITY },
      ],
    });
  });

  it('leaves tracking off when no location is available so products do not go to qty 0', () => {
    expect(uniqueVariantInventory(undefined)).toEqual({
      inventoryPolicy: 'DENY',
      inventoryItem: { tracked: false, requiresShipping: true },
    });
  });
});

describe('shouldSetUniqueQuantity', () => {
  it('sets untracked active items (today’s infinite stock) to 1', () => {
    expect(shouldSetUniqueQuantity({ tracked: false, available: 0 })).toBe(true);
    expect(shouldSetUniqueQuantity({ tracked: false, available: null })).toBe(true);
  });

  it('does not restock a tracked sold-out unique piece', () => {
    expect(shouldSetUniqueQuantity({ tracked: true, available: 0 })).toBe(false);
  });

  it('leaves qty 1 alone and normalizes any other tracked count', () => {
    expect(shouldSetUniqueQuantity({ tracked: true, available: 1 })).toBe(false);
    expect(shouldSetUniqueQuantity({ tracked: true, available: 4 })).toBe(true);
    expect(shouldSetUniqueQuantity({ tracked: true, available: null })).toBe(true);
  });
});
