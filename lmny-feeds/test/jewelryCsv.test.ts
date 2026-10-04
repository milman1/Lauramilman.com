import { describe, expect, it } from 'vitest';
import { formatJewelryCsvReport, validateJewelryCsv } from '../src/jewelryCsv.js';

const HEADER =
  'Handle,Title,Body (HTML),SEO Title,SEO Description,Type,Product Category,Variant SKU,Variant Inventory Tracker,Variant Inventory Qty,Variant Inventory Policy,Status,Published';

function row(handle: string, title: string, rest: string): string {
  const body = '<p>This piece is offered by Laura Milman New York.</p>';
  const seoTitle = `${title} | Laura Milman`;
  const seoDescription = 'Shop this piece. Free insured shipping and 7-day returns.';
  return [handle, title, `"${body}"`, `"${seoTitle}"`, `"${seoDescription}"`, rest].join(',');
}

describe('validateJewelryCsv', () => {
  it('accepts a one-of-one ring that meets Uploadify and listing rules', () => {
    const csv = [
      HEADER,
      row('cartier-love-ring', 'Cartier Love Ring', 'Rings,Apparel & Accessories > Jewelry > Rings,CLV-001,shopify,1,deny,active,true'),
    ].join('\n');
    expect(validateJewelryCsv(csv)).toEqual([]);
  });

  it('rejects blank SKU, untracked qty, inactive status, missing category, and blank listing copy', () => {
    const csv = [
      HEADER,
      'bad-piece,Bad Piece,,,,,Rings,,,,,deny,draft,false',
    ].join('\n');
    const issues = validateJewelryCsv(csv);
    expect(issues.map((i) => i.field).sort()).toEqual([
      'Body (HTML)',
      'Product Category',
      'SEO Description',
      'SEO Title',
      'Status',
      'Variant Inventory Qty',
      'Variant Inventory Tracker',
      'Variant SKU',
    ]);
  });

  it('rejects hype and a search title that drops its suffix', () => {
    const csv = [
      HEADER,
      'piece,Beautiful Ring,"<p>A stunning ring.</p>","Beautiful Ring","A stunning ring for sale.",Rings,Apparel & Accessories > Jewelry > Rings,ER-1,shopify,1,deny,active,true',
    ].join('\n');
    const issues = validateJewelryCsv(csv);
    expect(issues.map((i) => i.field).sort()).toEqual(['SEO Description', 'SEO Title', 'Title']);
  });

  it('ignores extra image rows and still validates the variant', () => {
    const csv = [
      HEADER,
      row('piece', 'Piece', 'Earrings,Apparel & Accessories > Jewelry > Earrings,ER-1,shopify,1,deny,active,true'),
      'piece,,,,,,,,,,,,',
    ].join('\n');
    expect(validateJewelryCsv(csv)).toEqual([]);
  });

  it('fails closed on a missing required column', () => {
    const csv = 'Handle,Title,Status\npiece,Piece,active\n';
    const issues = validateJewelryCsv(csv);
    expect(issues.some((i) => i.field === 'Variant SKU')).toBe(true);
    expect(issues.some((i) => i.field === 'SEO Title')).toBe(true);
    expect(formatJewelryCsvReport(issues)).toContain('Missing column');
  });
});
