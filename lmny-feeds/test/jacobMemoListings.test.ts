import { describe, expect, it } from 'vitest';
import { MEDIA_MISSING_TAG } from '../src/product.js';
import {
  JACOB_BOUTIQUE_TAG,
  JACOB_BRAND,
  JACOB_COLLECTION_HANDLE,
  JACOB_MEMO_ITEMS,
  JACOB_MEMO_TAG,
  JACOB_VENDOR,
  LIVE_JACOB_WATCHES,
  NEW_VINTAGE,
  buildJacobMemoProductSetInput,
  buildLiveJacobProductSetInput,
  handleForItem,
  isJacobWatchDraft,
  listingFieldsForWatch,
  liveMemoItemNumbers,
  memoItemByNumber,
  memoWatchesNotYetLive,
  retailUsdForItem,
  shouldCreateMemoItem,
  skuForLiveWatch,
} from '../src/jacobMemoListings.js';
import { kindForHandle } from '../src/diff.js';

describe('Jacob & Co. listing formula', () => {
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

  it('maps every photographed storefront watch to a memo line', () => {
    expect(LIVE_JACOB_WATCHES).toHaveLength(8);
    expect(LIVE_JACOB_WATCHES.map((e) => e.handle).sort()).toEqual([
      'jacob-amp-company-five-time-zone-watch-40mm',
      'jacob-amp-company-ghost-collection-digital-watch-with-diamonds',
      'jacob-amp-company-limited-edition-five-time-zone-automatic-h-24',
      'jacob-company-automatic-chronograph-watch',
      'jacob-company-epic-ii-automatic-chronograph-watch',
      'jacob-company-five-time-zone-watch',
      'jacob-company-five-time-zone-watch-40mm-diamond-bezel',
      'jacob-company-five-time-zone-watch-diamond-bezel',
    ]);
    for (const entry of LIVE_JACOB_WATCHES) {
      expect(kindForHandle(entry.handle)).toBeNull();
      expect(memoItemByNumber(entry.memoItemNumber).kind).toBe('watch');
    }
    expect(liveMemoItemNumbers()).toEqual(
      new Set(['90607870', '90607874', '90712192', '90608232', '90916186', '91944889']),
    );
    expect(memoWatchesNotYetLive().map((i) => i.itemNumber)).toEqual(['90814519']);
  });

  it('uses jc- handles the feed sync will not archive for new memo SKUs', () => {
    for (const item of JACOB_MEMO_ITEMS) {
      const handle = handleForItem(item);
      expect(handle).toBe(`jc-${item.itemNumber}`);
      expect(kindForHandle(handle)).toBeNull();
    }
  });

  it('does not create duplicate jc-* products for live watches or bundled bezels', () => {
    const create = JACOB_MEMO_ITEMS.filter(shouldCreateMemoItem).map((i) => i.itemNumber);
    expect(create).toEqual(['90814519', '91739578']);
    expect(shouldCreateMemoItem(memoItemByNumber('90607870'))).toBe(false);
    expect(shouldCreateMemoItem(memoItemByNumber('91328626'))).toBe(false);
    expect(shouldCreateMemoItem(memoItemByNumber('91328623'))).toBe(false);
  });

  it('builds New Vintage watches with the listing schema, box/papers, and no price in the body', () => {
    const item = JACOB_MEMO_ITEMS.find((i) => i.itemNumber === '90607870')!;
    const input = buildJacobMemoProductSetInput(item, { locationId: 'gid://shopify/Location/1' });
    expect(input.status).toBe('ACTIVE');
    expect(input.vendor).toBe(JACOB_VENDOR);
    expect(input.vendor).toBe('Jacob & Co');
    expect(input.title).toBe('New Vintage Jacob & Co. Five Time Zone JC-4');
    expect(String(input.title)).not.toMatch(/Pre-Owned|Unworn/);
    expect(input.productType).toBe('Watch');
    expect(input.category).toBe('gid://shopify/TaxonomyCategory/aa-6-11');
    expect('files' in input).toBe(false);
    expect(input.tags as string[]).toContain(MEDIA_MISSING_TAG);
    expect(input.tags as string[]).toContain(JACOB_MEMO_TAG);
    expect(input.tags as string[]).toContain(NEW_VINTAGE);
    expect(input.tags as string[]).toContain('New Vintage Watches');
    expect(input.tags as string[]).toContain(JACOB_BOUTIQUE_TAG);
    expect(input.tags as string[]).toContain('Watch');
    expect(input.tags as string[]).toContain('Watches');
    expect(input.tags as string[]).not.toContain('lmny-feed');
    expect(input.tags as string[]).not.toContain('Luxury Jewelry');
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
    expect(String(input.descriptionHtml)).toContain('as a full set with box and papers');
    expect(String(input.descriptionHtml)).not.toMatch(/WATCH - Model|METAL - Type/);
    expect(String(input.descriptionHtml)).not.toMatch(/\$|2485|7100|4970/);
    const fields = input.metafields as Array<{ namespace: string; key: string; value: string }>;
    expect(fields.find((m) => m.namespace === 'custom' && m.key === 'condition')?.value).toBe(NEW_VINTAGE);
    expect(fields.find((m) => m.key === 'brand')?.value).toBe(JACOB_BRAND);
    expect(fields.find((m) => m.key === 'model')?.value).toBe('Five Time Zone');
    expect(fields.find((m) => m.key === 'reference')?.value).toBe('JC-4');
    expect(fields.find((m) => m.key === 'case_size')?.value).toBe('47mm');
    expect(fields.find((m) => m.key === 'box')?.value).toBe('Yes');
    expect(fields.find((m) => m.key === 'papers')?.value).toBe('Yes');
    expect(fields.some((m) => m.namespace === 'mm-google-shopping' && m.key === 'condition')).toBe(false);
    expect((input.seo as { title: string }).title).toBe('Jacob & Co. Five Time Zone JC-4 – New Vintage Watch');
    expect((input.seo as { title: string }).title.length).toBeLessThanOrEqual(60);
    expect((input.seo as { description: string }).description).toContain('Authenticated by Laura Milman New York.');
    expect((input.seo as { description: string }).description.length).toBeLessThanOrEqual(160);
  });

  it('rewrites live PDPs in place without changing price, photos, or handle', () => {
    const entry = LIVE_JACOB_WATCHES.find((e) => e.handle === 'jacob-amp-company-limited-edition-five-time-zone-automatic-h-24')!;
    const input = buildLiveJacobProductSetInput(entry, {
      productId: 'gid://shopify/Product/7645293379655',
      variantId: 'gid://shopify/ProductVariant/43144451522631',
      price: '8500.00',
      inventoryQuantity: 1,
      locationId: 'gid://shopify/Location/1',
    });
    expect(input.id).toBe('gid://shopify/Product/7645293379655');
    expect(input.handle).toBe(entry.handle);
    expect(input.status).toBe('ACTIVE');
    expect(input.vendor).toBe('Jacob & Co');
    expect(input.title).toBe('New Vintage Jacob & Co. Five Time Zone H-24 SSSL');
    expect(input.productType).toBe('Watch');
    expect('files' in input).toBe(false);
    expect(input.tags as string[]).not.toContain(MEDIA_MISSING_TAG);
    expect(input.tags as string[]).toContain(NEW_VINTAGE);
    expect(input.tags as string[]).toContain('New Vintage Watches');
    expect(input.tags as string[]).toContain(JACOB_BOUTIQUE_TAG);
    expect(input.tags as string[]).toContain('Limited Edition');
    expect(input.tags as string[]).not.toContain('Luxury Jewelry');
    const variant = (
      input.variants as Array<{
        id: string;
        price: string;
        sku: string;
        compareAtPrice?: string;
        inventoryQuantities: Array<{ quantity: number }>;
      }>
    )[0]!;
    expect(variant.id).toBe('gid://shopify/ProductVariant/43144451522631');
    expect(variant.price).toBe('8500.00');
    expect(variant.price).not.toBe('13860.00');
    expect(variant.sku).toBe('90712192');
    expect(variant.compareAtPrice).toBeUndefined();
    expect(variant.inventoryQuantities[0]!.quantity).toBe(1);
    expect(String(input.descriptionHtml)).not.toMatch(/WATCH - Model|METAL - Type/);
    expect(String(input.descriptionHtml)).toContain('as a full set with box and papers');
    expect((input.seo as { title: string }).title).toBe(
      'Jacob & Co. Five Time Zone H-24 SSSL – New Vintage Watch',
    );
    expect((input.seo as { title: string }).title.length).toBeLessThanOrEqual(60);
  });

  it('bundles diamond bezels onto the combo listings and keeps the merchant price', () => {
    const entry = LIVE_JACOB_WATCHES.find(
      (e) => e.handle === 'jacob-company-five-time-zone-watch-diamond-bezel',
    )!;
    expect(skuForLiveWatch(entry)).toBe('90607870+91328626');
    const input = buildLiveJacobProductSetInput(entry, {
      productId: 'gid://shopify/Product/1',
      variantId: 'gid://shopify/ProductVariant/1',
      price: '8200.00',
    });
    expect(input.title).toBe('New Vintage Jacob & Co. Five Time Zone Diamond Bezel JC-4');
    expect((input.variants as Array<{ price: string; sku: string }>)[0]!.price).toBe('8200.00');
    expect((input.variants as Array<{ sku: string }>)[0]!.sku).toBe('90607870+91328626');
    expect(input.tags as string[]).toContain('Diamond Bezel');
    const fields = input.metafields as Array<{ key: string; value: string }>;
    expect(fields.find((f) => f.key === 'diamond_weight')?.value).toBe('3.25ct');
    expect(fields.find((f) => f.key === 'bezel')?.value).toContain('3.25ct');
    expect(String(input.descriptionHtml)).toContain('Full size 3.25ct diamond bezel');
  });

  it('keeps live 40mm and Ghost merchant prices and Ghost diamond weight', () => {
    const forty = LIVE_JACOB_WATCHES.find((e) => e.handle === 'jacob-amp-company-five-time-zone-watch-40mm')!;
    const ghost = LIVE_JACOB_WATCHES.find(
      (e) => e.handle === 'jacob-amp-company-ghost-collection-digital-watch-with-diamonds',
    )!;
    const epic = LIVE_JACOB_WATCHES.find(
      (e) => e.handle === 'jacob-company-epic-ii-automatic-chronograph-watch',
    )!;
    expect(buildLiveJacobProductSetInput(forty, {
      productId: 'gid://shopify/Product/1',
      variantId: 'gid://shopify/ProductVariant/1',
      price: '3500.00',
    }).title).toBe('New Vintage Jacob & Co. Five Time Zone JCM-11');
    const ghostInput = buildLiveJacobProductSetInput(ghost, {
      productId: 'gid://shopify/Product/1',
      variantId: 'gid://shopify/ProductVariant/1',
      price: '7600.00',
    });
    expect(ghostInput.title).toBe('New Vintage Jacob & Co. Ghost GH100.11.RP.PB.ANA4D');
    expect((ghostInput.seo as { title: string }).title.length).toBeLessThanOrEqual(60);
    expect(
      (ghostInput.metafields as Array<{ key: string; value: string }>).find((f) => f.key === 'diamond_weight')
        ?.value,
    ).toBe('3.48ct');
    const midBezel = LIVE_JACOB_WATCHES.find(
      (e) => e.handle === 'jacob-company-five-time-zone-watch-40mm-diamond-bezel',
    )!;
    expect(
      buildLiveJacobProductSetInput(midBezel, {
        productId: 'gid://shopify/Product/1',
        variantId: 'gid://shopify/ProductVariant/1',
        price: '6950.00',
      }).title,
    ).toBe('New Vintage Jacob & Co. Five Time Zone Diamond Bezel JCM-11');
    expect(
      buildLiveJacobProductSetInput(epic, {
        productId: 'gid://shopify/Product/1',
        variantId: 'gid://shopify/ProductVariant/1',
        price: '7400.00',
      }).title,
    ).toBe('New Vintage Jacob & Co. Epic II E2SS');
  });

  it('prices new memo SKUs at 30% off Jacob retail', () => {
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
    for (const item of JACOB_MEMO_ITEMS) {
      const input = buildJacobMemoProductSetInput(item);
      const variant = (input.variants as Array<{ price: string; compareAtPrice: string }>)[0]!;
      expect(variant.price).toBe(expected[item.itemNumber]!.price);
      expect(variant.compareAtPrice).toBe(expected[item.itemNumber]!.compareAt);
      expect(retailUsdForItem(item)).toBe(Number(expected[item.itemNumber]!.price));
    }
  });

  it('activates Epic I as a new listing and leaves the charger in draft', () => {
    const epicI = buildJacobMemoProductSetInput(memoItemByNumber('90814519'));
    const charger = buildJacobMemoProductSetInput(memoItemByNumber('91739578'));
    expect(epicI.handle).toBe('jc-90814519');
    expect(epicI.status).toBe('ACTIVE');
    expect(epicI.title).toBe('New Vintage Jacob & Co. Epic I Q2B');
    expect(epicI.tags as string[]).toContain(MEDIA_MISSING_TAG);
    expect(charger.title).toBe('Jacob & Co. USB Charger for Ghost Watch');
    expect(charger.productType).toBe('Watch Accessories');
    expect(charger.status).toBe('DRAFT');
    expect((charger.variants as Array<{ price: string }>)[0]!.price).toBe('105.00');
  });

  it('points the collection at the live jacob-co handle and vendor spelling', () => {
    expect(JACOB_COLLECTION_HANDLE).toBe('jacob-co');
    expect(JACOB_VENDOR).toBe('Jacob & Co');
    expect(JACOB_BRAND).toBe('Jacob & Co.');
  });

  it('activates Jacob watch drafts and leaves accessories, archives, and feed items alone', () => {
    expect(
      isJacobWatchDraft({
        status: 'DRAFT',
        productType: 'Watch',
        vendor: 'Jacob & Co',
        tags: ['New Vintage'],
        handle: 'jc-90814519',
      }),
    ).toBe(true);
    expect(
      isJacobWatchDraft({
        status: 'DRAFT',
        productType: 'Watch Accessories',
        vendor: 'Jacob & Co',
        tags: [JACOB_BOUTIQUE_TAG],
        handle: 'jc-91739578',
      }),
    ).toBe(false);
    expect(
      isJacobWatchDraft({
        status: 'ARCHIVED',
        productType: 'Watch',
        vendor: 'Jacob & Co',
        tags: ['Watch'],
        handle: 'jc-90814519',
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
    for (const item of JACOB_MEMO_ITEMS.filter((i) => i.kind === 'watch')) {
      const listing = listingFieldsForWatch(item);
      expect(listing.seoTitle.length).toBeLessThanOrEqual(60);
      expect(listing.seoDescription.length).toBeLessThanOrEqual(160);
      expect(listing.seoDescription).toContain('Authenticated by Laura Milman New York.');
    }
    for (const entry of LIVE_JACOB_WATCHES) {
      const input = buildLiveJacobProductSetInput(entry, {
        productId: 'gid://shopify/Product/1',
        variantId: 'gid://shopify/ProductVariant/1',
        price: '1.00',
      });
      const seo = input.seo as { title: string; description: string };
      expect(seo.title.length).toBeLessThanOrEqual(60);
      expect(seo.description.length).toBeLessThanOrEqual(160);
    }
  });
});
