import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function themeJson(path: string): {
  sections: Record<string, { type?: string; settings?: Record<string, unknown>; block_order?: string[]; blocks?: Record<string, { type?: string; settings?: Record<string, string> }> }>;
  order: string[];
} {
  const text = themeFile(path).replace(/\/\*[\s\S]*?\*\//g, '');
  return JSON.parse(text);
}

const LAB = [
  "lab-grown-oval-studs-earring-prong-north-south",
  "lab-grown-round-solitaire-pendant-prong-not-applicable",
  "lab-grown-round-diamond-tennis-bracelet-054-ct-14k-white-gold-bc4494a",
  "lab-grown-round-eternity-band-eternity-band-prong-not-applicable"
];

describe('homepage gold and lab-grown rows', () => {
  it('keeps four pieces beside the photo and scrolls the rest underneath', () => {
    const home = themeJson('templates/index.json');
    const gold = home.sections.gold;
    const liquid = themeFile('sections/lmh-product-row.liquid');
    const css = themeFile('assets/lmny-home.css');
    const products = (gold.block_order || [])
      .map((id) => gold.blocks?.[id])
      .filter((block) => block?.type === 'product')
      .map((block) => block?.settings?.product);

    expect(gold.type).toBe('lmh-product-row');
    expect(gold.settings?.more_row).toBe(true);
    expect(gold.settings?.all_url).toBe('/collections/everyday-jewelry');
    expect(products).toHaveLength(16);
    expect(new Set(products).size).toBe(products.length);

    expect(liquid).toContain('assign feature_cap = 4');
    expect(liquid).toContain('data-lmh-row-scroll');
    expect(css).toContain('.lmh-row__extra-track');

    const publicCopy = `${liquid}\n${JSON.stringify(gold)}`;
    expect(publicCopy.toLowerCase()).not.toContain('royal chain');
    expect(publicCopy.toLowerCase()).not.toContain('midas');
    expect(publicCopy.toLowerCase()).not.toContain('back vault');
  });

  it('shows four lab-grown categories with an accurate starting-price claim', () => {
    const home = themeJson('templates/index.json');
    const lab = home.sections['lab-grown'];
    const products = (lab.block_order || []).map((id) => lab.blocks?.[id]?.settings?.product);

    expect(lab.type).toBe('lmh-product-row');
    expect(lab.settings?.style).toBe('navy');
    expect(lab.settings?.scroll_row).toBe(false);
    expect(lab.settings?.eyebrow).toBe('LAB-GROWN JEWELRY');
    expect(lab.settings?.button_2_text).toBe('');
    expect(products).toEqual(LAB);
    expect(String(lab.settings?.text)).toContain('under $1,000');
    expect(JSON.stringify(lab).toLowerCase()).not.toContain('peaceful');
  });
});
