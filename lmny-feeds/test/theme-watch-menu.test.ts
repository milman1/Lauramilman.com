import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('watch menu', () => {
  it('lists Jacob & Co. with the other watch brands', () => {
    const header = themeFile('sections/header.liquid');
    const watches = header.slice(header.indexOf('>Watches</span>'), header.indexOf('>Signed jewelry</span>'));
    expect(watches).toContain('href="/collections/jacob-co"');
    expect(watches).toContain('>Jacob &amp; Co.</a>');
    expect(watches).not.toContain('Jacob &amp; Company');
    const order = ['Rolex', 'Cartier', 'Jacob &amp; Co.', 'Bvlgari', 'Van Cleef &amp; Arpels', 'Chopard', 'All watches'];
    let at = -1;
    for (const label of order) {
      const next = watches.indexOf(label, at + 1);
      expect(next).toBeGreaterThan(at);
      at = next;
    }
  });
});
