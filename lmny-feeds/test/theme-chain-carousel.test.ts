import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function themeJson(path: string): { sections: Record<string, { type?: string; settings?: Record<string, unknown>; block_order?: string[]; blocks?: Record<string, { settings?: Record<string, string> }> }>; order: string[] } {
  const text = themeFile(path).replace(/\/\*[\s\S]*?\*\//g, '');
  return JSON.parse(text);
}

const BANDS = [
  'polished-chevron-band',
  'diamond-chevron-band',
  'diamond-chevron-polished-band-in-14k-yellow-gold',
  'diamond-chevron-ring-in-14k-yellow-gold',
  'chevron-wire-ring',
  'double-chevron-wire-ring-in-14k-yellow-gold',
];

describe('homepage chain carousel', () => {
  it('lists every house chain and the stacking bands in one carousel', () => {
    const home = themeJson('templates/index.json');
    const section = home.sections['chains-carousel'];
    const liquid = themeFile('sections/lmh-catalog-carousel.liquid');
    const css = themeFile('assets/lmny-home.css');

    expect(section.type).toBe('lmh-catalog-carousel');
    expect(home.order.indexOf('chains-carousel')).toBeGreaterThan(home.order.indexOf('gold'));
    expect(home.order.indexOf('chains-carousel')).toBeLessThan(home.order.indexOf('lab-grown'));
    expect(section.settings?.collection).toBe('chains');
    expect(section.settings?.title).toBe('Chains and bands,');
    expect(section.settings?.link_url).toBe('/collections/chains');
    expect(section.block_order).toHaveLength(BANDS.length);
    const picked = (section.block_order || []).map((id) => section.blocks?.[id]?.settings?.product);
    expect(picked).toEqual(BANDS);

    expect(liquid).toContain('section.settings.collection.products');
    expect(liquid).toContain('section.settings.collection_2.products');
    expect(liquid).not.toContain('collection_limit');
    expect(liquid).toContain('data-lmh-carousel');
    expect(liquid).toContain("render 'lmh-card'");
    expect(css).toContain('.lmh-carousel { background: var(--lmh-sand);');

    const publicCopy = `${liquid}\n${JSON.stringify(section)}`;
    expect(publicCopy.toLowerCase()).not.toContain('royal chain');
    expect(publicCopy.toLowerCase()).not.toContain('midas');
    expect(publicCopy.toLowerCase()).not.toContain('back vault');
  });
});
