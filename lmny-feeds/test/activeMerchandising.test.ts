import { describe, expect, it } from 'vitest';
import { planActiveMerchandising } from '../src/activeMerchandising.js';
import { TAXONOMY_CATEGORY } from '../src/shopifyCategory.js';
import type { ActiveMerchandisingRow } from '../src/shopify.js';

function row(overrides: Partial<ActiveMerchandisingRow> & Pick<ActiveMerchandisingRow, 'id' | 'handle'>): ActiveMerchandisingRow {
  return {
    title: '',
    productType: '',
    categoryId: null,
    variants: [],
    ...overrides,
  };
}

describe('planActiveMerchandising', () => {
  it('fills missing category and qty 1 on untracked active API diamonds', () => {
    const plan = planActiveMerchandising([
      row({
        id: 'gid://shopify/Product/1',
        handle: 'nd-bd-1234',
        productType: 'Natural Diamond',
        title: '2.01ct Round Brilliant Natural Diamond',
        variants: [{ id: 'v1', inventoryItemId: 'i1', tracked: false, available: 0 }],
      }),
    ]);
    expect(plan.categoryUpdates).toEqual([
      {
        id: 'gid://shopify/Product/1',
        handle: 'nd-bd-1234',
        from: null,
        to: TAXONOMY_CATEGORY.jewelry,
      },
    ]);
    expect(plan.trackIds).toEqual(['i1']);
    expect(plan.quantityItemIds).toEqual(['i1']);
    expect(plan.skippedSoldOut).toBe(0);
  });

  it('maps API watches to Watches and jewelry types to the matching leaf', () => {
    const plan = planActiveMerchandising([
      row({
        id: 'p-w',
        handle: 'w-t3743',
        productType: 'Watch',
        variants: [{ id: 'v', inventoryItemId: 'iw', tracked: false, available: null }],
      }),
      row({
        id: 'p-b',
        handle: 'love-bracelet',
        productType: 'Bracelets',
        title: 'Cartier Love Bracelet',
        variants: [{ id: 'v', inventoryItemId: 'ib', tracked: false, available: null }],
      }),
    ]);
    expect(plan.categoryUpdates.map((u) => u.to)).toEqual([
      TAXONOMY_CATEGORY.watches,
      TAXONOMY_CATEGORY.bracelets,
    ]);
  });

  it('does not restock a tracked sold-out unique piece or rewrite a correct category', () => {
    const plan = planActiveMerchandising([
      row({
        id: 'p-sold',
        handle: 'estate-ring',
        productType: 'Rings',
        categoryId: TAXONOMY_CATEGORY.rings,
        variants: [{ id: 'v', inventoryItemId: 'isold', tracked: true, available: 0 }],
      }),
    ]);
    expect(plan.categoryUpdates).toEqual([]);
    expect(plan.trackIds).toEqual([]);
    expect(plan.quantityItemIds).toEqual([]);
    expect(plan.skippedSoldOut).toBe(1);
    expect(plan.alreadyOk).toBe(0);
  });

  it('leaves tracked qty 1 alone', () => {
    const plan = planActiveMerchandising([
      row({
        id: 'p-ok',
        handle: 'lg-1',
        productType: 'Lab-Grown Diamond',
        categoryId: TAXONOMY_CATEGORY.jewelry,
        variants: [{ id: 'v', inventoryItemId: 'iok', tracked: true, available: 1 }],
      }),
    ]);
    expect(plan.categoryUpdates).toEqual([]);
    expect(plan.quantityItemIds).toEqual([]);
    expect(plan.alreadyOk).toBe(1);
  });
});
