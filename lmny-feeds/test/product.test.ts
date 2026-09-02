import { describe, expect, it } from 'vitest';
import {
  PRODUCT_SCHEMA_VERSION,
  buildProductSetInput,
  caratBand,
  contentHashFor,
  handleFor,
  isInvalidShopifyFileUrlError,
  metafieldsFor,
  quarantineProductSetInput,
  sanitizeRef,
  seoDescriptionFor,
  seoTitleFor,
  tagsFor,
  titleFor,
  uniqueStockQtyFor,
  vendorFor,
  writeErrorsAreSystemic,
} from '../src/product.js';
import { labStone, naturalStone, priced, watch } from './fixtures.js';

interface Metafield {
  namespace: string;
  key: string;
  type: string;
  value: string;
}

function find(fields: Metafield[], namespace: string, key: string): Metafield | undefined {
  return fields.find((f) => f.namespace === namespace && f.key === key);
}

describe('handle generation', () => {
  it('prefixes by kind and lowercases', () => {
    expect(handleFor(naturalStone())).toBe('nd-bd-1234');
    expect(handleFor(labStone())).toBe('lg-lgd-55-7');
    expect(handleFor(watch())).toBe('w-w-889');
  });

  it('sanitizes awkward stock refs deterministically', () => {
    expect(sanitizeRef('  AB/12 #34_x ')).toBe('ab-12-34_x'.replace('_', '-'));
    expect(sanitizeRef('AB/12#34')).toBe('ab-12-34');
    expect(sanitizeRef('--weird--')).toBe('weird');
    expect(handleFor(naturalStone({ stockRef: 'AB/12#34' }))).toBe(handleFor(naturalStone({ stockRef: 'ab/12#34' })));
  });
});

describe('uniqueStockQtyFor', () => {
  it('is 1 for watches so Uploadify keeps them listed', () => {
    expect(uniqueStockQtyFor(watch(), true)).toBe(1);
  });

  it('is 0 for every loose diamond so Uploadify does not import them', () => {
    expect(uniqueStockQtyFor(naturalStone(), true)).toBe(0);
    expect(uniqueStockQtyFor(labStone({ carat: 5 }), true)).toBe(0);
    expect(uniqueStockQtyFor(labStone({ carat: 4.99 }), true)).toBe(0);
    expect(uniqueStockQtyFor(labStone({ carat: 2.01 }), true)).toBe(0);
  });
});

describe('titles', () => {
  it('builds stone titles per spec', () => {
    expect(titleFor(naturalStone())).toBe(
      '2.01ct Round Brilliant Natural Diamond — F VS1, GIA Certified',
    );
  });

  it('builds watch titles from the listing schema when condition maps', () => {
    // Fixture condition is Excellent → grade → Pre-Owned title word.
    expect(titleFor(watch())).toBe('Pre-Owned Rolex Submariner 126610LN');
  });

  it('falls back to brand model reference when condition is unrecognized', () => {
    expect(titleFor(watch({ condition: 'SLIDER' }))).toBe('Rolex Submariner 126610LN');
  });
});

describe('SEO formulas', () => {
  it('front-loads loose-diamond attributes, origin, and certification', () => {
    expect(seoTitleFor(naturalStone())).toBe(
      '2.01ct Round Brilliant Natural Diamond — F VS1 | GIA',
    );
    expect(seoTitleFor(labStone())).toBe(
      '2.01ct Round Brilliant Lab-Grown Diamond — F VS1 | IGI',
    );
    expect(seoDescriptionFor(naturalStone())).toContain(
      '2.01ct round brilliant natural diamond, graded F VS1',
    );
  });

  it('uses brand, model, reference, condition, and product type for watches', () => {
    expect(seoTitleFor(watch())).toBe(
      'Rolex Submariner 126610LN – Pre-Owned Watch',
    );
    expect(seoDescriptionFor(watch())).toContain(
      'Authenticated by Laura Milman New York.',
    );
  });

  it('keeps every generated SEO field within search-safe limits', () => {
    const longStone = naturalStone({
      shape: 'Very Long Cushion Modified Brilliant',
      lab: 'Gemological Institute of America',
    });
    const longWatch = watch({
      brand: 'Audemars Piguet',
      model: 'Royal Oak Offshore Selfwinding Chronograph',
      reference: '26420SO.OO.A002CA.01',
    });
    for (const item of [longStone, longWatch]) {
      expect(seoTitleFor(item).length).toBeLessThanOrEqual(60);
      expect(seoDescriptionFor(item).length).toBeLessThanOrEqual(160);
    }
  });
});

describe('carat bands', () => {
  it('uses half-carat bands', () => {
    expect(caratBand(0.3)).toBe('0.0-0.5ct');
    expect(caratBand(0.5)).toBe('0.5-1.0ct');
    expect(caratBand(0.99)).toBe('0.5-1.0ct');
    expect(caratBand(1.0)).toBe('1.0-1.5ct');
    expect(caratBand(2.01)).toBe('2.0-2.5ct');
    expect(caratBand(4.99)).toBe('4.5-5.0ct');
    expect(caratBand(5.0)).toBe('5.0ct+');
    expect(caratBand(9.2)).toBe('5.0ct+');
  });
});

describe('tags', () => {
  it('stone tags carry the faceting dimensions plus the feed tag', () => {
    const tags = tagsFor(naturalStone());
    for (const expected of ['lmny-feed', 'Round Brilliant', 'F', 'VS1', '2.0-2.5ct', 'GIA', 'Excellent']) {
      expect(tags).toContain(expected);
    }
  });

  it('watch tags encode box/papers status and merge schema marketing tags', () => {
    expect(tagsFor(watch({ box: true, papers: true }))).toContain('full-set');
    expect(tagsFor(watch({ box: true, papers: false }))).toContain('box-only');
    expect(tagsFor(watch({ box: false, papers: true }))).toContain('papers-only');
    expect(tagsFor(watch({ box: false, papers: false }))).toContain('naked');
    expect(tagsFor(watch())).toContain('Rolex');
    expect(tagsFor(watch())).toContain('Pre-Owned Watches');
    expect(tagsFor(watch())).toContain('lmny-feed');
  });

  it('tags non-curated brands for the Other Watch Brands collection', () => {
    const tags = tagsFor(watch({ brand: 'Invicta' }));
    expect(tags).toContain('other-watch-brand');
    expect(tags).toContain('Invicta');
    expect(tagsFor(watch({ brand: 'Rolex' }))).not.toContain('other-watch-brand');
  });

  it('tags are sorted and deduped for stable hashing', () => {
    const tags = tagsFor(naturalStone());
    expect(tags).toEqual([...tags].sort());
    expect(new Set(tags).size).toBe(tags.length);
  });
});

describe('vendor', () => {
  it('stones are LMNY, watches are the brand', () => {
    expect(vendorFor(naturalStone())).toBe('Laura Milman New York');
    expect(vendorFor(watch())).toBe('Rolex');
  });
});

describe('storefront-readable facet metafields', () => {
  const at = '2026-07-28T00:00:00Z';

  it('stones carry the custom.* facets the diamond filter faces on', () => {
    const fields = metafieldsFor(naturalStone(), priced(), 'hash', at);
    expect(find(fields, 'custom', 'diamond_shape')?.value).toBe('Round Brilliant');
    expect(find(fields, 'custom', 'color')?.value).toBe('F');
    expect(find(fields, 'custom', 'clarity')?.value).toBe('VS1');
    expect(find(fields, 'custom', 'cut')?.value).toBe('Excellent');
  });

  it('carat is numeric so the filter can be a true range, not a band', () => {
    const carat = find(metafieldsFor(naturalStone(), priced(), 'hash', at), 'custom', 'carat_weight');
    expect(carat?.type).toBe('number_decimal');
    expect(carat?.value).toBe('2.01');
  });

  it('omits cut when the feed row has none', () => {
    const fields = metafieldsFor(naturalStone({ cut: undefined }), priced(), 'hash', at);
    expect(find(fields, 'custom', 'cut')).toBeUndefined();
    expect(find(fields, 'custom', 'diamond_shape')).toBeDefined();
  });

  it('lab-grown stones get the same facets as naturals', () => {
    const fields = metafieldsFor(labStone(), priced(), 'hash', at);
    expect(find(fields, 'custom', 'diamond_shape')?.value).toBe('Round Brilliant');
    expect(find(fields, 'custom', 'carat_weight')?.value).toBe('2.01');
    expect(find(fields, 'custom', 'color')?.value).toBe('F');
    expect(find(fields, 'custom', 'clarity')?.value).toBe('VS1');
    expect(find(fields, 'custom', 'cut')?.value).toBe('Excellent');
  });

  it('watches get PDP custom.* specs plus Google Shopping metafields', () => {
    const fields = metafieldsFor(watch(), priced(), 'hash', at);
    expect(find(fields, 'custom', 'dial')?.value).toBe('Black');
    expect(find(fields, 'custom', 'metal')?.value).toBe('STEEL');
    expect(find(fields, 'mm-google-shopping', 'condition')?.value).toBe('used');
    expect(find(fields, 'global', 'MPN')?.value).toBe('126610LN');
    // Diamond-only facets stay off watches.
    expect(find(fields, 'custom', 'diamond_shape')).toBeUndefined();
    expect(find(fields, 'custom', 'carat_weight')).toBeUndefined();
  });

  it('unknown watch conditions keep their raw value and specs without a Google classification', () => {
    const fields = metafieldsFor(watch({ condition: 'SLIDER' }), priced(), 'hash', at);
    expect(find(fields, 'custom', 'condition')?.value).toBe('SLIDER');
    expect(find(fields, 'custom', 'dial')?.value).toBe('Black');
    expect(find(fields, 'custom', 'reference')?.value).toBe('126610LN');
    expect(find(fields, 'mm-google-shopping', 'condition')).toBeUndefined();
  });

  it('carries every feed video, not just the first', () => {
    const videos = ['https://dnalinks.in/a.mp4', 'https://dnalinks.in/b.mp4'];
    const fields = metafieldsFor(naturalStone({ videoUrls: videos }), priced(), 'hash', at);
    // video_url stays the first one — the diamond PDP's 360° tab reads it.
    expect(find(fields, 'lmny_feed', 'video_url')?.value).toBe(videos[0]);
    expect(find(fields, 'lmny_feed', 'video_urls')?.value).toBe(JSON.stringify(videos));
  });

  it('omits both video fields when the feed sent none', () => {
    const fields = metafieldsFor(naturalStone({ videoUrls: [] }), priced(), 'hash', at);
    expect(find(fields, 'lmny_feed', 'video_url')).toBeUndefined();
    expect(find(fields, 'lmny_feed', 'video_urls')).toBeUndefined();
  });

  it('cost_cents stays in the app-reserved namespace, never in custom', () => {
    const fields = metafieldsFor(naturalStone(), priced(), 'hash', at);
    expect(find(fields, '$app', 'cost_cents')?.value).toBe('1000000');
    expect(fields.filter((f) => f.key === 'cost_cents').map((f) => f.namespace)).toEqual(['$app']);
  });
});

describe('content hash', () => {
  it('uses the schema version that refreshes existing products for Amount-as-cost pricing', () => {
    expect(PRODUCT_SCHEMA_VERSION).toBe(19);
  });

  it('is versioned, so a payload-shape change refreshes the live catalogue', () => {
    // Guards the upgrade path: without the schema version in the hash, the
    // 2,541 products already live would hash-match and be skipped as
    // unchanged, never receiving the new custom.* facets.
    expect(contentHashFor(naturalStone(), priced())).not.toBe(
      contentHashFor(naturalStone(), priced({ retailUsd: 15001 })),
    );
    expect(contentHashFor(naturalStone(), priced())).toBe(contentHashFor(naturalStone(), priced()));
  });

  it('changes when a faceted field changes', () => {
    const base = contentHashFor(naturalStone(), priced());
    expect(contentHashFor(naturalStone({ cut: 'Very Good' }), priced())).not.toBe(base);
    expect(contentHashFor(naturalStone({ carat: 2.02 }), priced())).not.toBe(base);
  });
});

describe('updates target the existing product by id', () => {
  const at = '2026-07-28T00:00:00Z';

  it('a create carries no id and attaches its media', () => {
    const input = buildProductSetInput(naturalStone(), priced(), at);
    expect(input.id).toBeUndefined();
    expect(input.files as unknown[]).toHaveLength(1);
  });

  it('an update carries the catalogue id — without it productSet creates and collides', () => {
    const input = buildProductSetInput(naturalStone(), priced(), at, {
      id: 'gid://shopify/Product/7615054741575',
      imageCount: 1,
    });
    expect(input.id).toBe('gid://shopify/Product/7615054741575');
    expect(input.handle).toBe('nd-bd-1234');
  });

  it('an update leaves existing media alone rather than re-downloading it', () => {
    const input = buildProductSetInput(naturalStone(), priced(), at, { id: 'gid://shopify/Product/1', imageCount: 1 });
    // `files` absent, not empty — an empty list would detach every image.
    expect('files' in input).toBe(false);
  });

  it('an update retries media when the product has none', () => {
    const input = buildProductSetInput(naturalStone(), priced(), at, { id: 'gid://shopify/Product/1', imageCount: 0 });
    expect(input.files as unknown[]).toHaveLength(1);
  });

  it('an update backfills a product left holding one photo when the feed has several', () => {
    // The live shape of the media bug: every product carries exactly one image
    // because the parse only ever read one field. Matching on media *presence*
    // meant they could never pick up the rest.
    const stone = naturalStone({
      imageUrls: ['https://dnalinks.in/a.jpg', 'https://dnalinks.in/b.jpg', 'https://dnalinks.in/c.jpg'],
    });
    const input = buildProductSetInput(stone, priced(), at, { id: 'gid://shopify/Product/1', imageCount: 1 });
    expect(input.files as unknown[]).toHaveLength(3);
    // Once all three are attached, it stops re-sending them.
    const settled = buildProductSetInput(stone, priced(), at, { id: 'gid://shopify/Product/1', imageCount: 3 });
    expect('files' in settled).toBe(false);
  });

  it('an update writes inventoryItem.cost so Shopify margin is auditable', () => {
    const input = buildProductSetInput(labStone({ costUsd: 585.6 }), priced({ retailUsd: 996 }), at, {
      id: 'gid://shopify/Product/1',
      imageCount: 1,
    });
    const variant = (input.variants as Array<{ inventoryItem: { cost: string; tracked: boolean } }>)[0]!;
    expect(variant.inventoryItem.cost).toBe('585.60');
    expect(variant.inventoryItem.tracked).toBe(false);
  });

  it('a locationId writes loose diamonds as tracked qty 0 so Uploadify does not import them', () => {
    const input = buildProductSetInput(naturalStone(), priced(), at, undefined, 'gid://shopify/Location/1');
    const variant = (input.variants as Array<{
      sku: string;
      inventoryPolicy: string;
      inventoryItem: { tracked: boolean };
      inventoryQuantities: Array<{ quantity: number }>;
    }>)[0]!;
    expect(variant.sku).toBe('BD-1234');
    expect(variant.inventoryPolicy).toBe('CONTINUE');
    expect(variant.inventoryItem.tracked).toBe(true);
    expect(variant.inventoryQuantities[0]!.quantity).toBe(0);
    expect(input.category).toBe('gid://shopify/TaxonomyCategory/aa-6');
    expect(input.status).toBe('ACTIVE');
  });

  it('a lab of any size with a location is tracked qty 0 so Uploadify delists it', () => {
    for (const carat of [4.99, 5]) {
      const input = buildProductSetInput(labStone({ carat }), priced(), at, undefined, 'gid://shopify/Location/1');
      const variant = (input.variants as Array<{
        inventoryPolicy: string;
        inventoryItem: { tracked: boolean };
        inventoryQuantities: Array<{ quantity: number }>;
      }>)[0]!;
      expect(variant.inventoryPolicy).toBe('CONTINUE');
      expect(variant.inventoryItem.tracked).toBe(true);
      expect(variant.inventoryQuantities[0]!.quantity).toBe(0);
      expect(input.status).toBe('ACTIVE');
    }
  });

  it('a lab stone uses the same Jewelry category as naturals', () => {
    const input = buildProductSetInput(labStone(), priced(), at);
    expect(input.category).toBe('gid://shopify/TaxonomyCategory/aa-6');
    expect(input.productType).toBe('Lab-Grown Diamond');
  });

  it('a watch without a location stays untracked', () => {
    const input = buildProductSetInput(watch(), priced(), at);
    const variant = (input.variants as Array<{ inventoryItem: { tracked: boolean }; sku: string; inventoryQuantities?: unknown }>)[0]!;
    expect(variant.sku).toBe('W-889');
    expect(variant.inventoryItem.tracked).toBe(false);
    expect(variant.inventoryQuantities).toBeUndefined();
  });

  it('a watch with a location is tracked qty 1 for marketplace apps', () => {
    const input = buildProductSetInput(watch(), priced(), at, undefined, 'gid://shopify/Location/9');
    const variant = (input.variants as Array<{
      sku: string;
      inventoryPolicy: string;
      inventoryItem: { tracked: boolean };
      inventoryQuantities: Array<{ locationId: string; name: string; quantity: number }>;
    }>)[0]!;
    expect(variant.sku).toBe('W-889');
    expect(variant.inventoryPolicy).toBe('DENY');
    expect(variant.inventoryItem.tracked).toBe(true);
    expect(variant.inventoryQuantities).toEqual([
      { locationId: 'gid://shopify/Location/9', name: 'available', quantity: 1 },
    ]);
    expect(input.category).toBe('gid://shopify/TaxonomyCategory/aa-6-11');
    expect(input.productType).toBe('Watch');
  });

  it('an imageless watch with a location is DRAFT with tracked qty 0', () => {
    const input = buildProductSetInput(watch({ imageUrls: [] }), priced(), at, undefined, 'gid://shopify/Location/9');
    expect(input.status).toBe('DRAFT');
    const variant = (input.variants as Array<{ inventoryQuantities: Array<{ quantity: number }> }>)[0]!;
    expect(variant.inventoryQuantities[0]!.quantity).toBe(0);
  });

  it('watch creates carry schema SEO and prose description (specs are metafields)', () => {
    const input = buildProductSetInput(watch(), priced(), at);
    expect(input.title).toBe('Pre-Owned Rolex Submariner 126610LN');
    expect(String(input.descriptionHtml)).toContain('is offered by Laura Milman New York');
    expect(String(input.descriptionHtml)).not.toContain('<h3>Specifications</h3>');
    expect(input.seo).toEqual({
      title: 'Rolex Submariner 126610LN – Pre-Owned Watch',
      description: expect.stringContaining('Authenticated by Laura Milman New York.'),
    });
  });

  it('unknown-condition watches use neutral prose and remain active when media is present', () => {
    const input = buildProductSetInput(watch({ condition: 'SLIDER' }), priced(), at);
    expect(input.status).toBe('ACTIVE');
    expect(input.title).toBe('Rolex Submariner 126610LN');
    expect(String(input.descriptionHtml)).toContain('This Rolex Submariner 126610LN');
    expect(String(input.descriptionHtml)).not.toContain('<ul>');
    expect(String(input.descriptionHtml)).not.toMatch(/Pre-Owned|Unworn/);
  });

  it('writes custom SEO fields for loose diamonds', () => {
    const input = buildProductSetInput(naturalStone(), priced(), at);
    expect(input.seo).toEqual({
      title: '2.01ct Round Brilliant Natural Diamond — F VS1 | GIA',
      description: expect.stringContaining('round brilliant natural diamond'),
    });
    expect(String(input.descriptionHtml)).toMatch(/^<p>This 2\.01ct round brilliant natural diamond/);
  });

  it('watch metafields include Dial/Bezel/Bracelet/Metal/MM/Link for the PDP specs grid', () => {
    const fields = metafieldsFor(
      watch({
        caseSizeMm: '34',
        metal: '18K YG & S/S',
        dial: 'SILVER',
        bezel: 'SMOOTH',
        bracelet: 'JUBILEE',
        link: '-5',
      }),
      priced(),
      'hash',
      at,
    );
    expect(find(fields, 'custom', 'case_size')?.value).toBe('34mm');
    expect(find(fields, 'custom', 'metal')?.value).toBe('18K YG & S/S');
    expect(find(fields, 'custom', 'dial')?.value).toBe('Silver');
    expect(find(fields, 'custom', 'bezel')?.value).toBe('Smooth');
    expect(find(fields, 'custom', 'bracelet')?.value).toBe('Jubilee');
    expect(find(fields, 'custom', 'link')?.value).toBe('-5');
  });
});

describe('imageless products are quarantined at creation', () => {
  it('an item with images is ACTIVE and untagged', () => {
    const input = buildProductSetInput(naturalStone(), priced(), '2026-07-28T00:00:00Z');
    expect(input.status).toBe('ACTIVE');
    expect(input.tags as string[]).not.toContain('media-missing');
  });

  it('an item with no images is DRAFT and tagged media-missing', () => {
    const input = buildProductSetInput(naturalStone({ imageUrls: [] }), priced(), '2026-07-28T00:00:00Z');
    expect(input.status).toBe('DRAFT');
    expect(input.tags as string[]).toContain('media-missing');
    expect(input.files as unknown[]).toHaveLength(0);
  });

  it('retries a rejected file URL as a DRAFT with no files', () => {
    const input = buildProductSetInput(watch(), priced(), '2026-07-28T00:00:00Z', undefined, 'gid://shopify/Location/1');
    expect(input.files).toBeDefined();
    const quarantined = quarantineProductSetInput(input);
    expect(quarantined.files).toBeUndefined();
    expect(quarantined.status).toBe('DRAFT');
    expect(quarantined.tags as string[]).toContain('media-missing');
    const qty = (quarantined.variants as Array<{ inventoryQuantities?: Array<{ quantity: number }> }>)[0]
      ?.inventoryQuantities?.[0]?.quantity;
    expect(qty).toBe(0);
  });

  it('an imageless diamond is tracked qty 0 when quarantined', () => {
    const input = buildProductSetInput(
      naturalStone(),
      priced(),
      '2026-07-28T00:00:00Z',
      undefined,
      'gid://shopify/Location/1',
    );
    const quarantined = quarantineProductSetInput(input);
    const variant = (quarantined.variants as Array<{
      inventoryItem: { tracked: boolean };
      inventoryQuantities?: Array<{ quantity: number }>;
    }>)[0]!;
    expect(quarantined.status).toBe('DRAFT');
    expect(variant.inventoryItem.tracked).toBe(true);
    expect(variant.inventoryQuantities?.[0]?.quantity).toBe(0);
  });
});

describe('write-error policy', () => {
  it('does not fail a run for one File URL rejection on a small batch', () => {
    expect(isInvalidShopifyFileUrlError('input.files.0.originalSource: File URL is invalid')).toBe(true);
    expect(writeErrorsAreSystemic(1, 20)).toBe(false);
    expect(writeErrorsAreSystemic(1, 1)).toBe(false);
  });

  it('fails when several writes error at a high rate', () => {
    expect(writeErrorsAreSystemic(5, 20)).toBe(true);
    expect(writeErrorsAreSystemic(3, 300)).toBe(false);
  });
});
