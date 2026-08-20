import { describe, expect, it } from 'vitest';
import { assertScrubbed, containsBackVaultReference, scrubDeep, scrubText } from '../../src/backvault/scrub.js';

describe('containsBackVaultReference', () => {
  it.each([
    'The Back Vault',
    'Back Vault',
    'back-vault',
    'thebackvault',
    'the   back   vault',
    'THE-BACK-VAULT',
    'Sold via TheBackVault.com',
  ])('detects %s', (s) => {
    expect(containsBackVaultReference(s)).toBe(true);
  });

  it.each([null, undefined, '', 'Cartier Love Bracelet', 'A vintage vault of treasures', 'backdrop', 'vaulted ceiling'])(
    'does not false-positive on %s',
    (s) => {
      expect(containsBackVaultReference(s)).toBe(false);
    },
  );
});

describe('scrubText', () => {
  it('removes the phrase and collapses leftover whitespace', () => {
    expect(scrubText('Sold by The Back Vault, authenticated.')).toBe('Sold by, authenticated.');
    expect(scrubText('Item from Back Vault')).toBe('Item from');
  });

  it('is idempotent and null-safe', () => {
    expect(scrubText(null)).toBe('');
    expect(scrubText(undefined)).toBe('');
    expect(scrubText('Cartier Love Bracelet')).toBe('Cartier Love Bracelet');
  });
});

describe('scrubDeep', () => {
  it('scrubs nested string leaves', () => {
    const input = { title: 'From The Back Vault', nested: { alt: 'back-vault photo' }, list: ['thebackvault item'] };
    const out = scrubDeep(input);
    expect(containsBackVaultReference(JSON.stringify(out))).toBe(false);
  });
});

describe('assertScrubbed', () => {
  it('throws when a field still carries the phrase', () => {
    expect(() => assertScrubbed({ title: 'Cartier Ring', vendor: 'The Back Vault' })).toThrow(/vendor/);
  });

  it('passes clean fields', () => {
    expect(() => assertScrubbed({ title: 'Cartier Ring', vendor: 'Cartier' })).not.toThrow();
  });
});
