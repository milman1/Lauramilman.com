import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('product-page inquiry pills', () => {
  const inquiry = themeFile('snippets/product-inquiry.liquid');
  const chatJs = themeFile('assets/theme.js');
  const mainProduct = themeFile('sections/main-product.liquid');
  const diamondProduct = themeFile('sections/main-product-diamond.liquid');

  it('renders Ask, Make an offer, and Direct message on every product page', () => {
    expect(inquiry).toContain('data-chat-intent="ask"');
    expect(inquiry).toContain('data-chat-intent="offer"');
    expect(inquiry).toContain('data-chat-intent="message"');
    expect(inquiry).toContain('Ask about this piece');
    expect(inquiry).toContain('Make an offer');
    expect(inquiry).toContain('Direct message');
    expect(inquiry).not.toContain('Hold this piece');
    expect(inquiry).not.toContain('piece-hold');
    expect(inquiry).not.toContain('desk_piece');
    expect(inquiry).not.toContain('Private viewing');
    expect(inquiry).not.toContain('Book a call');
  });

  it('is rendered on jewelry and diamond product templates', () => {
    expect(mainProduct).toContain("{% render 'product-inquiry', product: product %}");
    expect(diamondProduct).toContain("{% render 'product-inquiry', product: product %}");
    expect(inquiry).toContain('js-open-product-chat');
    expect(inquiry).toContain("intent: btn.getAttribute('data-chat-intent') || 'ask'");
  });

  it('opens Shopify chat with this product named in the panel', () => {
    expect(chatJs).toContain("querySelector('shopify-chat')");
    expect(chatJs).toContain('host.show');
    expect(chatJs).toContain("closest('.js-open-product-chat')");
    expect(chatJs).toContain('window.lmChat');
    expect(chatJs).toContain('productTitle');
    expect(chatJs).toContain("I'm looking at");
    expect(chatJs).toContain('lm-chat-piece');
    expect(chatJs).toContain('mountPieceCard');
    expect(chatJs).toContain('brandJacobCo');
    expect(chatJs).not.toContain("getElementById('chat-trigger')");
  });

  it('prints Jacob & Co. never Jacob & Company', () => {
    expect(inquiry).toContain("replace: 'Jacob & Company', 'Jacob & Co.'");
    expect(mainProduct).toContain('<h1 class="product-title">{{ display_title }}</h1>');
    expect(themeFile('snippets/jacob-co-name.liquid')).toContain('Jacob & Co.');
  });

  it('renders chain specs from custom.width, custom.clasp, and custom.finish', () => {
    const specDefs = /assign spec_defs = '([^']+)'/.exec(mainProduct)?.[1] ?? '';
    expect(specDefs).toContain('width:Width');
    expect(specDefs).toContain('clasp:Clasp');
    expect(specDefs).toContain('finish:Finish');
    expect(specDefs).toContain('metal:Metal');
    expect(specDefs).toContain('link:Link');
    expect(specDefs).toContain('length:Length');
    // Chain listings put specs here, never in the body; empty keys never render a row.
    expect(specDefs).not.toContain('metal_type');
    expect(specDefs).not.toContain('measurements');
  });

  it('treats designer-jewelry tags as maison/vintage', () => {
    const vintage = themeFile('snippets/product-is-vintage.liquid');
    expect(vintage).toContain("tags_l contains 'designer-jewelry'");
  });
});
