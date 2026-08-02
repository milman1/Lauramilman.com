import { describe, expect, it } from 'vitest';
import {
  buildProductSetInput,
  caratBand,
  contentHashFor,
  handleFor,
  metafieldsFor,
  sanitizeRef,
  tagsFor,
  titleFor,
  vendorFor,
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

describe('titles', () => {
  it('builds stone titles per spec', () => {
    expect(titleFor(naturalStone())).toBe('2.01ct Round Brilliant, F VS1 — GIA');
  });

  it('builds watch titles as brand model reference', () => {
    expect(titleFor(watch())).toBe('Rolex Submariner 126610LN');
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

  it('watch tags encode box/papers status', () => {
    expect(tagsFor(watch({ box: true, papers: true }))).toContain('full-set');
    expect(tagsFor(watch({ box: true, papers: false }))).toContain('box-only');
    expect(tagsFor(watch({ box: false, papers: true }))).toContain('papers-only');
    expect(tagsFor(watch({ box: false, papers: false }))).toContain('naked');
    expect(tagsFor(watch())).toContain('Rolex');
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

  it('watches get no diamond facets', () => {
    const fields = metafieldsFor(watch(), priced(), 'hash', at);
    expect(fields.filter((f) => f.namespace === 'custom')).toHaveLength(0);
  });

  it('cost_cents stays in the app-reserved namespace, never in custom', () => {
    const fields = metafieldsFor(naturalStone(), priced(), 'hash', at);
    expect(find(fields, '$app', 'cost_cents')?.value).toBe('1000000');
    expect(fields.filter((f) => f.key === 'cost_cents').map((f) => f.namespace)).toEqual(['$app']);
  });
});

describe('content hash', () => {
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
      mediaCount: 1,
    });
    expect(input.id).toBe('gid://shopify/Product/7615054741575');
    expect(input.handle).toBe('nd-bd-1234');
  });

  it('an update leaves existing media alone rather than re-downloading it', () => {
    const input = buildProductSetInput(naturalStone(), priced(), at, { id: 'gid://shopify/Product/1', mediaCount: 1 });
    // `files` absent, not empty — an empty list would detach every image.
    expect('files' in input).toBe(false);
  });

  it('an update retries media when the product has none', () => {
    const input = buildProductSetInput(naturalStone(), priced(), at, { id: 'gid://shopify/Product/1', mediaCount: 0 });
    expect(input.files as unknown[]).toHaveLength(1);
  });

  it('everything else is still sent on an update', () => {
    const input = buildProductSetInput(naturalStone(), priced(), at, { id: 'gid://shopify/Product/1', mediaCount: 1 });
    expect(input.title).toBe('2.01ct Round Brilliant, F VS1 — GIA');
    expect(input.status).toBe('ACTIVE');
    expect((input.variants as Array<{ price: string }>)[0]!.price).toBe('15000.00');
    expect(input.metafields as unknown[]).not.toHaveLength(0);
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
});
