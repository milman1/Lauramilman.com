import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Jacob & Co. timepieces merchandising', () => {
  it('lists Jacob & Co. in the Timepieces dropdown on a watch-only collection', () => {
    const header = themeFile('sections/header.liquid');
    const start = header.indexOf('Timepieces\n');
    const end = header.indexOf('Wedding\n', start);
    const block = header.slice(start, end);
    expect(block).toContain('/collections/jacob-co-watches');
    expect(block).toContain('Jacob &amp; Co.');
    expect(block.indexOf('/collections/rolex-watches')).toBeLessThan(block.indexOf('/collections/jacob-co-watches'));
    expect(block).not.toContain('href="/collections/cartier"');
  });

  it('treats Jacob vendors as watches and shows New Vintage on the PDP', () => {
    expect(themeFile('snippets/product-is-watch.liquid')).toContain("vendor_l contains 'jacob'");
    expect(themeFile('sections/main-product.liquid')).toContain("t contains 'new vintage'");
    expect(themeFile('sections/product-education.liquid')).toContain("is_watch == 'true'");
  });
});
