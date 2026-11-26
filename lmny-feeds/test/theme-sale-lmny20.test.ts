import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

// LMNY20 Black Friday sale: 11:59:59 PM New York time on 1 December 2026.
const SALE_END_MS = Date.UTC(2026, 11, 2, 4, 59, 59);

describe('LMNY20 sale messaging', () => {
  const window = themeFile('snippets/sale-window.liquid');
  const header = themeFile('sections/header.liquid');
  const line = themeFile('snippets/sale-offer-line.liquid');
  const product = themeFile('sections/main-product.liquid');
  const diamondProduct = themeFile('sections/main-product-diamond.liquid');
  const ringBuilder = themeFile('sections/ring-builder-flow.liquid');
  const popup = themeFile('snippets/welcome-popup.liquid');

  it('ends at the LMNY20 end date, the same moment the welcome popup pause ends', () => {
    expect(SALE_END_MS).toBe(1796187599000);
    expect(window).toContain(`var END = ${SALE_END_MS};`);
    expect(popup).toContain('var PAUSED_UNTIL = Date.UTC(2026, 11, 2, 4, 59, 59);');
  });

  it('decides in the browser: live elements hide and over elements show after the end', () => {
    expect(window).toContain('if (Date.now() < END) return;');
    expect(window).toContain("querySelectorAll('[data-sale-live]')");
    expect(window).toContain("querySelectorAll('[data-sale-over]')");
    expect(window).not.toMatch(/'now'\s*\|\s*date/);
  });

  it('puts the sale in the top bar on every page, with the normal line back afterwards', () => {
    expect(header).toContain('data-sale-live');
    expect(header).toContain('Black Friday · 20% off all jewelry with code LMNY20 · Ends Dec 1');
    expect(header).toContain('20% off jewelry · Code LMNY20');
    expect(header).toContain('href="/discount/LMNY20?redirect=/collections/all"');
    expect(header).toMatch(/data-sale-over hidden>\s*<span>\{\{ section\.settings\.announce_text \| escape \}\}<\/span>/);
    expect(header.indexOf("render 'sale-window'")).toBeGreaterThan(header.indexOf('data-sale-over'));
    expect(header).toContain('.lmhh__announce-set[hidden] { display: none; }');
  });

  it('says jewelry, never diamonds, in the top bar', () => {
    const bar = header.slice(header.indexOf('data-sale-live'), header.indexOf('data-sale-over'));
    expect(bar).not.toMatch(/diamond/i);
  });

  it('shows a one-line offer on jewelry product pages only', () => {
    expect(line).toContain('<strong>Black Friday:</strong> 20% off with code LMNY20 at checkout, through December 1.');
    expect(line).toContain("c.handle == 'all'");
    expect(line).toContain("render 'product-is-watch'");
    expect(product.indexOf("render 'sale-offer-line'")).toBeGreaterThan(-1);
    expect(product.indexOf("render 'sale-offer-line'")).toBeLessThan(product.indexOf("render 'welcome-offer-line'"));
  });

  it('keeps the sale off loose diamonds', () => {
    // Loose diamonds use their own template, which does not render the line.
    expect(diamondProduct).not.toContain('sale-offer-line');
    // Second guard inside the snippet: product type and the lg-/nd- handles.
    expect(line).toContain("sale_type == 'lab-grown diamond'");
    expect(line).toContain("sale_type == 'natural diamond'");
    expect(line).toContain("sale_prefix == 'lg-' or sale_prefix == 'nd-'");
    expect(line).toMatch(/if sale_type == [^\n]*\n\s*assign sale_ok = false/);
  });

  it('tells ring builder shoppers the sale covers the setting, not the diamond', () => {
    expect(ringBuilder).toContain('20% off the setting with code LMNY20, through December 1. Loose diamonds are not included.');
    expect(ringBuilder).toContain("render 'sale-window'");
  });

  it('applies the code from every banner button', () => {
    const home = JSON.parse(themeFile('templates/index.json').replace(/\/\*[\s\S]*?\*\//g, '')) as {
      sections: { holiday: { block_order: string[]; blocks: Record<string, { settings: { button_link: string } }> } };
    };
    const links = home.sections.holiday.block_order.map((id) => home.sections.holiday.blocks[id].settings.button_link);
    expect(links).toHaveLength(11);
    for (const link of links) expect(link).toMatch(/^\/discount\/LMNY20\?redirect=\/collections\/[a-z0-9-]+$/);
    const preset = themeFile('sections/holiday-carousel.liquid');
    expect(preset.match(/"button_link": "\/discount\/LMNY20\?redirect=\/collections\//g)).toHaveLength(11);
  });
});
