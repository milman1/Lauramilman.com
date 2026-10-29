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

const FEATURED = [
  'copy-of-band-gold-ring-sizable',
  'lmny-paperclip-2-5-mm-pclip060-bracelet',
  'lmny-herringbone-2-8-mm-sf030',
  'yellow-gold-bowtie-huggie-earrings-1',
];

const LAB = [
  'lab-grown-round-solitaire-pendant-prong-not-applicable',
  'lab-grown-oval-studs-earring-prong-north-south',
  'lab-grown-emerald-diamond-huggie-earrings-041-ct-14k-yellow-gold-er17790',
  'lab-grown-pear-diamond-drop-earrings-056-ct-14k-two-tone-er10454',
  'lab-grown-marquise-diamond-stud-earrings-067-ct-14k-white-gold-er18519',
  'lab-grown-round-diamond-tennis-bracelet-054-ct-14k-white-gold-bc4494a',
  'lab-grown-round-eternity-band-eternity-band-prong-not-applicable',
];

describe('homepage gold row and lab-grown carousel', () => {
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
    expect(gold.settings?.title).toBe('The gold you reach for,');
    expect(gold.settings?.title_emphasis).toBe('rings, chains, and bands.');
    expect(gold.settings?.more_row).toBe(true);
    expect(gold.settings?.all_url).toBe('/collections/gold-jewelry');
    expect(products.slice(0, 4)).toEqual(FEATURED);
    expect(products).toHaveLength(8);
    expect(new Set(products).size).toBe(products.length);

    expect(liquid).toContain('assign feature_cap = 4');
    expect(liquid).toContain('data-lmh-row-scroll');
    expect(css).toContain('.lmh-row__extra-track');

    const publicCopy = `${liquid}\n${JSON.stringify(gold)}`;
    expect(publicCopy.toLowerCase()).not.toContain('royal chain');
    expect(publicCopy.toLowerCase()).not.toContain('midas');
    expect(publicCopy.toLowerCase()).not.toContain('back vault');
  });

  it('scrolls a longer lab-grown row and keeps the under-$1,000 claim', () => {
    const home = themeJson('templates/index.json');
    const lab = home.sections['lab-grown'];
    const products = (lab.block_order || []).map((id) => lab.blocks?.[id]?.settings?.product);

    expect(lab.type).toBe('lmh-product-row');
    expect(lab.settings?.style).toBe('navy');
    expect(lab.settings?.scroll_row).toBe(true);
    expect(lab.settings?.eyebrow).toBe('Lab-Grown Diamonds · Under $1,000');
    expect(products).toEqual(LAB);
    expect(String(lab.settings?.text)).toContain('under $1,000');
    expect(JSON.stringify(lab).toLowerCase()).not.toContain('peaceful');
  });
});
