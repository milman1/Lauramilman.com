import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Chains collection filters', () => {
  it('uses product-type chips and chain styles, not carat or necklace styles', () => {
    const bar = themeFile('snippets/jewelry-style-bar.liquid');
    const filters = themeFile('snippets/jewelry-style-filters.liquid');
    const drawer = themeFile('snippets/filter-drawer.liquid');

    expect(bar).toMatch(/when 'chains'/);
    expect(bar).toContain("assign jsb_label = 'Product Type'");
    expect(bar).toContain('Necklaces::Necklaces||Bracelets::Bracelets');

    expect(filters).toMatch(/when 'chains'/);
    expect(filters).toContain("assign jf_style_label = 'Chain Style'");
    expect(filters).toContain("assign jf_show_carat = false");
    expect(filters).toContain('Cuban::Cuban');
    expect(filters).toContain('Herringbone::Herringbone');
    expect(filters).toContain('{%- if jf_show_carat -%}');

    expect(drawer).toMatch(/'chains'/);
  });
});
