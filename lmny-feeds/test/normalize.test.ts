import { describe, expect, it } from 'vitest';
import { normalizeStones, normalizeWatches } from '../src/normalize.js';

const stoneRow = {
  stock_ref: 'BD-1',
  shape: 'Round Brilliant',
  carat: '2.01',
  color: 'F',
  clarity: 'VS1',
  lab: 'GIA',
  cost: '10,000',
  rap_price: '20000',
  image: 'https://dnalinks.in/img/a.jpg, https://dnalinks.in/img/b.jpg',
};

describe('stone normalization', () => {
  it('parses a feed row with string numerics and comma-joined images', () => {
    const { items, holds } = normalizeStones([stoneRow], 'natural');
    expect(holds).toEqual([]);
    const item = items[0]!;
    expect(item).toMatchObject({ kind: 'natural', stockRef: 'BD-1', carat: 2.01, costUsd: 10000, rapPriceUsd: 20000 });
    expect(item.kind === 'natural' && item.imageUrls).toHaveLength(2);
  });

  it('enforces the L colour floor', () => {
    const { items, holds } = normalizeStones([{ ...stoneRow, color: 'M' }], 'natural');
    expect(items).toEqual([]);
    expect(holds[0]).toMatchObject({ reason: 'color_below_floor', stockRef: 'BD-1' });
  });

  it('enforces the SI2 clarity floor', () => {
    const { holds } = normalizeStones([{ ...stoneRow, clarity: 'I1' }], 'natural');
    expect(holds[0]?.reason).toBe('clarity_below_floor');
    const okay = normalizeStones([{ ...stoneRow, clarity: 'si2' }], 'natural');
    expect(okay.items).toHaveLength(1);
  });

  it('holds rows missing grading fields or cost', () => {
    expect(normalizeStones([{ ...stoneRow, lab: '' }], 'lab').holds[0]?.reason).toBe('missing_grading_fields');
    expect(normalizeStones([{ ...stoneRow, cost: '' }], 'lab').holds[0]?.reason).toBe('missing_cost');
    expect(normalizeStones([{ shape: 'Round' }], 'lab').holds[0]?.reason).toBe('missing_stock_ref');
  });
});

const watchRow = {
  stock_no: 'W-9',
  brand: 'Rolex',
  model: 'Submariner',
  reference: '126610LN',
  cost: 9000,
  box: 'yes',
  papers: 'no',
};

describe('watch normalization', () => {
  it('parses a watch row and derives is_naked', () => {
    const { items } = normalizeWatches([watchRow]);
    expect(items[0]).toMatchObject({ kind: 'watch', stockRef: 'W-9', box: true, papers: false, isNaked: false });
    const naked = normalizeWatches([{ ...watchRow, box: 'no', papers: '' }]);
    expect(naked.items[0]).toMatchObject({ isNaked: true });
  });

  it('holds non-curated brands', () => {
    const { holds } = normalizeWatches([{ ...watchRow, brand: 'Invicta' }]);
    expect(holds[0]?.reason).toBe('watch_brand_not_curated');
  });

  it('curation is case-insensitive', () => {
    const { items } = normalizeWatches([{ ...watchRow, brand: 'ROLEX' }]);
    expect(items).toHaveLength(1);
  });
});

describe('cert URL coercion', () => {
  it('adds https:// to a scheme-less feed URL (the record that failed the live run)', () => {
    const { items } = normalizeStones(
      [{ ...stoneRow, CertificateLink: 'dnalinks.in/certificate_images/123.pdf' }],
      'natural',
    );
    expect(items[0]?.kind !== 'watch' && items[0]?.certUrl).toBe('https://dnalinks.in/certificate_images/123.pdf');
  });

  it('keeps a well-formed URL unchanged', () => {
    const { items } = normalizeStones(
      [{ ...stoneRow, CertificateLink: 'https://www.gia.edu/report?x=1' }],
      'natural',
    );
    expect(items[0]?.kind !== 'watch' && items[0]?.certUrl).toBe('https://www.gia.edu/report?x=1');
  });

  it('drops junk rather than emitting an invalid URL', () => {
    for (const junk of ['', '-', 'N/A', 'pending']) {
      const { items } = normalizeStones([{ ...stoneRow, CertificateLink: junk }], 'natural');
      expect(items[0]?.kind !== 'watch' && items[0]?.certUrl).toBeUndefined();
    }
  });
});
