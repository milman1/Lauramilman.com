import { describe, expect, it } from 'vitest';
import { MEDIA_MISSING_TAG } from '../src/product.js';
import {
  JACOB_MEMO_ITEMS,
  JACOB_MEMO_TAG,
  JACOB_VENDOR,
  buildJacobMemoProductSetInput,
  handleForItem,
  retailUsdForItem,
} from '../src/jacobMemoListings.js';
import { kindForHandle } from '../src/diff.js';

describe('Jacob & Co. memo listings', () => {
  it('covers all ten memo lines', () => {
    expect(JACOB_MEMO_ITEMS).toHaveLength(10);
    expect(JACOB_MEMO_ITEMS.map((i) => i.itemNumber).sort()).toEqual([
      '90607870',
      '90607874',
      '90608232',
      '90712192',
      '90814519',
      '90916186',
      '91328623',
      '91328626',
      '91739578',
      '91944889',
    ]);
  });

  it('uses jc- handles the feed sync will not archive', () => {
    for (const item of JACOB_MEMO_ITEMS) {
      const handle = handleForItem(item);
      expect(handle).toBe(`jc-${item.itemNumber}`);
      expect(kindForHandle(handle)).toBeNull();
    }
  });

  it('builds Unworn watch drafts with Category, qty 1, and no photos', () => {
    const item = JACOB_MEMO_ITEMS.find((i) => i.itemNumber === '90607870')!;
    const input = buildJacobMemoProductSetInput(item, { locationId: 'gid://shopify/Location/1' });
    expect(input.status).toBe('DRAFT');
    expect(input.vendor).toBe(JACOB_VENDOR);
    expect(input.title).toBe('Unworn Jacob & Co. Five Time Zone JC-4');
    expect(input.productType).toBe('Watch');
    expect(input.category).toBe('gid://shopify/TaxonomyCategory/aa-6-11');
    expect('files' in input).toBe(false);
    expect(input.tags as string[]).toContain(MEDIA_MISSING_TAG);
    expect(input.tags as string[]).toContain(JACOB_MEMO_TAG);
    expect(input.tags as string[]).not.toContain('lmny-feed');
    const variant = (
      input.variants as Array<{
        price: string;
        compareAtPrice: string;
        sku: string;
        inventoryItem: { tracked: boolean; cost: string };
        inventoryQuantities: Array<{ quantity: number }>;
      }>
    )[0]!;
    expect(variant.sku).toBe('90607870');
    expect(variant.price).toBe(retailUsdForItem(item).toFixed(2));
    expect(variant.price).toBe('3300.00');
    expect(variant.compareAtPrice).toBe('7100.00');
    expect(variant.inventoryItem.tracked).toBe(true);
    expect(variant.inventoryItem.cost).toBe('2485.00');
    expect(variant.inventoryQuantities[0]!.quantity).toBe(1);
    expect(String(input.descriptionHtml)).not.toMatch(/\$|2485|7100/);
    expect((input.seo as { title: string }).title.length).toBeLessThanOrEqual(60);
    expect((input.seo as { description: string }).description.length).toBeLessThanOrEqual(160);
  });

  it('prices the Ghost and Epic watches from memo cost, not Jacob retail', () => {
    const ghost = JACOB_MEMO_ITEMS.find((i) => i.itemNumber === '91944889')!;
    const epic = JACOB_MEMO_ITEMS.find((i) => i.itemNumber === '90814519')!;
    expect(retailUsdForItem(ghost)).toBe(7400);
    expect(retailUsdForItem(epic)).toBe(7100);
    const ghostInput = buildJacobMemoProductSetInput(ghost);
    expect(ghostInput.title).toBe('Unworn Jacob & Co. Ghost GH100.11.RP.PB.ANA4D');
    expect(ghostInput.status).toBe('DRAFT');
    const h24 = buildJacobMemoProductSetInput(JACOB_MEMO_ITEMS.find((i) => i.itemNumber === '90712192')!);
    expect(h24.title).toBe('Unworn Jacob & Co. Five Time Zone H-24 SSSL');
  });

  it('lists the charger and diamond bezels as accessories, still draft', () => {
    const charger = buildJacobMemoProductSetInput(JACOB_MEMO_ITEMS.find((i) => i.itemNumber === '91739578')!);
    const bezel = buildJacobMemoProductSetInput(JACOB_MEMO_ITEMS.find((i) => i.itemNumber === '91328626')!);
    expect(charger.title).toBe('Jacob & Co. USB Charger for Ghost Watch');
    expect(charger.productType).toBe('Watch Accessories');
    expect(charger.category).toBe('gid://shopify/TaxonomyCategory/aa-6-10');
    expect(charger.status).toBe('DRAFT');
    expect(bezel.title).toBe('Jacob & Co. Full Size Diamond Bezel');
    expect(bezel.category).toBe('gid://shopify/TaxonomyCategory/aa-6-10-5');
    const fields = bezel.metafields as Array<{ key: string; value: string }>;
    expect(fields.find((f) => f.key === 'diamond_weight')?.value).toBe('3.25ct');
  });

  it('keeps SEO titles and descriptions within the store caps', () => {
    for (const item of JACOB_MEMO_ITEMS) {
      const seo = buildJacobMemoProductSetInput(item).seo as { title: string; description: string };
      expect(seo.title.length).toBeLessThanOrEqual(60);
      expect(seo.description.length).toBeLessThanOrEqual(160);
    }
  });
});
