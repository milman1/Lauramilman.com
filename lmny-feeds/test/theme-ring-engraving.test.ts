import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('ring engraving on the product page', () => {
  const snippet = themeFile('snippets/ring-engraving.liquid');
  const mainProduct = themeFile('sections/main-product.liquid');
  const themeJs = themeFile('assets/theme.js');

  it('renders below the buy area and diamond panel, tied to the product form', () => {
    expect(mainProduct).toContain("{% render 'ring-engraving',");
    expect(mainProduct).toContain('form_id: product_form_id,');
    expect(mainProduct).toContain('enabled: section.settings.engraving_enabled');
    expect(mainProduct).toContain('ai_endpoint: section.settings.engraving_ai_endpoint');
    expect(mainProduct).toContain('"id": "engraving_enabled"');
    expect(mainProduct).toContain('"id": "engraving_ai_endpoint"');
    const form = mainProduct.slice(mainProduct.indexOf("{%- form 'product'"), mainProduct.indexOf('{%- endform -%}'));
    expect(form).not.toContain("{% render 'ring-engraving',");
    const after = mainProduct.slice(mainProduct.indexOf("{% render 'ring-diamond-pairing'"));
    expect(after.indexOf("{% render 'ring-engraving',")).toBeGreaterThan(0);
    expect(after.indexOf("{% render 'ring-engraving',")).toBeLessThan(after.indexOf("{% render 'product-inquiry'"));
    expect(snippet).toContain('<input type="hidden" form="{{ form_id }}" name="properties[Engraving]"');
    expect(snippet).toContain("document.getElementById(root.getAttribute('data-form-id'))");
  });

  it('shows only on engagement rings, never watches or estate feed pieces', () => {
    const isRing = themeFile('snippets/is-engagement-ring.liquid');
    expect(snippet).toContain("{% render 'is-engagement-ring', product: product %}");
    expect(snippet).toContain("if enabled and is_watch != 'true' and is_er == 'true'");
    expect(isRing).toContain("unless product.tags contains 'backvault-feed'");
    expect(isRing).toContain("c.handle == 'engagement-rings' or c.handle == 'lab-grown-engagement-rings'");
    expect(isRing).toContain("product.tags contains 'Engagement Rings'");
  });

  it('is complimentary and only submits an inscription the shopper chose', () => {
    expect(snippet).toContain('name="properties[Engraving]" value="" disabled');
    expect(snippet).toContain('name="properties[Engraving font]" value="" disabled');
    expect(snippet).toContain('<span class="pdp-engrave__price">Complimentary</span>');
    expect(snippet).not.toContain('addon');
    // Visible fields are detached from the product form.
    expect(snippet).toContain('form="lm-engrave-none" data-engrave-toggle');
    expect(snippet).toMatch(/id="PdpEngraveText"[\s\S]*?form="lm-engrave-none"/);
  });

  it('states final sale and that the AI image is only a visualization', () => {
    expect(snippet).toContain('final sale');
    expect(snippet).toContain('/pages/shipping-returns');
    expect(snippet).toContain('AI visualization. Your ring is engraved by hand with exactly the text you typed above.');
  });

  it('hides the AI button until an https endpoint is configured', () => {
    expect(snippet).toContain("unless endpoint contains 'https://'");
    expect(snippet).toMatch(/\{%- if endpoint != '' -%\}\s*<div class="pdp-engrave__ai">/);
  });

  it('sends the engraving as line-item properties on the ring', () => {
    expect(themeJs).toContain('function formLineProperties(form)');
    expect(themeJs).toContain('if (properties && Object.keys(properties).length) line.properties = properties;');
    expect(themeJs).toContain('addVariantToCart(variantId, quantity, formLineProperties(form))');
    expect(themeJs).not.toContain('data-addon-variant');
  });
});
