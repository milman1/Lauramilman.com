import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('product-page inquiry CTAs', () => {
  const inquiry = themeFile('snippets/product-inquiry.liquid');
  const chatJs = themeFile('assets/theme.js');
  const mainProduct = themeFile('sections/main-product.liquid');
  const diamondProduct = themeFile('sections/main-product-diamond.liquid');

  it('uses the same chat buttons on every product', () => {
    expect(inquiry).toContain('Make an offer');
    expect(inquiry).toContain('Ask about this piece');
    expect(inquiry).toContain('Private viewing');
    expect(inquiry).not.toContain('Hold this piece');
    expect(inquiry).not.toContain('Book a call');
    expect(inquiry).not.toContain('Direct message');
    expect(inquiry).not.toContain('data-open-hold');
    expect(inquiry).not.toContain("{% render 'piece-hold'");
    expect(inquiry).not.toContain('/pages/private-clients');
    expect(inquiry).not.toContain('desk_piece');
    expect((inquiry.match(/js-open-product-chat/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('sits under add to cart on jewelry, watches, and diamonds', () => {
    expect(inquiry).toContain('pdp-inquire__actions');
    expect(mainProduct).toContain("{% render 'product-inquiry', product: product %}");
    expect(diamondProduct).toContain("{% render 'product-inquiry', product: product %}");
  });

  it('opens Shopify storefront chat from every inquiry button', () => {
    expect(chatJs).toContain("querySelector('shopify-chat')");
    expect(chatJs).toContain('host.show');
    expect(chatJs).toContain("closest('.js-open-product-chat')");
    expect(chatJs).toContain('window.lmChat');
    expect(chatJs).not.toContain("getElementById('chat-trigger')");
  });
});
