import { describe, expect, it } from 'vitest';
import { matchDesigner, TOP_DESIGNERS } from '../../src/backvault/designers.js';

describe('matchDesigner', () => {
  it('matches exact names', () => {
    expect(matchDesigner('Cartier')?.name).toBe('Cartier');
    expect(matchDesigner('Van Cleef & Arpels')?.handle).toBe('van-cleef-arpels');
  });

  it('is case-insensitive', () => {
    expect(matchDesigner('cartier')?.name).toBe('Cartier');
    expect(matchDesigner('TIFFANY & CO.')?.name).toBe('Tiffany & Co.');
  });

  it('tolerates accent differences', () => {
    expect(matchDesigner('Faberge')?.name).toBe('Fabergé');
    expect(matchDesigner('Hermes')?.name).toBe('Hermès');
  });

  it('tolerates & vs and', () => {
    expect(matchDesigner('Van Cleef and Arpels')?.name).toBe('Van Cleef & Arpels');
    expect(matchDesigner('Tiffany and Co.')?.name).toBe('Tiffany & Co.');
  });

  it('tolerates short aliases used on the supplier feed', () => {
    expect(matchDesigner('Lalaounis')?.name).toBe('Ilias Lalaounis');
    expect(matchDesigner('Aspery')?.name).toBe('Asprey');
    expect(matchDesigner('Bulgari')?.name).toBe('Bvlgari');
  });

  it('returns null for brands outside the curated list', () => {
    expect(matchDesigner('Rolex')).toBeNull();
    expect(matchDesigner('Some Random Estate Brand')).toBeNull();
    expect(matchDesigner(undefined)).toBeNull();
    expect(matchDesigner(null)).toBeNull();
  });

  it('has 40 curated designers with unique handles', () => {
    // SHOPIFY_SETUP.md §2c says "38 brands" but the actual table has 40 rows.
    expect(TOP_DESIGNERS).toHaveLength(40);
    expect(new Set(TOP_DESIGNERS.map((d) => d.handle)).size).toBe(40);
  });
});
