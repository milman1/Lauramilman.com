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
      'Octagonal',
    ]) {
      expect(order).toContain(shape);
    }
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
