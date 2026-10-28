import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('welcome offer line on product pages (2026-10-28)', () => {
  const line = read('snippets/welcome-offer-line.liquid');

  it('says sign up for 10% off without printing the code', () => {
    expect(line).toContain('sign up for 10% off</a> your first jewelry purchase');
    expect(line.split('{% enddoc %}')[1]).not.toContain('LMNYWELCOME');
  });

  it('shows only on products in the discount collections, never on watches or for signed-up customers', () => {
    for (const handle of ['estate-jewelry', 'hermes', 'cartier', 'lab-grown-diamond-jewelry']) {
      expect(line).toContain(handle);
    }
    expect(line).not.toContain(',lab-grown-diamonds,');
    expect(line).not.toContain('natural-diamonds');
    expect(line).not.toContain('time-pieces');
    expect(line).toContain("render 'product-is-watch'");
    expect(line).toContain("customer.tags contains 'welcome10'");
  });

  it('is rendered on jewelry product pages only, not loose-stone pages', () => {
    expect(read('sections/main-product.liquid')).toContain("render 'welcome-offer-line', product: product");
    expect(read('sections/main-product-diamond.liquid')).not.toContain('welcome-offer-line');
  });

  it('opens the signup popup from the link', () => {
    expect(read('snippets/welcome-popup.liquid')).toContain("closest('[data-welcome-open]')");
  });
});
