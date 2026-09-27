import { describe, expect, it } from 'vitest';
import { SKYLAB, skylabRetailFromCost } from '../config/pricing.js';
import {
  assertSkylabScrubbed,
  containsSkylabReference,
  scrubSkylabText,
} from '../src/skylab/scrub.js';

describe('skylabRetailFromCost', () => {
  it('is cost × 3 rounded to the nearest dollar', () => {
    expect(SKYLAB.costMultiple).toBe(3);
    expect(SKYLAB.houseVendor).toBe('Laura Milman New York');
    expect(skylabRetailFromCost(1000)).toBe(3000);
    expect(skylabRetailFromCost(333.33)).toBe(1000);
    expect(skylabRetailFromCost(250.2)).toBe(751);
  });

  it('does not use Royal Chain round-up-to-$5', () => {
    expect(skylabRetailFromCost(101)).toBe(303);
  });

  it('rejects non-positive cost', () => {
    expect(() => skylabRetailFromCost(0)).toThrow(/invalid cost/);
    expect(() => skylabRetailFromCost(-10)).toThrow(/invalid cost/);
  });
});

describe('skylab scrub', () => {
  it('catches spaced, hyphenated, and compact supplier names', () => {
    expect(containsSkylabReference('Skylab solitaire')).toBe(true);
    expect(containsSkylabReference('Sky Lab halo')).toBe(true);
    expect(containsSkylabReference('sky-lab setting')).toBe(true);
    expect(containsSkylabReference('Laura Milman solitaire')).toBe(false);
  });

  it('strips the supplier name from copy', () => {
    expect(scrubSkylabText('Skylab 14K solitaire')).toBe('14K solitaire');
  });

  it('throws when a public field still names the supplier', () => {
    expect(() => assertSkylabScrubbed({ title: 'Skylab ring' })).toThrow(/title/);
    expect(() => assertSkylabScrubbed({ title: 'Lab Grown solitaire' })).not.toThrow();
  });
});
