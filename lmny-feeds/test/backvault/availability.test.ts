import { describe, expect, it } from 'vitest';
import { mergeAvailability } from '../../src/backvault/availability.js';
import { handleFor } from '../../src/backvault/product.js';
import type { BackVaultItem } from '../../src/backvault/types.js';

function item(sourceHandle: string, overrides: Partial<BackVaultItem> = {}): BackVaultItem {
  return {
    sourceHandle,
    title: `Cartier ${sourceHandle}`,
    vendorRaw: 'Cartier',
    vendor: 'Cartier',
    productType: 'Rings',
    descriptionHtml: '<p>18K Yellow Gold.</p>',
    costUsd: 1000,
    priceUsd: 1200,
    available: true,
    imageUrls: ['https://cdn.example.com/a.jpg'],
    specs: {},
    ...overrides,
  };
}

describe('mergeAvailability', () => {
  it('keeps a store item that left new-arrivals while the supplier still has it in stock', () => {
    const arrivals = [item('new-ring')];
    const full = [item('new-ring'), item('older-ring'), item('never-listed-ring')];
    const store = [handleFor(item('new-ring')), handleFor(item('older-ring'))];
    const { desired, retained } = mergeAvailability(arrivals, full, store);
    expect(desired.map((i) => i.sourceHandle)).toEqual(['new-ring', 'older-ring']);
    expect(retained).toBe(1);
  });

  it('does not create items from the full catalog that were never on the store', () => {
    const { desired, retained } = mergeAvailability([], [item('never-listed-ring')], []);
    expect(desired).toEqual([]);
    expect(retained).toBe(0);
  });

  it('leaves a sold item (missing from both feeds) out so the diff archives it', () => {
    const { desired } = mergeAvailability([item('a')], [item('a')], ['bv-a', 'bv-sold']);
    expect(desired.map((i) => handleFor(i))).toEqual(['bv-a']);
  });

  it('prefers the new-arrivals row when a handle is in both feeds', () => {
    const arrivals = [item('a', { costUsd: 1100, priceUsd: 1300 })];
    const full = [item('a', { costUsd: 900, priceUsd: 1100 })];
    const { desired, retained } = mergeAvailability(arrivals, full, ['bv-a']);
    expect(desired).toHaveLength(1);
    expect(desired[0]!.priceUsd).toBe(1300);
    expect(retained).toBe(0);
  });
});
