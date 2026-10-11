import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
});
