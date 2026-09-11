import { describe, expect, it } from 'vitest';
import {
  EBAY_CONDITION_PREOWNED,
  EBAY_CONDITION_NEW_OTHER,
  EBAY_CONDITION_NEW_WITH_BOX_AND_PAPERS,
  boxPaperClause,
  ebayConditionForWatch,
  ebayFeaturesFromBoxPapers,
  ebayFeaturesFromYesNo,
  hasNewWithBoxLanguage,
  isPreownedNewWithBoxMismatch,
  planEbayConditionFix,
  rewritePreownedBoxPapersCopy,
} from '../src/ebayCondition.js';

describe('ebayConditionForWatch', () => {
  it('uses ConditionID 3000 for preowned or unknown source state', () => {
    expect(ebayConditionForWatch({ state: 'preowned', box: true, papers: true })).toBe(
      EBAY_CONDITION_PREOWNED,
    );
    expect(ebayConditionForWatch({})).toBe(EBAY_CONDITION_PREOWNED);
  });

  it('uses ConditionID 1000 only for source-confirmed unworn watches with box and papers', () => {
    expect(ebayConditionForWatch({ state: 'unworn', box: true, papers: true })).toBe(
      EBAY_CONDITION_NEW_WITH_BOX_AND_PAPERS,
    );
  });

  it('uses ConditionID 1500 for source-confirmed unworn watches without a complete accessory set', () => {
    expect(ebayConditionForWatch({ state: 'unworn', box: true, papers: false })).toBe(EBAY_CONDITION_NEW_OTHER);
    expect(ebayConditionForWatch({ state: 'unworn', box: null, papers: null })).toBe(EBAY_CONDITION_NEW_OTHER);
  });
});

describe('ebay features', () => {
  it('maps box/papers to eBay accessory aspects without the word New', () => {
    expect(ebayFeaturesFromBoxPapers(true, true)).toBe('With Box, With Papers');
    expect(ebayFeaturesFromBoxPapers(true, false)).toBe('With Box');
    expect(ebayFeaturesFromBoxPapers(false, true)).toBe('With Papers');
    expect(ebayFeaturesFromBoxPapers(undefined, undefined)).toBeUndefined();
    expect(ebayFeaturesFromYesNo('Yes', 'Yes')).toBe('With Box, With Papers');
  });
});

describe('mismatch detection', () => {
  it('flags Pre-Owned titles whose features claim New with box and papers', () => {
    expect(
      isPreownedNewWithBoxMismatch({
        title: 'Pre-Owned Rolex Sea Dweller 16600',
        fields: ['New with box and papers'],
      }),
    ).toBe(true);
    expect(
      isPreownedNewWithBoxMismatch({
        title: 'Unworn Rolex Submariner Date 126610LN',
        fields: ['New with box and papers'],
      }),
    ).toBe(false);
  });

  it('detects the canned eBay phrase in copy', () => {
    expect(hasNewWithBoxLanguage('as a full set with box and papers')).toBe(false);
    expect(hasNewWithBoxLanguage('New with box and papers: never been worn')).toBe(true);
  });
});

describe('copy rewrite', () => {
  it('drops the full-set phrase eBay maps to condition 1000', () => {
    const html =
      '<p>This Pre-Owned Rolex Datejust 126334 is offered by Laura Milman New York as a full set with box and papers.</p>';
    expect(rewritePreownedBoxPapersCopy(html)).toContain('with its original box and papers');
    expect(rewritePreownedBoxPapersCopy(html)).not.toContain('as a full set with box and papers');
    expect(rewritePreownedBoxPapersCopy('New with box and papers')).toBe('with original box and papers');
  });

  it('uses accessory wording in the listing clause', () => {
    expect(boxPaperClause(true, true)).toBe('with its original box and papers');
    expect(boxPaperClause(true, true)).not.toMatch(/new/i);
  });
});

describe('planEbayConditionFix', () => {
  it('writes Pre-owned condition and With Box/Papers for a full-set Pre-Owned watch', () => {
    const plan = planEbayConditionFix({
      title: 'Pre-Owned Rolex Sea Dweller 16600',
      descriptionHtml:
        '<p>This Pre-Owned Rolex Sea Dweller 16600 is offered by Laura Milman New York as a full set with box and papers.</p>',
      productType: 'Watch',
      box: 'Yes',
      papers: 'Yes',
      features: 'New with box and papers',
      googleCondition: 'new',
      state: 'preowned',
    });
    expect(plan).not.toBeNull();
    expect(plan?.ebayCondition).toBe('3000');
    expect(plan?.features).toBe('With Box, With Papers');
    expect(plan?.googleCondition).toBe('used');
    expect(plan?.descriptionHtml).toContain('with its original box and papers');
    expect(plan?.descriptionHtml).not.toContain('as a full set');
  });

  it('rewrites legacy New with tags text to ConditionID 1000', () => {
    const plan = planEbayConditionFix({
      title: 'Unworn Rolex Submariner Date 126610LN',
      descriptionHtml: '<p>Unworn Rolex with its original box and papers.</p>',
      productType: 'Watch',
      box: 'Yes',
      papers: 'Yes',
      ebayCondition: 'New with tags',
      features: 'With Box, With Papers',
      googleCondition: 'new',
      state: 'unworn',
    });
    expect(plan?.ebayCondition).toBe('1000');
  });

  it('leaves a settled Unworn watch on ConditionID 1000 alone', () => {
    const plan = planEbayConditionFix({
      title: 'Unworn Rolex Submariner Date 126610LN',
      descriptionHtml: '<p>Unworn Rolex with its original box and papers.</p>',
      productType: 'Watch',
      box: 'Yes',
      papers: 'Yes',
      ebayCondition: '1000',
      features: 'With Box, With Papers',
      googleCondition: 'new',
      state: 'unworn',
    });
    expect(plan).toBeNull();
  });

  it('keeps repair output pre-owned without source proof even if catalog copy says Unworn with box and papers', () => {
    const plan = planEbayConditionFix({
      title: 'Unworn Rolex Submariner Date 126610LN',
      descriptionHtml: '',
      productType: 'Watch',
      box: 'Yes',
      papers: 'Yes',
      ebayCondition: '1000',
      // A repair row may also carry custom.condition=Unworn, but mutable
      // catalog data is deliberately not passed as authoritative state.
      state: null,
    });
    expect(plan?.ebayCondition).toBe('3000');
    expect(plan?.reasons).toContain('unclassified watch source state; fail closed to pre-owned');
  });

  it('repairs a source-confirmed unworn watch without papers to ConditionID 1500', () => {
    const plan = planEbayConditionFix({
      title: 'Rolex Submariner Date 126610LN',
      descriptionHtml: '',
      productType: 'Watch',
      box: 'Yes',
      papers: 'No',
      state: 'unworn',
      ebayCondition: '1000',
      googleCondition: 'new',
    });
    expect(plan?.ebayCondition).toBe('1500');
    expect(plan?.googleCondition).toBeUndefined();
  });
});
