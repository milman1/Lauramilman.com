import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../sections/main-collection.liquid', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('    function normalize('), source.indexOf('    function updateEverydayOptions('));
const { everydayMatches: matches, everydayCardMatches: cardMatches } = runInNewContext(`${helpers}; ({ everydayMatches, everydayCardMatches })`, {
  everydayDimensions: ['type', 'style', 'metal', 'purity', 'gemstone'],
});
const topaz = { type: 'bracelets', title: 'London Blue Topaz Curb Bracelet in Yellow Gold', metalOptions: '14K Yellow Gold|||10K Yellow Gold' };
const chevron = { type: 'rings', title: 'Chevron Wire Ring', metalOptions: '14K Yellow Gold|||14K White Gold|||14K Rose Gold|||Sterling Silver' };
const selection = (overrides = {}) => ({ type: [], style: [], metal: [], purity: [], gemstone: [], ...overrides });

describe('Everyday Jewelry filter behavior', () => {
  it('includes alternate metals and purity from options absent from the main title', () => {
    expect(matches(chevron, 'metal', 'White Gold')).toBe(true);
    expect(matches(chevron, 'metal', 'Silver')).toBe(true);
    expect(matches(topaz, 'purity', '10K')).toBe(true);
    expect(matches(topaz, 'purity', '18K')).toBe(false);
  });
  it('does not classify earrings as rings or diamonds as an arbitrary gemstone', () => {
    expect(matches({ type: 'earrings', title: 'Diamond Earrings' }, 'type', 'Rings')).toBe(false);
    expect(matches(topaz, 'gemstone', 'Topaz')).toBe(true);
    expect(matches(topaz, 'gemstone', 'Diamond')).toBe(false);
  });
  it('supports legacy chain metal names and the two spellings of paperclip', () => {
    expect(matches({ metalOptions: '14K Rose - 18 in' }, 'metal', 'Rose Gold')).toBe(true);
    expect(matches({ title: 'Sapphire Half Paper Clip and Half Tennis Bracelet' }, 'style', 'Paperclip')).toBe(true);
  });
  it('uses OR within one filter and AND between filters', () => {
    expect(cardMatches({ dataset: topaz }, selection({ type: ['Rings', 'Bracelets'], gemstone: ['Topaz'] }))).toBe(true);
    expect(cardMatches({ dataset: chevron }, selection({ type: ['Rings', 'Bracelets'], gemstone: ['Topaz'] }))).toBe(false);
    expect(cardMatches({ dataset: chevron }, selection({ type: ['Rings'], metal: ['White Gold'] }))).toBe(true);
  });
  it('counts alternative values without applying their own group restriction', () => {
    expect(cardMatches({ dataset: topaz }, selection({ type: ['Rings'], metal: ['Yellow Gold'] }), 'type')).toBe(true);
  });
});
