import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('loose diamond shape filter', () => {
  const order = themeFile('snippets/diamond-shape-order.liquid');
  const form = themeFile('snippets/diamond-api-filter-form.liquid');
  const filter = themeFile('sections/diamond-filter.liquid');
  const builder = themeFile('sections/ring-builder-flow.liquid');

  it('offers Ashoka and the other stocked shapes beyond the original ten', () => {
    for (const shape of [
      'Ashoka',
      'Old Miner',
      'Portuguese',
      'Moval',
      'Dutch Marquise',
      'Dutch Marquise Step',
      'Half Moon|Halfmoon,Half Moon',
      'Criss Cut',
      'Trilliant',
      'Triangle',
      'Shield',
      'Cadillac',
      'Bullet',
      'Butterfly',
      'Hexagonal',
      'Kite',
      'Lozenge',
      'Trapezoid',
      'Pentagonal',
      'European Cut|Europeancut,European Cut',
      'Old European',
      'Cushion Brilliant',
      'Oval Step',
      'Pear Step',
      'Horse Head',
      'Capsule',
      'Octagonal|Octagonal,Octagonal Step Cut',
      'Oldmine Moval|Oldmine Moval,Old Moval',
      'Tycoon|Tycoon,Tycoon Cut',
      'Round Star',
      'Oldmine Asscher',
      'Square Cushion Stepcut',
    ]) {
      expect(order).toContain(shape);
    }
  });

  it('uses that list on the homepage, the menu, and the ring builder', () => {
    for (const path of ['sections/lmh-stones.liquid', 'sections/header.liquid']) {
      expect(themeFile(path)).toContain("render 'diamond-shape-order'");
    }
    const flow = themeFile('assets/ring-builder-flow.js');
    expect(flow).toContain('.lm-shape__name');
    expect(flow).not.toContain("const shapes = ['Round', 'Oval'");
    const home = themeFile('templates/index.json');
    expect(home).toContain('Where would you like to begin?');
    expect(home).toContain('"show_diamond_path": true');
    expect(home).not.toContain('"title": "Build your ring"');
  });

  it('keeps the homepage short: ten shapes, the rest folded, one shape picker', () => {
    const stones = themeFile('sections/lmh-stones.liquid');
    expect(stones).toContain('for entry in shape_list limit: 10');
    expect(stones).toContain('for entry in shape_list offset: 10');
    expect(stones).toContain('More shapes (');
    const start = themeFile('sections/ring-builder-start.liquid');
    expect(start).not.toContain('data-rbs-shape');
    expect(start).not.toContain('Which shape?');
    // One setting photo, and a link into the builder's own setting list.
    expect(start).toContain('ring_shape_key == photo_shape');
    expect(themeFile('templates/index.json')).not.toContain('"card_limit"');
    expect(themeFile('templates/index.json')).toContain('"more_url": "/pages/ring-builder?start=setting"');
    // The jump target is an id the section sets itself; Shopify's wrapper id carries the template id.
    expect(stones).toContain('id="start-with-the-stone"');
    expect(themeFile('templates/index.json')).toContain('"shapes_anchor": "#start-with-the-stone"');
  });

  it('sends every stored spelling for a shape that has more than one', () => {
    const shape = themeFile('snippets/diamond-api-shape.liquid');
    expect(form).toContain("render 'diamond-api-shape', entry: entry");
    expect(shape).toContain("split: '|'");
    expect(shape).toContain('value="{{ shape_value | escape }}"');
  });

  it('folds the diamond search to the ten classic shapes, the rest under More shapes', () => {
    expect(form).toContain('if fold_shapes and shape_order.size > 10');
    expect(form).toContain('for entry in shape_order limit: shown_shapes');
    expect(form).toContain('for entry in shape_order offset: shown_shapes');
    expect(form).toContain('<details class="lm-dfilter__more-shapes">');
    // Only the diamond search folds; the ring builder folds its own list by setting count.
    expect(filter).toContain('fold_shapes: true');
    expect(builder).not.toContain('fold_shapes');
    // A shape in the link that is folded away opens the list so the choice is visible.
    expect(themeFile('assets/diamond-storefront.js')).toContain("moreShapes.querySelector('.lm-shape input:checked')) moreShapes.open = true");
  });

  it('uses the same list on the collection filter and the ring builder', () => {
    expect(filter).toContain("render 'diamond-shape-order'");
    expect(builder).toContain("render 'diamond-shape-order'");
  });
});
