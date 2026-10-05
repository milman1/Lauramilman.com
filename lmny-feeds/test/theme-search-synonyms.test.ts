import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('search misspellings', () => {
  const synonyms = themeFile('snippets/search-synonyms.liquid');
  const mainSearch = themeFile('sections/main-search.liquid');

  it('maps the misspellings shoppers typed to "bracelet"', () => {
    for (const word of ['brazalet', 'brasalect', 'brazaletes', 'blacelet']) {
      expect(synonyms).toContain(`'${word}'`);
    }
    expect(synonyms).toContain("echo 'bracelet'");
    // Anything off the list passes through unchanged.
    expect(synonyms).toMatch(/else\s+echo w/);
  });

  it('re-runs a corrected search and offers the corrected term', () => {
    expect(mainSearch).toContain("render 'search-synonyms', word: word");
    expect(mainSearch).toContain('{%- if search_corrected -%}');
    expect(mainSearch).toContain('window.location.replace({{ corrected_url | json }})');
    expect(mainSearch).toContain('corrected_terms | url_encode');
    expect(mainSearch).toContain('Did you mean');
  });
});
