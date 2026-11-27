import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const page = themeFile('sections/main-product-diamond.liquid');
const service = themeFile('snippets/diamond-service-details.liquid');
const form = themeFile('sections/private-client.liquid');

// The tiles and "Meet Laura" box were built in the Shopify theme editor on
// 2026-11-26 (snippets/diamond-service-details.liquid). These tests protect
// their facts and links, not their design.
describe('delivery tiles and private viewing on loose diamond pages', () => {
  it('sit between the buy buttons and the cart link, only while the stone is for sale', () => {
    const at = page.indexOf("render 'diamond-service-details'");
    expect(at).toBeGreaterThan(page.indexOf('{%- endform -%}'));
    expect(at).toBeLessThan(page.indexOf('data-diamond-view-cart'));
    expect(page.slice(page.lastIndexOf('{%- if v.available -%}', at), at)).not.toContain('endif');
  });

  it('state the merchant lead times', () => {
    expect(service).toContain('<span class="dpdp-service__value">1–2 days</span>');
    expect(service).toContain('<span class="dpdp-service__label">Free delivery</span>');
    expect(service).toContain('<span class="dpdp-service__value">+1–2 days</span>');
    expect(service).toContain('A ring built for you takes about a week.');
    expect(service).toContain('Free insured U.S. delivery.');
  });

  it('open the viewing form with diamond sourcing selected and this stone filled in', () => {
    expect(service).toContain('href="/pages/private-clients?interest=diamond&amp;piece={{ viewing_piece | url_encode }}"');
    expect(service).toContain("assign viewing_piece = product.title | append: ' ' | append: shop.url | append: product.url");
    expect(service).toContain('href="#MeetLaura-{{ section.id }}"');
    expect(service).toContain('id="MeetLaura-{{ section.id }}"');
    expect(form).toContain("if (interest === 'diamond') interestSelect.value = 'Diamond or gemstone sourcing';");
    expect(form).toContain("var piece = params.get('piece')");
  });
});
