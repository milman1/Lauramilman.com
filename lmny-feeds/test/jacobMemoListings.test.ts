import { describe, expect, it } from 'vitest';
import { MEDIA_MISSING_TAG } from '../src/product.js';
import {
  ALREADY_LIVE_WITH_PHOTOS,
  JACOB_MEMO_ITEMS,
  JACOB_MEMO_TAG,
  JACOB_VENDOR,
  NEW_VINTAGE,
  buildJacobMemoProductSetInput,
  handleForItem,
  isJacobWatchDraft,
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

  it('builds New Vintage watches as ACTIVE without photos, tagged media-missing', () => {
    const item = JACOB_MEMO_ITEMS.find((i) => i.itemNumber === '90607870')!;
    const input = buildJacobMemoProductSetInput(item, { locationId: 'gid://shopify/Location/1' });
    expect(input.status).toBe('ACTIVE');
    expect(input.vendor).toBe(JACOB_VENDOR);
    expect(input.title).toBe('New Vintage Jacob & Co. Five Time Zone JC-4');
    expect(String(input.title)).not.toMatch(/Pre-Owned|Unworn/);
    expect(input.productType).toBe('Watch');
    expect(input.category).toBe('gid://shopify/TaxonomyCategory/aa-6-11');
    expect('files' in input).toBe(false);
    expect(input.tags as string[]).toContain(MEDIA_MISSING_TAG);
    expect(input.tags as string[]).toContain(JACOB_MEMO_TAG);
    expect(input.tags as string[]).toContain(NEW_VINTAGE);
    expect(input.tags as string[]).toContain('New Vintage Watches');
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
    expect(variant.price).toBe('4970.00');
    expect(variant.compareAtPrice).toBe('7100.00');
    expect(variant.inventoryItem.tracked).toBe(true);
    expect(variant.inventoryItem.cost).toBe('2485.00');
    expect(variant.inventoryQuantities[0]!.quantity).toBe(1);
    expect(String(input.descriptionHtml)).toContain('This New Vintage Jacob &amp; Co. Five Time Zone JC-4');
    expect(String(input.descriptionHtml)).not.toMatch(/\$|2485|7100|4970/);
    const condition = (input.metafields as Array<{ namespace: string; key: string; value: string }>).find(
      (m) => m.namespace === 'custom' && m.key === 'condition',
    );
    expect(condition?.value).toBe(NEW_VINTAGE);
    expect(
      (input.metafields as Array<{ namespace: string; key: string }>).some(
        (m) => m.namespace === 'mm-google-shopping' && m.key === 'condition',
      ),
    ).toBe(false);
    expect((input.seo as { title: string }).title).toBe('Jacob & Co. Five Time Zone JC-4 – New Vintage Watch');
    expect((input.seo as { title: string }).title.length).toBeLessThanOrEqual(60);
    expect((input.seo as { description: string }).description).toContain('Authenticated by Laura Milman New York.');
    expect((input.seo as { description: string }).description.length).toBeLessThanOrEqual(160);
  });

  it('prices every item at 30% off Jacob retail, not the watch cost chart', () => {
    const expected: Record<string, { price: string; compareAt: string }> = {
      '90607870': { price: '4970.00', compareAt: '7100.00' },
      '90607874': { price: '4543.00', compareAt: '6490.00' },
      '90814519': { price: '11760.00', compareAt: '16800.00' },
      '90916186': { price: '11760.00', compareAt: '16800.00' },
      '90712192': { price: '13860.00', compareAt: '19800.00' },
      '90608232': { price: '5250.00', compareAt: '7500.00' },
      '91944889': { price: '12250.00', compareAt: '17500.00' },
      '91739578': { price: '105.00', compareAt: '150.00' },
      '91328626': { price: '6930.00', compareAt: '9900.00' },
      '91328623': { price: '4760.00', compareAt: '6800.00' },
    };
    expect(Object.keys(expected)).toHaveLength(JACOB_MEMO_ITEMS.length);
    for (const item of JACOB_MEMO_ITEMS) {
      const input = buildJacobMemoProductSetInput(item);
      const variant = (input.variants as Array<{ price: string; compareAtPrice: string }>)[0]!;
      expect(variant.price).toBe(expected[item.itemNumber]!.price);
      expect(variant.compareAtPrice).toBe(expected[item.itemNumber]!.compareAt);
      expect(retailUsdForItem(item)).toBe(Number(expected[item.itemNumber]!.price));
      expect(variant.price).not.toBe(item.costUsd.toFixed(2));
      const condition = (input.metafields as Array<{ namespace: string; key: string; value: string }>).find(
        (m) => m.namespace === 'custom' && m.key === 'condition',
      );
      expect(condition?.value).toBe(NEW_VINTAGE);
      expect(input.tags as string[]).toContain(NEW_VINTAGE);
      expect(String(input.title)).not.toMatch(/Pre-Owned|Unworn/);
      expect(String(input.descriptionHtml)).not.toMatch(/Pre-Owned|Unworn/);
    }
    expect(buildJacobMemoProductSetInput(JACOB_MEMO_ITEMS.find((i) => i.itemNumber === '91944889')!).title).toBe(
      'New Vintage Jacob & Co. Ghost GH100.11.RP.PB.ANA4D',
    );
    expect(buildJacobMemoProductSetInput(JACOB_MEMO_ITEMS.find((i) => i.itemNumber === '90712192')!).title).toBe(
      'New Vintage Jacob & Co. Five Time Zone H-24 SSSL',
    );
  });

  it('lists the charger and diamond bezels as accessories, still draft', () => {
    const charger = buildJacobMemoProductSetInput(JACOB_MEMO_ITEMS.find((i) => i.itemNumber === '91739578')!);
    const bezel = buildJacobMemoProductSetInput(JACOB_MEMO_ITEMS.find((i) => i.itemNumber === '91328626')!);
    expect(charger.title).toBe('Jacob & Co. USB Charger for Ghost Watch');
    expect(charger.productType).toBe('Watch Accessories');
    expect(charger.category).toBe('gid://shopify/TaxonomyCategory/aa-6-10');
    expect(charger.status).toBe('DRAFT');
    expect(charger.tags as string[]).toContain(NEW_VINTAGE);
    expect(String(charger.descriptionHtml)).toContain('This New Vintage Jacob &amp; Co. USB Charger for Ghost Watch');
    expect((charger.variants as Array<{ price: string; compareAtPrice: string }>)[0]!.price).toBe('105.00');
    expect((charger.variants as Array<{ price: string; compareAtPrice: string }>)[0]!.compareAtPrice).toBe('150.00');
    expect(bezel.title).toBe('Jacob & Co. Full Size Diamond Bezel');
    expect(bezel.category).toBe('gid://shopify/TaxonomyCategory/aa-6-10-5');
    const fields = bezel.metafields as Array<{ key: string; value: string }>;
    expect(fields.find((f) => f.key === 'diamond_weight')?.value).toBe('3.25ct');
  });

  it('activates every memo watch and leaves accessories in draft', () => {
    const watches = JACOB_MEMO_ITEMS.filter((i) => i.kind === 'watch');
    const accessories = JACOB_MEMO_ITEMS.filter((i) => i.kind !== 'watch');
    expect(watches).toHaveLength(7);
    expect(accessories).toHaveLength(3);
    for (const item of watches) {
      const input = buildJacobMemoProductSetInput(item);
      expect(input.status).toBe('ACTIVE');
      expect(input.productType).toBe('Watch');
      expect('files' in input).toBe(false);
      expect(input.tags as string[]).toContain(MEDIA_MISSING_TAG);
    }
    for (const item of accessories) {
      expect(buildJacobMemoProductSetInput(item).status).toBe('DRAFT');
    }
    expect(ALREADY_LIVE_WITH_PHOTOS.has('90712192')).toBe(true);
  });

  it('activates Jacob watch drafts and leaves accessories and archives alone', () => {
    expect(
      isJacobWatchDraft({
        status: 'DRAFT',
        productType: 'Watch',
        vendor: 'Jacob & Co.',
        tags: ['New Vintage'],
        handle: 'jc-90607870',
      }),
    ).toBe(true);
    expect(
      isJacobWatchDraft({
        status: 'DRAFT',
        productType: 'Watch Accessories',
        vendor: 'Jacob & Co.',
        tags: ['jacob-co-boutique'],
        handle: 'jc-91739578',
      }),
    ).toBe(false);
    expect(
      isJacobWatchDraft({
        status: 'ACTIVE',
        productType: 'Watch',
        vendor: 'Jacob & Co.',
        tags: ['Watch'],
        handle: 'jc-90607870',
      }),
    ).toBe(false);
    expect(
      isJacobWatchDraft({
        status: 'ARCHIVED',
        productType: 'Watch',
        vendor: 'Jacob & Co.',
        tags: ['Watch'],
        handle: 'jc-90607870',
      }),
    ).toBe(false);
    expect(
      isJacobWatchDraft({
        status: 'DRAFT',
        productType: 'Watch',
        vendor: 'ROLEX',
        tags: ['lmny-feed'],
        handle: 'w-rw3086',
      }),
    ).toBe(false);
  });

  it('keeps SEO titles and descriptions within the store caps', () => {
    for (const item of JACOB_MEMO_ITEMS) {
      const seo = buildJacobMemoProductSetInput(item).seo as { title: string; description: string };
      expect(seo.title.length).toBeLessThanOrEqual(60);
      expect(seo.description.length).toBeLessThanOrEqual(160);
    }
  });
});
