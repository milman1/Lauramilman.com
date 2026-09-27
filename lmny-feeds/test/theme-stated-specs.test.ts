import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('product specification layout', () => {
  it('fills the same spec grid for every jewelry product, and leaves watches on their own keys', () => {
    const product = themeFile('sections/main-product.liquid');
    const stated = themeFile('snippets/product-stated-specs.liquid');

    expect(product).toContain("render 'product-stated-specs', product: product");
    expect(product).toContain("if is_watch != 'true'");
    expect(product).not.toContain('spec_rows == blank and is_watch');
    expect(product).toContain('<!--FACTS:');
    expect(product).toContain("when 'diamond_shape'");
    expect(product).toContain("when 'carat_weight'");
    expect(product).toContain("when 'metal'");
    expect(product).toContain("when 'clarity'");
    expect(product).toContain("when 'color'");
    expect(product).toContain("when 'setting_style'");
    expect(product).toContain("when 'length'");
    expect(product).toContain('<p>{{ stated_prose }}</p>');
    expect(product).toContain('prose_parts.size > 1');
    expect(product).toContain("stated_prose contains 'shape='");
    expect(product).toContain("stated_prose contains '|'");

    expect(stated).toContain('<!--FACTS:shape=');
    const pair = stated.indexOf("assign shape = 'Marquise and Pear'");
    const single = stated.indexOf("assign shape = 'Marquise'\n");
    expect(pair).toBeGreaterThan(-1);
    expect(single).toBeGreaterThan(pair);
    expect(stated).toContain('ct tdw');
    expect(stated).toContain('plain_size < 160');
    expect(stated).toContain('Offered by Laura Milman New York.');
    expect(stated).not.toContain("default: 'gold'");
    expect(stated).toContain('14K Two-Tone Gold');
    expect(stated).toContain("' round diamond '");
    expect(stated).not.toContain("shape_source contains ' round '");
  });
});
