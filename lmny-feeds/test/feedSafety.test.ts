import { expect, it } from 'vitest';
import { assertSafeDiamondRemovals } from '../src/feedSafety.js';

it('blocks the observed 3000-row lab truncation before any writes', () => {
  const catalog = Array.from({ length: 24989 }, (_, i) => ({ handle: `lg-${i}` }));
  const decisions = catalog.slice(3000).map(p => ({ ...p, action: 'delete' as const }));
  expect(() => assertSafeDiamondRemovals(decisions, catalog)).toThrow('Refusing all writes');
});
it('checks each diamond kind separately, including archives', () => {
  const catalog = Array.from({ length: 100 }, (_, i) => ({ handle: `nd-${i}` }));
  expect(() => assertSafeDiamondRemovals(catalog.slice(0, 21).map(p => ({ ...p, action: 'archive' })), catalog)).toThrow();
  expect(() => assertSafeDiamondRemovals(catalog.slice(0, 20).map(p => ({ ...p, action: 'delete' })), catalog)).not.toThrow();
});
it('allows ordinary stock turnover and skips unavailable feeds', () => {
  const catalog = Array.from({ length: 100 }, (_, i) => ({ handle: `lg-${i}` }));
  expect(() => assertSafeDiamondRemovals(catalog.map(p => ({ ...p, action: 'skip' })), catalog)).not.toThrow();
  expect(() => assertSafeDiamondRemovals(catalog.slice(0, 3).map(p => ({ ...p, action: 'delete' })), catalog)).not.toThrow();
});
