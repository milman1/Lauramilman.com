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

describe('shape normalization', () => {
  function shapeOf(shape: string): string {
    const { items } = normalizeStones([{ ...stoneRow, shape }], 'natural');
    const item = items[0]!;
    return item.kind !== 'watch' ? item.shape : '';
  }

  it('collapses the trade codes the feed actually emits', () => {
    expect(shapeOf('MRB')).toBe('Round');
    expect(shapeOf('RMB')).toBe('Round');
    expect(shapeOf('ROUND')).toBe('Round');
    expect(shapeOf('SQCU')).toBe('Cushion');
    expect(shapeOf('LCU')).toBe('Cushion');
    expect(shapeOf('LRAD')).toBe('Radiant');
    expect(shapeOf('OVR')).toBe('Oval');
    expect(shapeOf('TRISTPR')).toBe('Trilliant');
  });

  it('gives one casing per shape, so the filter has one button not two', () => {
    expect(shapeOf('ROUND')).toBe(shapeOf('Round'));
    expect(shapeOf('ASSCHER')).toBe('Asscher');
    expect(shapeOf('emerald')).toBe('Emerald');
  });

  it('passes an unknown shape through readably rather than dropping it', () => {
    expect(shapeOf('OLD MINE')).toBe('Old Mine');
  });
});

describe('grade normalization', () => {
  function gradesOf(row: Record<string, unknown>) {
    const { items } = normalizeStones([{ ...stoneRow, ...row }], 'natural');
    const item = items[0]!;
    if (item.kind === 'watch') throw new Error('expected a stone');
    return item;
  }

  it('spells out cut, so a Good cut is not tagged "G" like colour G', () => {
    expect(gradesOf({ cut: 'EX' }).cut).toBe('Excellent');
    expect(gradesOf({ cut: 'VG' }).cut).toBe('Very Good');
    expect(gradesOf({ cut: 'G' }).cut).toBe('Good');
    expect(gradesOf({ cut: 'ID' }).cut).toBe('Ideal');
  });

  it('applies the same scale to polish and symmetry', () => {
    const item = gradesOf({ polish: 'VG', symmetry: 'EX' });
    expect(item.polish).toBe('Very Good');
    expect(item.symmetry).toBe('Excellent');
  });

  it('spells out fluorescence', () => {
    expect(gradesOf({ fluorescence: 'NON' }).fluorescence).toBe('None');
    expect(gradesOf({ fluorescence: 'FNT' }).fluorescence).toBe('Faint');
    expect(gradesOf({ fluorescence: 'VST' }).fluorescence).toBe('Very Strong');
  });

  it('leaves cut undefined when the feed omits it', () => {
    expect(gradesOf({}).cut).toBeUndefined();
    expect(gradesOf({ cut: '  ' }).cut).toBeUndefined();
  });
});

describe('certificate number recovery from URL', () => {
  it('reads the number out of a hosted-PDF filename — the live catalogue shape', async () => {
    const { certNumberFromUrl } = await import('../src/normalize.js');
    expect(certNumberFromUrl('https://dnalinks.in/certificate_images/6455949159.pdf')).toBe('6455949159');
    expect(certNumberFromUrl('https://dnalinks.in/certificate_images/2544514964.pdf')).toBe('2544514964');
  });

  it('reads report-check query params', async () => {
    const { certNumberFromUrl } = await import('../src/normalize.js');
    expect(certNumberFromUrl('https://www.gia.edu/report-check?reportno=2205551234')).toBe('2205551234');
  });

  it('refuses non-numeric filenames rather than inventing a number', async () => {
    const { certNumberFromUrl } = await import('../src/normalize.js');
    expect(certNumberFromUrl('https://dnalinks.in/certs/certificate.pdf')).toBeUndefined();
    expect(certNumberFromUrl('https://dnalinks.in/certs/')).toBeUndefined();
    expect(certNumberFromUrl(undefined)).toBeUndefined();
    expect(certNumberFromUrl('not a url')).toBeUndefined();
  });

  it('normalizeStones falls back to the URL when the Certificate field is empty', async () => {
    const { normalizeStones } = await import('../src/normalize.js');
    const { items } = normalizeStones([{
      stock_ref: 'BD-9', shape: 'ROUND', carat: '1.5', color: 'F', clarity: 'VS1', lab: 'GIA',
      cost: '5000', rap_price: '10000',
      certificatelink: 'https://dnalinks.in/certificate_images/1234567890.pdf',
      image: 'https://dnalinks.in/img/a.jpg',
    }], 'natural');
    const item = items[0]!;
    expect(item.kind !== 'watch' && item.certNumber).toBe('1234567890');
  });

  it('a feed-supplied Certificate field still wins over the URL', async () => {
    const { normalizeStones } = await import('../src/normalize.js');
    const { items } = normalizeStones([{
      stock_ref: 'BD-10', shape: 'ROUND', carat: '1.5', color: 'F', clarity: 'VS1', lab: 'GIA',
      cost: '5000', rap_price: '10000', certificate: 'GIA-777',
      certificatelink: 'https://dnalinks.in/certificate_images/1234567890.pdf',
      image: 'https://dnalinks.in/img/a.jpg',
    }], 'natural');
    const item = items[0]!;
    expect(item.kind !== 'watch' && item.certNumber).toBe('GIA-777');
  });
});

describe('IGI ideal-cut code', () => {
  it('maps bare I to Ideal — 4,677 lab rounds carry it', async () => {
    const { normalizeCutGrade } = await import('../src/normalize.js');
    expect(normalizeCutGrade('I')).toBe('Ideal');
    expect(normalizeCutGrade('ID')).toBe('Ideal');
  });
});
