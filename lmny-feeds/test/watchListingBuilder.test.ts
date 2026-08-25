import { describe, expect, it } from 'vitest';
import {
  alreadyProcessed,
  buildWatchListing,
  type WatchFeedRecord,
} from '../src/watchListingBuilder.js';

function base(overrides: Partial<WatchFeedRecord> = {}): WatchFeedRecord {
  return {
    brand: 'ROLEX',
    model: 'SUBMARINER DATE',
    reference: '126610LN',
    year: '2014',
    conditionRaw: 'PRE OWNED',
    box: true,
    paper: true,
    stockNumber: 'P5276',
    ...overrides,
  };
}

describe('buildWatchListing', () => {
  it('builds the schema title, SEO, tags, and metafields for PRE OWNED', () => {
    const listing = buildWatchListing(base());
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    expect(listing.title).toBe('Pre-Owned Rolex Submariner Date 126610LN');
    expect(listing.seoTitle).toBe('Rolex Submariner Date 126610LN – Pre-Owned Watch');
    expect(listing.seoDescription).toContain('Authenticated by Laura Milman New York.');
    expect(listing.tags).toEqual([
      'Rolex',
      'Pre-Owned Watches',
      '126610LN',
      'Submariner Date',
      'Watches',
    ]);
    expect(listing.metafields.find((m) => m.namespace === 'mm-google-shopping' && m.key === 'condition')).toEqual({
      namespace: 'mm-google-shopping',
      key: 'condition',
      value: 'used',
      type: 'single_line_text_field',
    });
    expect(listing.metafields.find((m) => m.namespace === 'global' && m.key === 'MPN')).toEqual({
      namespace: 'global',
      key: 'MPN',
      value: '126610LN',
      type: 'single_line_text_field',
    });
    expect(listing.metafields.find((m) => m.namespace === 'custom' && m.key === 'brand')?.value).toBe('Rolex');
    expect(listing.metafields.find((m) => m.namespace === 'custom' && m.key === 'condition')?.value).toBe('Pre-Owned');
  });

  it('maps grade values to Pre-Owned and writes Condition Grade metafield', () => {
    const listing = buildWatchListing(base({ conditionRaw: 'EXCELLENT', box: false, paper: false }));
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    expect(listing.title).toBe('Pre-Owned Rolex Submariner Date 126610LN');
    expect(listing.descriptionHtml).toContain('It is in excellent condition.');
    expect(listing.descriptionHtml).toContain('on its own, without box or papers');
    expect(listing.descriptionHtml).not.toContain('<h3>Specifications</h3>');
    expect(listing.metafields.find((m) => m.namespace === 'custom' && m.key === 'condition_grade')?.value).toBe(
      'Excellent',
    );
    expect(listing.seoDescription).toContain(', excellent condition');
  });

  it('maps UNWORN to new Google condition and Unworn title word', () => {
    const listing = buildWatchListing(base({ conditionRaw: 'UNWORN' }));
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    expect(listing.title.startsWith('Unworn ')).toBe(true);
    expect(listing.metafields.find((m) => m.key === 'condition')?.value).toBe('new');
  });

  it('preserves hyphenated models, GMT, and roman numerals', () => {
    const listing = buildWatchListing(
      base({
        model: 'GMT-MASTER II',
        reference: '126710BLNR',
        conditionRaw: 'UNWORN',
      }),
    );
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    expect(listing.title).toBe('Unworn Rolex GMT-Master II 126710BLNR');
  });

  it('normalizes FEB-2016 years and never re-cases the reference', () => {
    const listing = buildWatchListing(
      base({
        year: 'FEB-2016',
        reference: '26240BA.OO.1320BA.02',
        brand: 'AUDEMARS PIGUET',
        model: 'ROYAL OAK SELFWINDING',
      }),
    );
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    expect(listing.descriptionHtml).toContain('from February 2016');
    expect(listing.metafields.find((m) => m.key === 'reference')?.value).toBe('26240BA.OO.1320BA.02');
    expect(listing.metafields.find((m) => m.key === 'year')?.value).toBe('February 2016');
  });

  it('omits box/paper clause and metafields when both are unstated', () => {
    const listing = buildWatchListing(base({ box: undefined, paper: undefined }));
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    expect(listing.descriptionHtml).toContain('is offered by Laura Milman New York.');
    expect(listing.metafields.find((m) => m.key === 'box')).toBeUndefined();
    expect(listing.metafields.find((m) => m.key === 'papers')).toBeUndefined();
  });

  it('writes Dial/Bezel/Metal/MM/Link as custom.* metafields for the PDP grid', () => {
    const listing = buildWatchListing(base({ ogTag: true, link: 19, caseSizeMm: 41, metal: '18K YG & S/S', dial: 'GREY TAPISSERIE', bezel: 'OCTAGON' }));
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    const custom = Object.fromEntries(
      listing.metafields.filter((m) => m.namespace === 'custom').map((m) => [m.key, m.value]),
    );
    expect(custom).toMatchObject({
      case_size: '41mm',
      metal: '18K YG & S/S',
      dial: 'Grey Tapisserie',
      bezel: 'Octagon',
      link: '19',
      original_tag: 'Yes',
    });
    expect(listing.descriptionHtml).not.toContain('<table>');
  });

  it('drops redundant NAKED comments when box and paper are both No', () => {
    const listing = buildWatchListing(
      base({ box: false, paper: false, comment: 'NAKED' }),
    );
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    expect(listing.descriptionHtml).not.toContain('NAKED');
  });

  it('returns needsReview for unrecognized conditions', () => {
    const listing = buildWatchListing(base({ conditionRaw: 'SLIDER' }));
    expect(listing).toMatchObject({
      needsReview: true,
      reason: 'Unrecognized condition value: "SLIDER"',
    });
  });

  it('truncates SEO title at a word boundary under 60 chars', () => {
    const listing = buildWatchListing(
      base({
        brand: 'AUDEMARS PIGUET',
        model: 'ROYAL OAK SELFWINDING',
        reference: '26240BA.OO.1320BA.02',
      }),
    );
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    expect(listing.seoTitle.length).toBeLessThanOrEqual(60);
    expect(listing.seoTitle).toMatch(/– Pre-Owned Watch$/);
  });
});

describe('alreadyProcessed', () => {
  it('detects schema prefixes', () => {
    expect(alreadyProcessed('Pre-Owned Rolex Submariner Date 126610LN')).toBe(true);
    expect(alreadyProcessed('Unworn Rolex GMT-Master II 126710BLNR')).toBe(true);
    expect(alreadyProcessed('Rolex Submariner 126610LN')).toBe(false);
  });
});
