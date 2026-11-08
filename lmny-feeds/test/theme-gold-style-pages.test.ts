import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const section = readFileSync(join(__dirname, '..', '..', 'sections/main-collection.liquid'), 'utf8');
const longform = section.match(/assign longform_handles = '([^']+)'/)?.[1].split(',') ?? [];

const STYLE_PAGES = ["14k-gold-herringbone-chains", "14k-gold-cuban-chains", "14k-gold-rope-chains", "14k-gold-curb-chains", "14k-gold-paperclip-chains", "14k-gold-snake-chains"].map((h) => h);

describe('14K gold chain style pages (2026-11-08)', () => {
  it('shows the guide and FAQ block on every style page', () => {
    for (const handle of STYLE_PAGES) expect(longform).toContain(handle);
  });

  it('links every style page from the chain and gold bracelet pages', () => {
    expect(section).toContain('aria-label="Shop by chain style"');
    for (const handle of STYLE_PAGES) expect(section).toContain(`${handle}::`);
    for (const parent of ["'chains'", "'gold-chains'", "'chain-bracelets'", "'chain-necklaces'", "'gold-bracelets'"]) {
      expect(section).toContain(parent);
    }
  });

  it('keeps loose-stone collections off the guide list', () => {
    for (const excluded of ['lab-grown-diamonds', 'natural-diamonds', 'colored-lab-grown-diamonds']) {
      expect(longform).not.toContain(excluded);
    }
  });
});
