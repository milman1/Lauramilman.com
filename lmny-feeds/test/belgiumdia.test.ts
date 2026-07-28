import { describe, expect, it } from 'vitest';
import { extractRows } from '../src/feeds/belgiumdia.js';

describe('belgiumdia response parsing', () => {
  it('finds a bare array of rows', () => {
    expect(extractRows([{ a: 1 }, { a: 2 }])).toHaveLength(2);
  });

  it('finds rows nested under a common wrapper key', () => {
    expect(extractRows({ data: [{ stock_ref: 'X' }] })).toEqual([{ stock_ref: 'X' }]);
    expect(extractRows({ diamonds: [{ id: 1 }], page: 1, total: 3800 })).toEqual([{ id: 1 }]);
  });

  it('returns [] for an empty page (pagination stop signal)', () => {
    expect(extractRows({ data: [] })).toEqual([]);
    expect(extractRows([])).toEqual([]);
  });

  it('returns null when no array of objects is present', () => {
    expect(extractRows({ message: 'no results' })).toBeNull();
    expect(extractRows(null)).toBeNull();
  });
});
