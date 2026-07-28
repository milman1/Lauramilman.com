import { describe, expect, it } from 'vitest';
import { buildProductSetInput, caratBand, handleFor, sanitizeRef, tagsFor, titleFor, vendorFor } from '../src/product.js';
import { labStone, naturalStone, priced, watch } from './fixtures.js';

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
