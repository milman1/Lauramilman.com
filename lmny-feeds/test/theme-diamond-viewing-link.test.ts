import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const page = themeFile('sections/main-product-diamond.liquid');
const form = themeFile('sections/private-client.liquid');

describe('private viewing link on loose diamond pages', () => {
  it('sits between the buy buttons and the cart link, only while the stone is for sale', () => {
    const at = page.indexOf('class="dpdp__viewing"');
    expect(at).toBeGreaterThan(page.indexOf("{%- endform -%}"));
    expect(at).toBeLessThan(page.indexOf('data-diamond-view-cart'));
    expect(page.slice(page.lastIndexOf('{%- if v.available -%}', at), at)).not.toContain('endif');
  });

  it('opens the viewing form with diamond sourcing selected and this stone filled in', () => {
    expect(page).toContain('href="/pages/private-clients?interest=diamond&amp;piece={{ viewing_piece | url_encode }}"');
    expect(page).toContain("assign viewing_piece = product.title | append: ' ' | append: shop.url | append: product.url");
    expect(form).toContain("if (interest === 'diamond') interestSelect.value = 'Diamond or gemstone sourcing';");
    expect(form).toContain("var piece = params.get('piece')");
  });

  it('makes no delivery promise', () => {
    const line = page.slice(page.indexOf('class="dpdp__viewing"'), page.indexOf('data-diamond-view-cart'));
    expect(line).toContain('Book a private Midtown viewing');
    expect(line).not.toMatch(/deliver|business day|ships/i);
  });
});
