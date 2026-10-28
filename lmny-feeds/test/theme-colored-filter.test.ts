import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { filterStones } = createRequire(import.meta.url)('../../assets/colored-diamond-filter.js');

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('colored lab-grown diamond filter', () => {
  it('keeps the colored tab on natural, lab-grown, and colored search', () => {
    const tabs = themeFile('snippets/diamond-origin-tabs.liquid');
    const filter = themeFile('sections/diamond-filter.liquid');
    const colored = themeFile('sections/colored-diamond-filter.liquid');

    expect(tabs).toContain('href="/collections/natural-diamonds"');
    expect(tabs).toContain('href="/collections/lab-grown-diamonds"');
    expect(tabs).toContain('href="/collections/colored-lab-grown-diamonds"');
    expect(tabs).toContain('Colored lab-grown');
    expect(filter.match(/render 'diamond-origin-tabs'/g)).toHaveLength(2);
    expect(colored).toContain("render 'diamond-origin-tabs', current: 'colored'");
  });

  it('uses the same range and grade controls as the other loose-diamond filters', () => {
    const colored = themeFile('sections/colored-diamond-filter.liquid');
    expect(colored).toContain("render 'diamond-api-scale', name: 'color'");
    expect(colored).toContain("render 'diamond-api-scale', name: 'intensity'");
    expect(colored).toContain("render 'diamond-api-scale', name: 'clarity'");
    expect(colored).toContain('data-range-key="carat"');
    expect(colored).toContain('data-range-key="price"');
    expect(colored).toContain('class="lm-range__track"');
    expect(colored).not.toContain('lm-colored-chips');
  });

  it('offers the shared shape list, with extra shapes shown only when colored stones carry them', () => {
    const colored = themeFile('sections/colored-diamond-filter.liquid');
    const script = themeFile('assets/colored-diamond-filter.js');
    expect(colored).toContain("render 'diamond-shape-order'");
    expect(colored).toContain('Baguette,Trillion');
    expect(colored).toContain('data-extra-shape hidden');
    expect(colored).toContain('data-shape-match=');
    expect(script).toContain('[data-extra-shape]');
    expect(themeFile('assets/colored-diamond-filter.css')).toContain('.lm-shape[hidden]');
  });

  it('matches every stored spelling behind a shape button', () => {
    const stone = (id: string, shape: string) => ({ id, shape, image: 'i', video: 'v', certificate: 'c', tags: ['colored-stone-feed', 'Pink'], carat: 1, price: 500 });
    const stones = [stone('a', 'Kite'), stone('b', 'Kite Step Cut'), stone('c', 'Oval')];
    const filters: Record<string, unknown> = { shape: ['Kite'], color: [], intensity: [], clarity: [] };
    Object.defineProperty(filters, 'shapeMatch', { value: ['Kite', 'Kite Step Cut', 'Kite Step'], enumerable: false });
    expect(filterStones(stones, filters, 'price-asc').map((s: { id: string }) => s.id)).toEqual(['a', 'b']);
    expect(filterStones(stones, { shape: ['Oval'], color: [], intensity: [], clarity: [] }, 'price-asc').map((s: { id: string }) => s.id)).toEqual(['c']);
  });
});
