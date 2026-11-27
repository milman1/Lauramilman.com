import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('../../sections/main-product.liquid', import.meta.url), 'utf8');

describe('jewelry product page stays in frame and agrees with the chosen option (2026-11-27)', () => {
  it('leaves carat and metal out of Specifications when they are options', () => {
    expect(page).toContain("assign option_names = product.options | join: '|' | downcase");
    expect(page).toMatch(/if def_parts\[0\] == 'carat_weight' and option_names contains 'carat'\s*\n\s*continue/);
    expect(page).toMatch(/if def_parts\[0\] == 'metal' and option_names contains 'metal'\s*\n\s*continue/);
  });

  it('keeps one video in the gallery and drops the rest from the description', () => {
    expect(page).toContain('function dropDescriptionVideos(desc)');
    const hoist = page.slice(page.indexOf('function hoistDescriptionVideo'), page.indexOf('// Gallery: thumb switching'));
    expect(hoist.match(/dropDescriptionVideos\(desc\)/g)).toHaveLength(2);
  });

  it('never lets description media run wider than the page', () => {
    expect(page).toMatch(/#PdpDescription video,\s*#PdpDescription iframe,\s*#PdpDescription img \{\s*max-width: 100%;/);
  });
});
