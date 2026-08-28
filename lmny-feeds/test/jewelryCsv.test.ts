import { describe, expect, it } from 'vitest';
import { formatJewelryCsvReport, validateJewelryCsv } from '../src/jewelryCsv.js';

const HEADER =
  'Handle,Title,Type,Product Category,Variant SKU,Variant Inventory Tracker,Variant Inventory Qty,Variant Inventory Policy,Status,Published';

describe('validateJewelryCsv', () => {
  it('accepts a one-of-one ring that meets Uploadify rules', () => {
    const csv = [
      HEADER,
      'cartier-love-ring,Cartier Love Ring,Rings,Apparel & Accessories > Jewelry > Rings,CLV-001,shopify,1,deny,active,true',
    ].join('\n');
    expect(validateJewelryCsv(csv)).toEqual([]);
  });

  it('rejects blank SKU, untracked qty, inactive status, and missing category', () => {
    const csv = [
      HEADER,
      'bad-piece,Bad Piece,Rings,,,,,deny,draft,false',
    ].join('\n');
    const issues = validateJewelryCsv(csv);
    expect(issues.map((i) => i.field).sort()).toEqual([
      'Product Category',
      'Status',
      'Variant Inventory Qty',
      'Variant Inventory Tracker',
      'Variant SKU',
    ]);
  });

  it('ignores extra image rows and still validates the variant', () => {
    const csv = [
      HEADER,
      'piece,Piece,Earrings,Apparel & Accessories > Jewelry > Earrings,ER-1,shopify,1,deny,active,true',
      'piece,,,,,,,,,',
    ].join('\n');
    expect(validateJewelryCsv(csv)).toEqual([]);
  });

  it('fails closed on a missing required column', () => {
    const csv = 'Handle,Title,Status\npiece,Piece,active\n';
    const issues = validateJewelryCsv(csv);
    expect(issues.some((i) => i.field === 'Variant SKU')).toBe(true);
    expect(formatJewelryCsvReport(issues)).toContain('Missing column');
  });
});
