import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function doc(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

describe('watch listing formula is saved for reuse', () => {
  it('keeps New Vintage in the canonical schema and SEO one-pager', () => {
    const schema = doc('docs/watch-listing-schema.md');
    const seo = doc('docs/seo-title-formulas.md');
    expect(schema).toContain('New Vintage {Brand} {Model} {reference}');
    expect(schema).toContain('{Brand} {Model} {reference} – New Vintage Watch');
    expect(schema).toContain('Authenticated by Laura Milman New York.');
    expect(schema).toContain('jacob-co-boutique');
    expect(schema).toContain('Do not map it to Pre-Owned');
    expect(seo).toContain('New Vintage {brand} {model} {reference}');
    expect(seo).toContain('docs/watch-listing-schema.md');
  });

  it('points the Cursor skill and AGENTS.md at that spec', () => {
    const skill = readFileSync(new URL('../../.cursor/skills/watch-listing-formula/SKILL.md', import.meta.url), 'utf8');
    const agents = readFileSync(new URL('../../AGENTS.md', import.meta.url), 'utf8');
    expect(skill).toContain('lmny-feeds/docs/watch-listing-schema.md');
    expect(skill).toContain('New Vintage');
    expect(skill).toContain('jacob-co-boutique');
    expect(agents).toContain('watch-listing-schema.md');
    expect(agents).toContain('New Vintage');
  });
});
