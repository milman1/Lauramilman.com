import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('engagement ring ↔ loose diamond pairing', () => {
  const shape = themeFile('snippets/center-stone-shape.liquid');
  const ringSide = themeFile('snippets/ring-diamond-pairing.liquid');
  const diamondSide = themeFile('sections/diamond-ring-match.liquid');
  const mainProduct = themeFile('sections/main-product.liquid');
  const diamondTemplate = JSON.parse(themeFile('templates/product.diamond.json'));
  const themeJs = themeFile('assets/theme.js');

  it('matches on the ten filter shapes, from the metafield first, never from the title', () => {
    expect(shape).toContain("'Round,Princess,Cushion,Emerald,Oval,Radiant,Asscher,Marquise,Heart,Pear' | split: ','");
    expect(shape).toContain('product.metafields.custom.diamond_shape.value');
    expect(shape).toContain("assign t = tag | downcase | remove: ' cut' | strip");
    expect(shape).not.toContain('product.title');
  });

  it('puts rings for this shape on every loose-diamond page, without ring prices', () => {
    expect(diamondTemplate.order).toEqual(['main', 'ring-match', 'recommendations']);
    expect(diamondTemplate.sections['ring-match'].type).toBe('diamond-ring-match');
    expect(diamondSide).toContain("{% render 'center-stone-shape', product: ring %}");
    expect(diamondSide).toContain('{%- if ring_shape == stone_shape -%}');
    expect(diamondSide).toContain('{{ ring.url }}?diamond={{ product.handle | url_encode }}');
    expect(diamondSide).not.toContain('ring.price');
    expect(diamondSide).toContain('Rings are pictured with our own center stones.');
  });

  it('links a ring to loose diamonds of its shape through the native filter', () => {
    expect(mainProduct).toContain("{% render 'ring-diamond-pairing', product: product, is_watch: is_watch %}");
    expect(ringSide).toContain('/collections/natural-diamonds?filter.p.m.custom.diamond_shape={{ shape_q }}');
    expect(ringSide).toContain('/collections/lab-grown-diamonds?filter.p.m.custom.diamond_shape={{ shape_q }}');
    expect(ringSide).toContain("{%- if is_er == 'true' and ring_shape != '' and is_watch != 'true' -%}");
  });

  it('only pairs an available loose diamond of the same shape, and quotes rather than adds to cart', () => {
    expect(ringSide).toContain("var DIAMOND_TYPES = ['Natural Diamond', 'Lab-Grown Diamond'];");
    expect(ringSide).toContain('if (stoneShape !== ringShape)');
    expect(ringSide).toContain('if (!p.available)');
    expect(ringSide).toContain('var HANDLE = /^[a-z0-9][a-z0-9-]{0,99}$/;');
    expect(ringSide).toContain('data-chat-intent="pair"');
    expect(ringSide).toContain('The ring price above includes our own center stone.');
    expect(ringSide).not.toContain('/cart/add');
  });

  it('names both pieces in the concierge chat', () => {
    expect(themeJs).toContain("if (intent === 'pair' && payload.pairTitle)");
    expect(themeJs).toContain("pairTitle: btn.getAttribute('data-pair-title') || ''");
    expect(themeJs).toContain("if (intent === 'pair') return 'Pairing request';");
  });
});
