import { describe, expect, it } from 'vitest';
import { ALLOWED_WATCH_PARTNER_BRANCHES, EXCLUDED_WATCH_PARTNERS, EXCLUDED_WATCH_STOCK_RE } from '../config/watchGates.js';

describe('watch partner gates', () => {
  it('fetches an allowlist from Belgium Watch and TLV Watches', () => {
    expect(ALLOWED_WATCH_PARTNER_BRANCHES).toEqual(['ROMAN', 'TLV WATCHES LLC']);
    expect(EXCLUDED_WATCH_PARTNERS).not.toContain('tlv watches llc');
    expect(EXCLUDED_WATCH_PARTNERS).toContain('vivid watches llc');
  });

  it('flags Power Watch and Uncle Manny letter prefixes', () => {
    expect(EXCLUDED_WATCH_STOCK_RE.test('P5365')).toBe(true);
    expect(EXCLUDED_WATCH_STOCK_RE.test('U1175')).toBe(true);
    expect(EXCLUDED_WATCH_STOCK_RE.test('M3982')).toBe(true);
    expect(EXCLUDED_WATCH_STOCK_RE.test('T3717')).toBe(false);
    expect(EXCLUDED_WATCH_STOCK_RE.test('RW3085')).toBe(false);
    expect(EXCLUDED_WATCH_STOCK_RE.test('10005')).toBe(false);
  });
});
