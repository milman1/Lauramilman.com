import { describe, expect, it } from 'vitest';
import { googleGender, googleShoppingMetafields, metalAppearance } from '../src/googleShopping.js';

describe('googleGender', () => {
  it('treats cufflinks and men\'s titles as male', () => {
    expect(googleGender('Cartier Trinity Knot Cuff Links', 'Cufflinks')).toBe('male');
    expect(googleGender("Men's Pinky Ring", 'Rings')).toBe('male');
  });

  it('uses a stated women\'s or lady title', () => {
    expect(googleGender('Pre-Owned Rolex Lady Datejust 279171', 'Watch')).toBe('female');
    expect(googleGender('Chopard Women Watch', 'Watch')).toBe('female');
  });

  it('leaves other watches unisex', () => {
    expect(googleGender('Pre-Owned Rolex Submariner 126610LN', 'Watch')).toBe('unisex');
  });

  it('treats other jewelry as female', () => {
    expect(googleGender('David Webb Elephant Bracelet', 'Bracelets')).toBe('female');
  });

  it('stays unisex when a title states both', () => {
    expect(googleGender("Men's and Women's Gold Band", 'Rings')).toBe('unisex');
  });
});

describe('metalAppearance', () => {
  it('reads a single gold color and material', () => {
    expect(metalAppearance('18K Yellow Gold')).toEqual({ color: 'Yellow Gold', material: 'Gold' });
  });

  it('skips mixed metals', () => {
    expect(metalAppearance('Platinum & 18K Yellow Gold')).toEqual({});
  });

  it('does not treat steel as silver', () => {
    expect(metalAppearance('STEEL')).toEqual({});
  });
});

describe('googleShoppingMetafields', () => {
  it('marks a piece with no GTIN as a custom product for an adult', () => {
    const fields = googleShoppingMetafields({
      title: 'David Webb Elephant Bracelet',
      productType: 'Bracelets',
      metal: '18K Yellow Gold',
    });
    const byKey = Object.fromEntries(fields.map((field) => [field.key, field.value]));
    expect(byKey.custom_product).toBe('true');
    expect(byKey.age_group).toBe('adult');
    expect(byKey.gender).toBe('female');
    expect(byKey.color).toBe('Yellow Gold');
    expect(byKey.material).toBe('Gold');
    expect(fields.every((field) => field.namespace === 'mm-google-shopping')).toBe(true);
    expect(byKey.condition).toBeUndefined();
  });
});
