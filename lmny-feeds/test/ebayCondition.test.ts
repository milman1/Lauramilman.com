import { describe, expect, it } from 'vitest';
import {
  EBAY_CONDITION_PREOWNED,
  EBAY_CONDITION_UNWORN,
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
  it('uses Pre-owned for Pre-Owned titles and feed preowned state', () => {
    expect(ebayConditionForWatch({ title: 'Pre-Owned Rolex Submariner 126610LN', state: 'preowned' })).toBe(
      EBAY_CONDITION_PREOWNED,
    );
    expect(ebayConditionForWatch({ title: 'Rolex Datejust 126334' })).toBe(EBAY_CONDITION_PREOWNED);
  });

  it('uses New with tags only when the watch is Unworn', () => {
    expect(ebayConditionForWatch({ title: 'Unworn Rolex Submariner Date 126610LN', state: 'unworn' })).toBe(
      EBAY_CONDITION_UNWORN,
    );
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
    });
    expect(plan).not.toBeNull();
    expect(plan?.ebayCondition).toBe('Pre-owned');
    expect(plan?.features).toBe('With Box, With Papers');
    expect(plan?.googleCondition).toBe('used');
    expect(plan?.descriptionHtml).toContain('with its original box and papers');
    expect(plan?.descriptionHtml).not.toContain('as a full set');
  });

  it('leaves a settled Unworn watch alone', () => {
    const plan = planEbayConditionFix({
      title: 'Unworn Rolex Submariner Date 126610LN',
      descriptionHtml: '<p>Unworn Rolex with its original box and papers.</p>',
      productType: 'Watch',
      box: 'Yes',
      papers: 'Yes',
      ebayCondition: 'New with tags',
      features: 'With Box, With Papers',
      googleCondition: 'new',
    });
    expect(plan).toBeNull();
  });
});
