import { describe, expect, it } from 'vitest';
import { ALLOWED_WATCH_STOCK_RE, EXCLUDED_WATCH_STOCK_RE } from '../config/watchGates.js';

describe('watch partner stock prefixes', () => {
  it('keeps Belgium Watch and TLV prefixes', () => {
    expect(ALLOWED_WATCH_STOCK_RE.test('T3717')).toBe(true);
    expect(ALLOWED_WATCH_STOCK_RE.test('RW3085')).toBe(true);
    expect(ALLOWED_WATCH_STOCK_RE.test('R3017')).toBe(true);
  });

  it('does not treat Uncle Manny / Power Watch prefixes as allowed', () => {
    expect(ALLOWED_WATCH_STOCK_RE.test('10005')).toBe(false);
    expect(ALLOWED_WATCH_STOCK_RE.test('U1175')).toBe(false);
    expect(ALLOWED_WATCH_STOCK_RE.test('M3982')).toBe(false);
    expect(ALLOWED_WATCH_STOCK_RE.test('P5365')).toBe(false);
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
