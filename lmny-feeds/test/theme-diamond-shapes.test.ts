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
    for (const path of ['sections/lmh-stones.liquid', 'sections/ring-builder-start.liquid', 'sections/header.liquid']) {
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

  it('sends every stored spelling for a shape that has more than one', () => {
    expect(form).toContain("split: '|'");
    expect(form).toContain('shape_value');
  });

  it('uses the same list on the collection filter and the ring builder', () => {
    expect(filter).toContain("render 'diamond-shape-order'");
    expect(builder).toContain("render 'diamond-shape-order'");
  });
});
