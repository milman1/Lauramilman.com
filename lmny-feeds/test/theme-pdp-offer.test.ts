import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('product-page Make an offer CTA', () => {
  const inquiry = themeFile('snippets/product-inquiry.liquid');
  const chatJs = themeFile('assets/theme.js');
  const vintage = themeFile('snippets/product-is-vintage.liquid');
  const mainProduct = themeFile('sections/main-product.liquid');
  const diamondProduct = themeFile('sections/main-product-diamond.liquid');

  it('renders the offer tab only for watches and maison/vintage desk pieces', () => {
    expect(inquiry).toContain("{% render 'product-is-watch', product: product %}");
    expect(inquiry).toContain("{% render 'product-is-vintage', product: product %}");
    expect(inquiry).toMatch(/if is_watch == 'true' or is_vintage == 'true'/);
    expect(inquiry).toContain('data-chat-intent="offer"');
    expect(inquiry).toContain('Make an offer');

    const offerIdx = inquiry.indexOf('data-chat-intent="offer"');
    const holdIdx = inquiry.indexOf('Hold this piece');
    const viewingIdx = inquiry.indexOf('Private viewing');
    const unlessIdx = inquiry.indexOf('{%- unless desk_piece -%}');
    expect(offerIdx).toBeGreaterThan(-1);
    expect(holdIdx).toBeGreaterThan(-1);
    expect(viewingIdx).toBeGreaterThan(-1);
    expect(offerIdx).toBeLessThan(unlessIdx);
    expect(holdIdx).toBeLessThan(unlessIdx);
    expect(viewingIdx).toBeLessThan(unlessIdx);
    expect(inquiry.slice(unlessIdx)).not.toContain('data-chat-intent="offer"');
  });

  it('sits in the existing CTA row and opens site chat with offer intent', () => {
    expect(inquiry).toContain('pdp-inquire__actions');
    expect(inquiry).toContain('js-open-product-chat');
    expect(inquiry).toContain("intent: btn.getAttribute('data-chat-intent') || 'ask'");
    expect(mainProduct).toContain("{% render 'product-inquiry', product: product %}");
    expect(diamondProduct).toContain("{% render 'product-inquiry', product: product %}");
  });

  it('opens chat next to the other CTAs with an offer-specific prompt and desk note', () => {
    expect(chatJs).toContain("intent = opts.intent === 'offer' ? 'offer' : 'ask'");
    expect(chatJs).toContain("Share the offer you\\'d like us to take to the desk.");
    expect(chatJs).toContain("input.placeholder = 'Your offer amount...'");
    expect(chatJs).toContain("lines.push('MAKE AN OFFER')");
    expect(chatJs).toContain('the desk has your offer on this piece');
    expect(chatJs).toContain('open: openWithProduct');
  });

  it('treats designer-jewelry tags as maison/vintage so Back Vault pieces get the tab', () => {
    expect(vintage).toContain("tags_l contains 'designer-jewelry'");
  });
});
