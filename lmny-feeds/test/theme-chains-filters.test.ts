import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Chains collection filters', () => {
  it('puts chain styles on the collection chips, the Refine drawer, and the gold menu', () => {
    const bar = themeFile('snippets/jewelry-style-bar.liquid');
    const filters = themeFile('snippets/jewelry-style-filters.liquid');
    const drawer = themeFile('snippets/filter-drawer.liquid');
    const header = themeFile('sections/header.liquid');

    expect(bar).toMatch(/when 'chains'/);
    expect(bar).toContain("assign jsb_label = 'Chain Style'");
    expect(bar).toContain('Cuban::Cuban||Paperclip::Paperclip||Rope::Rope');
    expect(bar).toContain('Herringbone::Herringbone||Box::Box||Snake::Snake');

    expect(filters).toMatch(/when 'chains'/);
    expect(filters).toContain("assign jf_style_label = 'Chain Style'");
    expect(filters).toContain("assign jf_show_carat = false");
    expect(filters).toContain('Cuban::Cuban');
    expect(filters).toContain('{%- if jf_show_carat -%}');

    expect(drawer).toMatch(/'chains'/);

    expect(header).toContain('Chains by style');
    expect(header).toContain('href="/collections/chains?type=Cuban"');
    expect(header).toContain('href="/collections/chains?type=Paperclip"');
    expect(header).toContain('href="/collections/chains?type=Rope"');
    expect(header).toContain('href="/collections/chains?type=Herringbone"');
    expect(header).toContain('href="/collections/chains?type=Curb"');
    expect(header).not.toContain('>Snake<');
  });
});
