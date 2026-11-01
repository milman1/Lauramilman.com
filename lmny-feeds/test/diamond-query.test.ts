import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  parseDiamondQuery,
  diamondResultSummary,
  queryShapes,
  shapeLabel,
} = require('../../assets/diamond-query.js');

describe('parseDiamondQuery', () => {
  it('sends a round size and shape to the lab-grown filter, about that carat', () => {
    const parsed = parseDiamondQuery('1 ct oval');
    expect(parsed).toMatchObject({
      kind: 'lab',
      shapes: ['Oval'],
      minCarat: 0.9,
      maxCarat: 1.1,
      around: true,
      title: 'Oval diamonds around 1 ct',
    });
    expect(parsed.href).toBe('/collections/lab-grown-diamonds?shape=Oval&min_carat=0.90&max_carat=1.10');
  });

  it('reads 2 carat round the same way', () => {
    const parsed = parseDiamondQuery('2 carat round');
    expect(parsed).toMatchObject({ shapes: ['Round'], minCarat: 1.8, maxCarat: 2.2, kind: 'lab' });
  });

  it('keeps a precise carat in a tight band', () => {
    const parsed = parseDiamondQuery('1.51 ct oval');
    expect(parsed).toMatchObject({ minCarat: 1.46, maxCarat: 1.56, around: false });
    expect(parsed.title).toBe('Oval diamonds, 1.46–1.56 ct');
  });

  it('opens natural diamonds when the query says natural', () => {
    const parsed = parseDiamondQuery('natural 1 ct oval');
    expect(parsed?.kind).toBe('natural');
    expect(parsed?.href.startsWith('/collections/natural-diamonds?')).toBe(true);
  });

  it('ticks color and clarity when they are named', () => {
    const parsed = parseDiamondQuery('1 ct oval F VS1');
    expect(parsed).toMatchObject({ colors: ['F'], clarities: ['VS1'] });
    expect(parsed?.href).toContain('color=F');
    expect(parsed?.href).toContain('clarity=VS1');
    expect(parsed?.detail).toBe('F · VS1');
  });

  it('recognizes a shape written against the carat', () => {
    expect(parseDiamondQuery('1ctoval')?.shapes).toEqual(['Oval']);
  });

  it('recognizes Ashoka and a two-word shape', () => {
    expect(parseDiamondQuery('ashoka 1ct')?.shapes).toEqual(['Ashoka']);
    expect(parseDiamondQuery('2 ct old miner')?.shapes).toEqual(['Old Miner']);
    expect(parseDiamondQuery('half moon 1 ct')?.shapeQuery).toEqual(['Halfmoon', 'Half Moon']);
  });

  it('leaves jewelry, watches, brands, and shapeless text on product search', () => {
    expect(parseDiamondQuery('1 ct oval engagement ring')).toBeNull();
    expect(parseDiamondQuery('oval ring')).toBeNull();
    expect(parseDiamondQuery('Rolex')).toBeNull();
    expect(parseDiamondQuery('Cartier')).toBeNull();
    expect(parseDiamondQuery('1 ct')).toBeNull();
    expect(parseDiamondQuery('oval')).toBeNull();
    expect(parseDiamondQuery('tennis bracelet')).toBeNull();
  });
});

describe('diamondResultSummary', () => {
  it('states the count, origin, shape, and carat band', () => {
    expect(diamondResultSummary({
      total: 214,
      kind: 'lab',
      shapes: ['Oval'],
      minCarat: 0.9,
      maxCarat: 1.1,
    })).toBe('214 lab-grown ovals, 0.90–1.10 ct');
  });

  it('includes color and clarity when those filters are on', () => {
    expect(diamondResultSummary({
      total: 18,
      kind: 'natural',
      shapes: ['Round'],
      minCarat: 1.8,
      maxCarat: 2.2,
      colors: ['F'],
      clarities: ['VS1'],
    })).toBe('18 natural rounds, 1.80–2.20 ct, F VS1');
  });
});

describe('search entry points', () => {
  it('routes the header search and the search results page through the parser', () => {
    const header = readFileSync(new URL('../../sections/header.liquid', import.meta.url), 'utf8');
    const results = readFileSync(new URL('../../sections/main-search.liquid', import.meta.url), 'utf8');
    const filter = readFileSync(new URL('../../sections/diamond-filter.liquid', import.meta.url), 'utf8');
    expect(header).toContain('parseDiamondQuery');
    expect(header).toContain('form.lmhh__msearch');
    expect(results).toContain('parseDiamondQuery');
    expect(filter).toContain('diamond-query.js');
  });
});

describe('queryShapes', () => {
  it('restores the stored spelling for a search link', () => {
    expect(queryShapes(['oval', 'half moon'])).toEqual(['Oval', 'Halfmoon', 'Half Moon']);
    expect(shapeLabel('Halfmoon,Half Moon')).toBe('Half Moon');
  });
});
