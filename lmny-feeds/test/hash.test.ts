import { describe, expect, it } from 'vitest';
import { contentHash, stableStringify } from '../src/hash.js';
import { contentHashFor } from '../src/product.js';
import { naturalStone, priced } from './fixtures.js';

describe('stable stringify', () => {
  it('is insensitive to key insertion order, recursively', () => {
    const a = { x: 1, y: { b: 2, a: [1, { q: 1, p: 2 }] } };
    const b = { y: { a: [1, { p: 2, q: 1 }], b: 2 }, x: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(contentHash(a)).toBe(contentHash(b));
  });

  it('preserves array order (arrays are meaningful)', () => {
    expect(contentHash([1, 2])).not.toBe(contentHash([2, 1]));
  });
});

describe('content hash', () => {
  it('is stable for identical items', () => {
    expect(contentHashFor(naturalStone(), priced())).toBe(contentHashFor(naturalStone(), priced()));
  });

  it('changes when price changes', () => {
    expect(contentHashFor(naturalStone(), priced({ retailUsd: 15000 }))).not.toBe(
      contentHashFor(naturalStone(), priced({ retailUsd: 14990 })),
    );
  });

  it('changes when images change', () => {
    expect(contentHashFor(naturalStone(), priced())).not.toBe(
      contentHashFor(naturalStone({ imageUrls: ['https://dnalinks.in/img/other.jpg'] }), priced()),
    );
  });

  it('does not change with margin bookkeeping fields', () => {
    expect(contentHashFor(naturalStone(), priced({ marginPct: 0.5 }))).toBe(
      contentHashFor(naturalStone(), priced({ marginPct: 0.2 })),
    );
  });
});
