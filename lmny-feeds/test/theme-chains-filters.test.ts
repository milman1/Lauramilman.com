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
    expect(bar).toContain("assign jsb_label = 'Chain Style'");
    expect(bar).toContain('Cuban::Cuban||Paperclip::Paperclip||Rope::Rope');

    expect(filters).toMatch(/when 'chains'/);
    expect(filters).toContain("assign jf_style_label = 'Chain Style'");
    expect(filters).toContain("assign jf_show_carat = false");
    expect(filters).toContain("assign jf_show_width = true");
    expect(filters).toContain("assign jf_show_product_type = true");
    expect(filters).toContain('Cuban::Cuban');
    expect(filters).toContain('Herringbone::Herringbone');
    expect(filters).toContain('js-jf-product-type');
    expect(filters).toContain('js-jf-width-btn');
    expect(filters).toContain('{%- if jf_show_carat -%}');

    expect(drawer).toMatch(/'chains'/);
  });

  it('maps chain metafields onto the PDP spec grid and strips a Details list', () => {
    const pdp = themeFile('sections/main-product.liquid');
    expect(pdp).toContain('width:Width');
    expect(pdp).toContain('clasp:Clasp');
    expect(pdp).toContain('finish:Finish');
    expect(pdp).toContain("echo 'Chain Style'");
    expect(pdp).toContain('!/^details$/i.test(title)');
  });
});
