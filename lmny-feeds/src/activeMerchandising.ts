import type { ActiveMerchandisingRow } from './shopify.js';
import {
  UNIQUE_QUANTITY,
  categoryGidFor,
  shouldSetUniqueQuantity,
} from './shopifyCategory.js';

export interface MerchandisingPlan {
  categoryUpdates: Array<{ id: string; handle: string; from: string | null; to: string }>;
  trackIds: string[];
  quantityItemIds: string[];
  skippedSoldOut: number;
  alreadyOk: number;
}

/** Decide category + qty 1 work for ACTIVE products. Drafts/archived never reach here. */
export function planActiveMerchandising(rows: ActiveMerchandisingRow[]): MerchandisingPlan {
  const categoryUpdates: MerchandisingPlan['categoryUpdates'] = [];
  const trackIds: string[] = [];
  const quantityItemIds: string[] = [];
  let skippedSoldOut = 0;
  let alreadyOk = 0;

  for (const row of rows) {
    const to = categoryGidFor({
      productType: row.productType,
      handle: row.handle,
      title: row.title,
    });
    if (row.categoryId !== to) {
      categoryUpdates.push({ id: row.id, handle: row.handle, from: row.categoryId, to });
    }

    for (const variant of row.variants) {
      if (!variant.tracked) trackIds.push(variant.inventoryItemId);
      if (variant.tracked && variant.available === 0) {
        skippedSoldOut += 1;
        continue;
      }
      if (shouldSetUniqueQuantity({ tracked: variant.tracked, available: variant.available })) {
        quantityItemIds.push(variant.inventoryItemId);
      } else {
        alreadyOk += 1;
      }
    }
  }

  return {
    categoryUpdates,
    trackIds: [...new Set(trackIds)],
    quantityItemIds: [...new Set(quantityItemIds)],
    skippedSoldOut,
    alreadyOk,
  };
}

export { UNIQUE_QUANTITY };
