import { describe, expect, it } from 'vitest';
import {
  alreadyProcessed,
  buildWatchListing,
  linkClause,
  normalizeCaseSize,
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
    expect(listing.title).toBe('Pre-Owned Rolex Submariner Date 126610LN 2014');
    expect(listing.seoTitle).toBe('Rolex Submariner Date 126610LN Pre-Owned 2014 Watch');
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
    expect(listing.metafields.find((m) => m.namespace === 'custom' && m.key === 'ebay_condition')?.value).toBe(
      '3000',
    );
    expect(listing.metafields.find((m) => m.namespace === 'custom' && m.key === 'features')?.value).toBe(
      'With Box, With Papers',
    );
    expect(listing.descriptionHtml).toContain('with its original box and papers');
    expect(listing.descriptionHtml).not.toMatch(/new with box/i);
    expect(listing.descriptionHtml).not.toContain('as a full set');
  });

  it('maps grade values to Pre-Owned and writes Condition Grade metafield', () => {
    const listing = buildWatchListing(base({ conditionRaw: 'EXCELLENT', box: false, paper: false }));
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    expect(listing.title).toBe('Pre-Owned Rolex Submariner Date 126610LN 2014');
    expect(listing.descriptionHtml).toContain('It is in excellent condition.');
    expect(listing.descriptionHtml).toContain('on its own, without box or papers');
    expect(listing.descriptionHtml).not.toContain('<h3>Specifications</h3>');
    expect(listing.metafields.find((m) => m.namespace === 'custom' && m.key === 'condition_grade')?.value).toBe(
      'Excellent',
    );
    expect(listing.seoDescription).toContain(', excellent condition');
  });

  it('uses eBay 1500 when the API says unworn but a complete box-and-papers set is not confirmed', () => {
    const listing = buildWatchListing(base({ conditionRaw: 'UNWORN', box: true, paper: false }));
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    expect(listing.metafields.find((m) => m.namespace === 'custom' && m.key === 'ebay_condition')?.value).toBe('1500');
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
    expect(listing.title).toBe('Unworn Rolex GMT-Master II 126710BLNR 2014');
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
      type: 'Wristwatch',
      handedness: 'Right',
      style: 'Submariner Date',
    });
    expect(listing.descriptionHtml).not.toContain('<table>');
  });

  it('writes human-readable link copy for extra and missing bracelet links', () => {
    const extra = buildWatchListing(base({ link: 19 }));
    expect('needsReview' in extra).toBe(false);
    if ('needsReview' in extra) return;
    expect(extra.descriptionHtml).toContain('<strong>Bracelet links:</strong> 19 additional bracelet links included');

    const missing = buildWatchListing(base({ link: '-5' }));
    expect('needsReview' in missing).toBe(false);
    if ('needsReview' in missing) return;
    expect(missing.descriptionHtml).toContain('<strong>Bracelet links:</strong> 5 bracelet links missing');

    const oneMissing = buildWatchListing(base({ link: -1 }));
    expect('needsReview' in oneMissing).toBe(false);
    if ('needsReview' in oneMissing) return;
    expect(oneMissing.descriptionHtml).toContain('<strong>Bracelet links:</strong> 1 bracelet link missing');

    const none = buildWatchListing(base({ link: 0 }));
    expect('needsReview' in none).toBe(false);
    if ('needsReview' in none) return;
    expect(none.descriptionHtml).toContain('<strong>Bracelet links:</strong> Not specified');
  });

  it('drops redundant NAKED comments when box and paper are both No', () => {
    const listing = buildWatchListing(
      base({ box: false, paper: false, comment: 'NAKED' }),
    );
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    expect(listing.descriptionHtml).not.toContain('NAKED');
  });

  it('preserves an unrecognized condition without classifying the watch', () => {
    const listing = buildWatchListing(base({ conditionRaw: 'SLIDER' }));
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    expect(listing.title).toBe('Rolex Submariner Date 126610LN 2014');
    expect(listing.title).not.toMatch(/Pre-Owned|Unworn/);
    expect(listing.descriptionHtml).toContain('This Rolex Submariner Date 126610LN');
    expect(listing.descriptionHtml).not.toMatch(/Pre-Owned|Unworn/);
    expect(listing.seoTitle).toBe('Rolex Submariner Date 126610LN 2014 Watch');
    expect(listing.tags).toContain('SLIDER');
    expect(listing.metafields.find((m) => m.namespace === 'custom' && m.key === 'condition')?.value).toBe(
      'SLIDER',
    );
    expect(listing.metafields.find((m) => m.namespace === 'custom' && m.key === 'ebay_condition')?.value).toBe(
      '3000',
    );
    expect(listing.metafields.find((m) => m.namespace === 'custom' && m.key === 'brand')?.value).toBe('Rolex');
    expect(
      listing.metafields.find((m) => m.namespace === 'mm-google-shopping' && m.key === 'condition'),
    ).toBeUndefined();
  });

  it('omits a blank unknown condition instead of inventing one', () => {
    const listing = buildWatchListing(base({ conditionRaw: '  ' }));
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    expect(listing.tags).not.toContain('Pre-Owned Watches');
    expect(listing.tags).not.toContain('Unworn Watches');
    expect(listing.metafields.find((m) => m.namespace === 'custom' && m.key === 'condition')).toBeUndefined();
    expect(listing.metafields.find((m) => m.namespace === 'mm-google-shopping' && m.key === 'condition')).toBeUndefined();
    expect(listing.metafields.find((m) => m.namespace === 'global' && m.key === 'MPN')).toEqual({
      namespace: 'global',
      key: 'MPN',
      value: '126610LN',
      type: 'single_line_text_field',
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
    expect(listing.seoTitle.length).toBeLessThanOrEqual(80);
    expect(listing.seoTitle).toContain('26240BA.OO.1320BA.02');
    expect(listing.seoTitle).toContain('Pre-Owned');
  });

  it('normalizes units and renders unknown source facts safely', () => {
    expect(normalizeCaseSize(' 40 MM ')).toBe('40mm');
    expect(normalizeCaseSize('40mm')).toBe('40mm');
    expect(normalizeCaseSize('0')).toBeNull();
    expect(normalizeCaseSize('40<script>')).toBeNull();
    const listing = buildWatchListing(base({ caseSizeMm: '40 MM', year: 'N/A', link: 0, comment: '<b>note</b>' }));
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    expect(listing.descriptionHtml).toContain('<strong>Case size:</strong> 40mm');
    expect(listing.descriptionHtml).toContain('<strong>Year:</strong> Not specified');
    expect(listing.descriptionHtml).toContain('<strong>Bracelet links:</strong> Not specified');
    expect(listing.descriptionHtml).toContain('&lt;b&gt;note&lt;/b&gt;');
    expect(listing.descriptionHtml).not.toContain('40mmmm');
  });

  it('preserves full reference and condition near the title boundary', () => {
    const listing = buildWatchListing(base({ brand: 'AUDEMARS PIGUET', model: 'ROYAL OAK SELFWINDING CHRONOGRAPH', reference: '26240BA.OO.1320BA.02', caseSizeMm: 41, year: '2024' }));
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    expect(listing.title.length).toBeLessThanOrEqual(80);
    expect(listing.title).toContain('26240BA.OO.1320BA.02');
    expect(listing.title.startsWith('Pre-Owned ')).toBe(true);
    expect(listing.metafields.find((m) => m.key === 'ebay_condition')?.value).toBe('3000');
  });

  it('shortens only the title model at whole-word boundaries', () => {
    const model = 'ROYAL OAK OFFSHORE SELFWINDING CHRONOGRAPH';
    const listing = buildWatchListing(base({
      brand: 'AUDEMARS PIGUET',
      model,
      reference: '26420SO.OO.A002CA.01',
    }));
    expect('needsReview' in listing).toBe(false);
    if ('needsReview' in listing) return;
    expect(listing.title.length).toBeLessThanOrEqual(80);
    expect(listing.title).toContain('26420SO.OO.A002CA.01');
    expect(listing.title).not.toMatch(/CHRONOGR$/);
    expect(listing.descriptionHtml).toContain('Royal Oak Offshore Selfwinding Chronograph');
    expect(listing.metafields.find((m) => m.key === 'model')?.value).toBe(
      'Royal Oak Offshore Selfwinding Chronograph',
    );
  });

  it('holds an identity that cannot fit condition, brand, reference, and one model word', () => {
    const listing = buildWatchListing(base({
      brand: 'ROLEX',
      model: 'X'.repeat(90),
      reference: '126610LN',
    }));
    expect(listing).toMatchObject({ needsReview: true });
  });
});

describe('linkClause', () => {
  it('maps signed link counts to prose', () => {
    expect(linkClause(2)).toBe('2 additional bracelet links included');
    expect(linkClause(1)).toBe('1 additional bracelet link included');
    expect(linkClause('-5')).toBe('5 bracelet links missing');
    expect(linkClause(-1)).toBe('1 bracelet link missing');
    expect(linkClause(0)).toBe('Not specified');
    expect(linkClause(null)).toBe('Not specified');
    expect(linkClause('-1.5')).toBe('Not specified');
    expect(linkClause('many')).toBe('Not specified');
  });
});

describe('alreadyProcessed', () => {
  it('detects schema prefixes', () => {
    expect(alreadyProcessed('Pre-Owned Rolex Submariner Date 126610LN')).toBe(true);
    expect(alreadyProcessed('Unworn Rolex GMT-Master II 126710BLNR')).toBe(true);
    expect(alreadyProcessed('Rolex Submariner 126610LN')).toBe(false);
  });
});
