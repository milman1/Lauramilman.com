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
  });

  it('links a ring to loose diamonds of its shape through the native filter', () => {
    expect(mainProduct).toContain("{% render 'ring-diamond-pairing', product: product, is_watch: is_watch, setting_product: section.settings.setting_only_product %}");
    expect(ringSide).toContain('/collections/natural-diamonds?filter.p.m.custom.diamond_shape={{ shape_q }}');
    expect(ringSide).toContain('/collections/lab-grown-diamonds?filter.p.m.custom.diamond_shape={{ shape_q }}');
    expect(ringSide).toContain("{%- if is_er == 'true' and ring_shape != '' and is_watch != 'true' -%}");
  });

  it('only pairs an available loose diamond of the same shape', () => {
    expect(ringSide).toContain("var DIAMOND_TYPES = ['Natural Diamond', 'Lab-Grown Diamond'];");
    expect(ringSide).toContain('if (stoneShape !== ringShape)');
    expect(ringSide).toContain('if (!p.available)');
    expect(ringSide).toContain('var HANDLE = /^[a-z0-9][a-z0-9-]{0,99}$/;');
    expect(ringSide).toContain('data-chat-intent="pair"');
  });

  it('sells setting + diamond only when a setting-only price exists, labor included', () => {
    expect(mainProduct).toContain('setting_product: section.settings.setting_only_product');
    expect(mainProduct).toContain('"id": "setting_only_product"');
    expect(ringSide).toContain("assign sku_base = 'SET-' | append: product.handle | downcase");
    expect(ringSide).toContain('assign v_match = v.available');
    expect(ringSide).toContain('<span>Setting your diamond</span><span>Included</span>');
    expect(ringSide).toContain('var canBuy = !!(setting && stone.variants && stone.variants[0]);');
    expect(ringSide).toContain("{ id: setting.id, quantity: 1, properties: props }");
    expect(ringSide).toContain("{ id: stone.variants[0].id, quantity: 1, properties: { 'Set in': ringTitle } }");
    // Without a setting price the pairing stays a quote.
    expect(ringSide).toContain('The ring price above includes our own center stone.');
    expect(ringSide).toContain('.pdp-pair [hidden] { display: none !important; }');
  });

  it('sells a setting product (tag ring-setting) as itself with the chosen diamond', () => {
    const isRing = themeFile('snippets/is-engagement-ring.liquid');
    expect(isRing).toContain("product.tags contains 'ring-setting'");
    expect(ringSide).toContain("if product.tags contains 'ring-setting'");
    expect(ringSide).toContain('echo \',"self":true,"price":\'');
    expect(ringSide).toContain('if (settings.length && settings[0].self)');
    expect(ringSide).toContain('This setting is sold without a center stone.');
  });

  it('lists settings before finished rings on diamond pages', () => {
    expect(diamondSide).toContain("assign setting_collection = collections['ring-settings']");
    expect(diamondSide).toContain('{%- if pass == 1 -%}{%- assign source = setting_collection -%}');
    expect(diamondSide).toContain('Choose a setting and we will set this diamond in it, labor included.');
  });

  it('names both pieces in the concierge chat', () => {
    expect(themeJs).toContain("if (intent === 'pair' && payload.pairTitle)");
    expect(themeJs).toContain("pairTitle: btn.getAttribute('data-pair-title') || ''");
    expect(themeJs).toContain("if (intent === 'pair') return 'Pairing request';");
  });
});
