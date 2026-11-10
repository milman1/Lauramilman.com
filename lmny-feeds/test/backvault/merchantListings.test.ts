import { describe, expect, it } from 'vitest';
import {
  MAX_MERCHANT_DRAFTS_PER_RUN,
  MIN_FULL_CATALOG_ROWS,
  planMerchantListings,
  supplierAvailability,
  type MerchantListing,
} from '../../src/backvault/merchantListings.js';

const listing = (handle: string, status = 'ACTIVE'): MerchantListing => ({ id: `gid://shopify/Product/${handle}`, handle, status });
const row = (handle: string, available: boolean) => ({ handle, variants: [{ available }] });

describe('supplierAvailability', () => {
  it('reads any-variant availability by the supplier handle', () => {
    const map = supplierAvailability([
      row('cartier-juste-un-clou-18k-white-gold-diamond-tip-ring-j10171', true),
      { handle: 'tiffany-co-18k-yellow-gold-atlas-large-model-necklace-rr7005', variants: [{ available: false }, { available: false }] },
      { handle: 'broken-row' },
    ]);
    expect(map.get('cartier-juste-un-clou-18k-white-gold-diamond-tip-ring-j10171')).toBe(true);
    expect(map.get('tiffany-co-18k-yellow-gold-atlas-large-model-necklace-rr7005')).toBe(false);
    expect(map.has('broken-row')).toBe(false);
  });
});

describe('planMerchantListings', () => {
  const rows = MIN_FULL_CATALOG_ROWS;

  it('suppresses the bv- copy of every active merchant listing, pointing at the merchant handle', () => {
    const plan = planMerchantListings([listing('cartier-juste-un-clou-18k-white-gold-diamond-tip-ring-j10171')], null, 0);
    expect(plan.suppressed.get('bv-cartier-juste-un-clou-18k-white-gold-diamond-tip-ring-j10171')).toBe(
      'cartier-juste-un-clou-18k-white-gold-diamond-tip-ring-j10171',
    );
    // No supplier data: copies are still suppressed, nothing is drafted.
    expect(plan.toDraft).toEqual([]);
  });

  it('leaves a draft merchant listing alone: no suppression, never reactivated or drafted again', () => {
    const plan = planMerchantListings([listing('cartier-love-18k-white-gold-love-size-18-bracelet-rr9205', 'DRAFT')], new Map(), rows);
    expect(plan.suppressed.size).toBe(0);
    expect(plan.toDraft).toEqual([]);
  });

  it('keeps a listing the supplier still has, drafts one it lists as sold or no longer lists', () => {
    const availability = new Map([
      ['cartier-panthere-18k-yellow-gold-factory-diamond-mid-size-ref-1280-2-watch-rr9758', true],
      ['hermes-18k-yellow-gold-golf-ball-cuff-links-rr9499', false],
    ]);
    const plan = planMerchantListings(
      [
        listing('cartier-panthere-18k-yellow-gold-factory-diamond-mid-size-ref-1280-2-watch-rr9758'),
        listing('hermes-18k-yellow-gold-golf-ball-cuff-links-rr9499'),
        listing('cartier-love-18k-yellow-gold-love-bangle-size-16-bracelet-rr8823'),
      ],
      availability,
      rows,
    );
    expect(plan.inStock).toBe(1);
    expect(plan.toDraft.map((l) => l.handle)).toEqual([
      'hermes-18k-yellow-gold-golf-ball-cuff-links-rr9499',
      'cartier-love-18k-yellow-gold-love-bangle-size-16-bracelet-rr8823',
    ]);
  });

  it('never drafts a missing listing whose handle has no supplier stock number', () => {
    const plan = planMerchantListings([listing('chopard-18k-white-gold-1970s')], new Map(), rows);
    expect(plan.toDraft).toEqual([]);
  });

  it('drafts nothing when the full catalog read looks truncated', () => {
    const plan = planMerchantListings([listing('hermes-18k-yellow-gold-golf-ball-cuff-links-rr9499')], new Map(), rows - 1);
    expect(plan.toDraft).toEqual([]);
    expect(plan.draftsHeld).toMatch(/full catalog returned/);
  });

  it('holds every draft when more listings look sold than one run may move', () => {
    const many = Array.from({ length: MAX_MERCHANT_DRAFTS_PER_RUN + 1 }, (_, i) => listing(`cartier-piece-rr${1000 + i}`));
    const plan = planMerchantListings(many, new Map(), rows);
    expect(plan.toDraft).toEqual([]);
    expect(plan.draftsHeld).toMatch(/none drafted/);
    // Suppression still applies: the guard is about drafting, not about copies.
    expect(plan.suppressed.size).toBe(many.length);
  });
});
