import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('lab-grown card marker', () => {
  it('marks every lab-grown spelling the catalog uses, and leaves natural stones unmarked', () => {
    const tag = themeFile('snippets/lab-grown-tag.liquid');
    const card = themeFile('snippets/product-card.liquid');
    const dawn = themeFile('snippets/card-product.liquid');

    expect(card).toContain("render 'lab-grown-tag', product: product");
    expect(dawn).toContain("render 'lab-grown-tag', product: card_product");
    expect(tag).toContain('lab_tags');
    expect(tag).toContain('| downcase');
    expect(tag).toContain("lab_hay contains 'lab grown'");
    expect(tag).toContain("lab_hay contains 'lab-grown'");
    expect(tag).toContain("lab_hay contains 'lab created'");
    expect(tag).toContain("lab_handle contains 'lg-'");
    expect(tag).toContain("lab_handle contains 'lab-diamond'");
    expect(tag).toContain("lab_vendor == 'peaceful diamonds'");
    expect(tag).toContain('lab_title');
    expect(tag).toContain('lab_type');
    expect(tag).not.toContain("product.tags contains 'Lab Grown Diamond'");
    expect(tag).not.toContain('product.description');
  });

  it('centres the pill and keeps it inside a two-up phone card', () => {
    const css = themeFile('assets/theme.css');
    const rule = css.slice(css.indexOf('.lab-grown-tag {'), css.indexOf('.card__information .lab-grown-tag'));
    expect(rule).toContain('display: block');
    expect(rule).toContain('width: fit-content');
    expect(rule).toContain('max-width: 100%');
    expect(rule).toContain('margin: 0 auto');
    expect(rule).toContain('text-align: center');
    expect(rule).not.toContain('white-space: nowrap');

    const phone = css.slice(css.indexOf('@media (max-width: 480px)'));
    expect(phone).toContain('.lab-grown-tag {');
    expect(phone).toContain('letter-spacing: 0.05em');
  });

  it('puts the same pill on API-rendered lab stones and not on natural stones', () => {
    const js = themeFile('assets/diamond-storefront.js');
    expect(js).toContain("origin === 'lab' ? '<span class=\"lab-grown-tag\">Lab Grown Diamond</span>' : ''");
    expect(js).toContain('stone.kind || cfg.kind');
  });
});
