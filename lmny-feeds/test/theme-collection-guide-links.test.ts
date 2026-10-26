import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('collection reading links (gold and vintage audit, 2026-10-26)', () => {
  const guide = read('snippets/collection-guide.liquid');
  const collection = read('sections/main-collection.liquid');

  it('links David Webb and Estate to the David Webb authentication article', () => {
    expect(guide).toMatch(/when 'david-webb'\s+assign guide_url = '\/blogs\/journal\/how-to-authenticate-david-webb-jewelry'/);
    expect(guide).toContain("when 'estate-jewelry'");
  });

  it('gives Cartier a second link to the Love bracelet article', () => {
    expect(guide).toContain('/blogs/journal/pre-owned-cartier-love-bracelet-size-condition');
    expect(guide).toContain('guide2_url');
  });

  it('links gold and chain collections to the gold chain guide', () => {
    for (const handle of ['gold-jewelry', 'chains', 'chain-necklaces', 'chain-bracelets', 'gold-chains']) {
      expect(guide).toContain(`'${handle}'`);
    }
    expect(guide).toContain('/blogs/journal/gold-chain-guide-styles-widths');
  });

  it('adds Work Essentials and Gold-Plated Silver to the gold chip row', () => {
    expect(collection).toContain('href="/collections/work-essentials"');
    expect(collection).toContain('href="/collections/gold-plated-silver"');
  });
});
