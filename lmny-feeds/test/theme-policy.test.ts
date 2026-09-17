import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const storefrontPolicyFiles = [
  'templates/page.shipping-returns.json',
  'templates/page.faq.json',
  'templates/page.buying-guide.json',
  'templates/page.shop.json',
  'templates/index.json',
  'templates/page.ring-builder.json',
  'templates/product.json',
  'snippets/welcome-popup.liquid',
  'sections/trust-strip.liquid',
  'sections/main-product.liquid',
  'sections/product-education.liquid',
  'layout/theme.liquid',
  'emails/order-confirmation.html',
  'emails/shipping-confirmation.html',
  'emails/abandoned-checkout.html',
  'emails/welcome.html',
];

describe('storefront warranty and return policy', () => {
  it('states a 1-year warranty and 7-day jewelry returns on policy and trust copy', () => {
    const shipping = themeFile('templates/page.shipping-returns.json');
    const faq = themeFile('templates/page.faq.json');
    const pdp = themeFile('sections/main-product.liquid');

    expect(shipping).toContain('7 days of delivery');
    expect(shipping).toContain('The exchange window is 7 days from delivery');
    expect(shipping).toContain('1-year warranty against manufacturing defects');
    expect(faq).toContain('within 7 days of delivery');
    expect(faq).toContain('same 7-day window');
    expect(faq).toContain('1-year warranty against manufacturing defects');
    expect(pdp).toContain('7-Day Returns');
    expect(pdp).toContain('1-Year Warranty');
  });

  it('does not promise a lifetime warranty or 14-day returns on the storefront or emails', () => {
    for (const path of storefrontPolicyFiles) {
      const text = themeFile(path);
      expect(text, path).not.toMatch(/lifetime warranty/i);
      expect(text, path).not.toMatch(/Lifetime Warranty/);
      expect(text, path).not.toMatch(/14-Day Returns/);
      expect(text, path).not.toMatch(/14-day returns/);
      expect(text, path).not.toMatch(/14-day jewelry/);
      expect(text, path).not.toMatch(/14 days of delivery/);
      expect(text, path).not.toMatch(/14-day window/);
      expect(text, path).not.toMatch(/14 days from delivery/);
      expect(text, path).not.toMatch(/within 14 days/);
    }
  });
});
