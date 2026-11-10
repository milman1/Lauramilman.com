import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const MODEL_PAGES = [
  'pre-owned-cartier-love',
  'pre-owned-cartier-trinity',
  'pre-owned-cartier-panthere',
  'pre-owned-van-cleef-alhambra',
  'pre-owned-tiffany-schlumberger',
  'pre-owned-rolex-datejust',
  'pre-owned-rolex-submariner',
  'pre-owned-cartier-juste-un-clou',
  'pre-owned-van-cleef-perlee',
  'pre-owned-rolex-gmt-master',
  'pre-owned-rolex-daytona',
];

describe('pre-owned model pages (2026-11-05)', () => {
  const section = read('sections/main-collection.liquid');
  const longform = section.match(/assign longform_handles = '([^']+)'/)?.[1].split(',') ?? [];

  it('shows the guide and FAQ block on every model page', () => {
    for (const handle of MODEL_PAGES) expect(longform).toContain(handle);
  });

  it('leaves loose-stone and watch-hub collections off the guide list', () => {
    for (const excluded of ['lab-grown-diamonds', 'natural-diamonds', 'colored-lab-grown-diamonds', 'rolex-watches', 'time-pieces']) {
      expect(longform).not.toContain(excluded);
    }
  });

  it('links each designer page down to its model pages', () => {
    expect(section).toContain('aria-label="Shop by model"');
    for (const handle of MODEL_PAGES) expect(section).toContain(`${handle}::`);
    for (const parent of ["'cartier'", "'van-cleef-arpels'", "'tiffany'", "'rolex-watches'"]) {
      expect(section).toContain(`when ${parent}`);
    }
  });
});
