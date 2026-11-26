import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const page = themeFile('sections/main-product-diamond.liquid');
const form = themeFile('sections/private-client.liquid');

describe('private viewing link on loose diamond pages', () => {
  it('sits between the buy buttons and the cart link, only while the stone is for sale', () => {
    const at = page.indexOf('class="dpdp__perk dpdp__viewing"');
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

  it('shows lead times and the viewing as three short tiles, full wording kept for screen readers', () => {
    const tiles = page.slice(page.indexOf('<ul class="dpdp__perks"'), page.indexOf('dpdp__perks-note'));
    expect(tiles.match(/<li class="dpdp__perk /g)).toHaveLength(3);
    expect(tiles).toContain('aria-label="Free insured U.S. delivery in about 1–2 business days"');
    expect(tiles).toContain('aria-label="Set in a ring in 1–2 business days, or about a week when we build the ring for you"');
    expect(tiles).toContain('<span class="dpdp__perk-value">1–2 days</span>');
    expect(tiles).toContain('<span class="dpdp__perk-label">Midtown viewing →</span>');
    expect(tiles.indexOf('dpdp__delivery')).toBeLessThan(tiles.indexOf('dpdp__viewing'));
    expect(page).toContain('<p class="dpdp__perks-note">U.S. delivery, insured. A ring built for you takes about a week.</p>');
  });
});
