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

describe('welcome popup reopen tab', () => {
  const popup = readFileSync(join(__dirname, '../../snippets/welcome-popup.liquid'), 'utf8');

  it('renders a tab that reopens the offer after the popup is closed', () => {
    expect(popup).toContain('id="LmWelcomeTab"');
    expect(popup).toMatch(/lm-welcome-tab__open"[^>]*data-welcome-open/);
    expect(popup).toMatch(/function close\(\)[\s\S]*?showTab\(true\)/);
  });

  it('keeps the tab inside the guard that skips signed-up customers and the ring builder', () => {
    const start = popup.indexOf("unless customer.tags contains 'welcome10'");
    const end = popup.indexOf('endunless');
    const tab = popup.indexOf('id="LmWelcomeTab"');
    expect(start).toBeGreaterThan(-1);
    expect(tab).toBeGreaterThan(start);
    expect(tab).toBeLessThan(end);
  });

  it('stops showing the tab after signup and lets it be hidden for the visit', () => {
    expect(popup).toContain("set(localStorage, joinedKey)");
    expect(popup).toContain("set(sessionStorage, tabKey)");
  });
});

describe('welcome offer pause during a store-wide sale', () => {
  const read = (f: string) => readFileSync(join(__dirname, '../../snippets', f), 'utf8');
  const paused = read('welcome-offer-paused.liquid');
  const popup = read('welcome-popup.liquid');
  const line = read('welcome-offer-line.liquid');

  it('pauses until the end of the LMNY20 sale, 11:59:59 PM New York time on 1 December 2026', () => {
    expect(paused).toContain('assign paused_until = 1796187599');
    expect(new Date(1796187599 * 1000).toISOString()).toBe('2026-12-02T04:59:59.000Z');
  });

  it('hides the popup, its tab and the product-page line while paused', () => {
    expect(popup).toMatch(/render 'welcome-offer-paused'/);
    expect(popup).toMatch(/unless [^%]*welcome_paused == 'true'/);
    expect(line).toMatch(/render 'welcome-offer-paused'/);
    expect(line).toMatch(/if welcome_paused == 'true' -%\}\{%- assign offer_ok = false/);
  });
});
