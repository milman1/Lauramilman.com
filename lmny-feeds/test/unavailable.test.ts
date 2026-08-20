import { describe, expect, it } from 'vitest';
import { isUnavailableProductHandle, UNAVAILABLE_PRODUCT_HANDLES } from '../config/unavailable.js';

describe('isUnavailableProductHandle', () => {
  it('matches the two Hermès models and their Back Vault copies', () => {
    expect(UNAVAILABLE_PRODUCT_HANDLES).toHaveLength(2);
    for (const handle of UNAVAILABLE_PRODUCT_HANDLES) {
      expect(isUnavailableProductHandle(handle)).toBe(true);
      expect(isUnavailableProductHandle(`bv-${handle}`)).toBe(true);
    }
  });

  it('does not match other listings', () => {
    expect(isUnavailableProductHandle('w-t3658')).toBe(false);
    expect(isUnavailableProductHandle('pre-owned-cartier-tank')).toBe(false);
    expect(isUnavailableProductHandle('bv-cartier-tank-francaise')).toBe(false);
  });
});
