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

  it('keeps Ask and Direct message on every product, and Make an offer only for natural diamonds, maison vintage, and watches', () => {
    expect(inquiry).toContain('data-chat-intent="ask"');
    expect(inquiry).toContain('data-chat-intent="message"');
    expect(inquiry).toContain('Ask about this piece');
    expect(inquiry).toContain('Direct message');
    expect(inquiry).toContain("render 'product-is-watch', product: product");
    expect(inquiry).toContain("render 'product-is-vintage', product: product");
    expect(inquiry).toContain("type_l == 'natural diamond' or is_watch == 'true' or is_vintage == 'true'");
    expect(inquiry).toContain("type_l == 'lab-grown diamond'");
    expect(inquiry).toContain('assign offer_ok = false');
    const offerStart = inquiry.indexOf('{%- if offer_ok -%}');
    const offerLabel = inquiry.indexOf('Make an offer', offerStart);
    const offerForm = inquiry.indexOf("form 'contact', id: 'PdpOfferForm'");
    const offerEnd = inquiry.lastIndexOf('{%- endif -%}');
    expect(offerStart).toBeGreaterThan(-1);
    expect(offerLabel).toBeGreaterThan(offerStart);
    expect(offerForm).toBeGreaterThan(offerLabel);
    expect(offerEnd).toBeGreaterThan(offerForm);
    expect(inquiry).not.toContain('Hold this piece');
    expect(inquiry).not.toContain('piece-hold');
    expect(inquiry).not.toContain('desk_piece');
    expect(inquiry).not.toContain('Private viewing');
    expect(inquiry).not.toContain('Book a call');
  });

  it('removes Reserve this diamond from natural and lab diamond search', () => {
    const filter = themeFile('sections/diamond-filter.liquid');
    const cards = themeFile('assets/diamond-storefront.js');
    const natural = themeFile('templates/collection.diamonds.json');
    const lab = themeFile('templates/collection.diamonds-lab.json');
    for (const file of [filter, cards, natural, lab]) {
      expect(file).not.toContain('Reserve this diamond');
      expect(file).not.toContain('Reserve instead');
      expect(file).not.toContain('reserve_url');
      expect(file).not.toContain('reserve-diamond');
      expect(file).not.toContain('data-reserve');
    }
    expect(cards).toContain('Add to cart');
    expect(cards).toContain('Buy now');
  });

  it('sends offers through the contact form, not the AI chat iframe', () => {
    expect(inquiry).not.toContain('data-chat-intent="offer"');
    expect(inquiry).toContain("{%- form 'contact', id: 'PdpOfferForm'");
    expect(inquiry).toContain('name="contact[request_type]" value="Offer"');
    expect(inquiry).toContain('name="contact[offer]"');
    expect(inquiry).toContain('name="contact[email]"');
    expect(inquiry).toContain('name="contact[product]"');
    expect(inquiry).toContain('name="contact[product_url]"');
    expect(inquiry).toContain('form.posted_successfully?');
    expect(inquiry).toContain('aria-controls="{{ offer_id }}"');
    // The offer form must sit outside the add-to-cart form; nested forms break both.
    for (const section of [mainProduct, diamondProduct]) {
      const endProductForm = section.indexOf('{%- endform -%}');
      const render = section.indexOf("{% render 'product-inquiry'");
      expect(endProductForm).toBeGreaterThan(-1);
      expect(render).toBeGreaterThan(endProductForm);
    }
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

  it('treats designer-jewelry tags as maison/vintage', () => {
    const vintage = themeFile('snippets/product-is-vintage.liquid');
    expect(vintage).toContain("tags_l contains 'designer-jewelry'");
  });

  it('gives loose lab-grown diamonds an Ask about this stone form, never a reserve or an offer', () => {
    expect(inquiry).toContain("assign ask_form_ok = false");
    const labBranch = inquiry.indexOf("if type_l == 'lab-grown diamond'");
    expect(labBranch).toBeGreaterThan(-1);
    expect(inquiry.slice(labBranch, labBranch + 140)).toContain('assign ask_form_ok = true');
    expect(inquiry).toContain('Ask about this stone');
    expect(inquiry).toContain("{%- form 'contact', id: 'PdpAskForm'");
    expect(inquiry).toContain('name="contact[request_type]" value="Stone question"');
    for (const field of ['contact[product]', 'contact[product_url]', 'contact[stock_number]', 'contact[listed_price]', 'contact[name]', 'contact[email]', 'contact[body]']) {
      expect(inquiry).toContain(`name="${field}"`);
    }
    expect(inquiry).toContain('aria-controls="{{ ask_id }}"');
    // On a lab stone the chat Ask pill is replaced, the offer stays off, and nothing promises a hold.
    expect(inquiry).toContain('{%- if ask_form_ok -%}');
    expect(inquiry).not.toMatch(/reserve/i);
    expect(inquiry).not.toMatch(/\bhold (this|the) stone/i);
    const askFormStart = inquiry.indexOf("form 'contact', id: 'PdpAskForm'");
    const offerFormStart = inquiry.indexOf("form 'contact', id: 'PdpOfferForm'");
    expect(offerFormStart).toBeLessThan(askFormStart);
    // The offer panel stays inside its own offer_ok guard; the ask panel sits in a separate ask_form_ok guard.
    const askGuard = inquiry.lastIndexOf('{%- if ask_form_ok -%}', askFormStart);
    expect(askGuard).toBeGreaterThan(offerFormStart);
    expect(inquiry.slice(offerFormStart, askGuard)).toContain('{%- endif -%}');
  });
});
