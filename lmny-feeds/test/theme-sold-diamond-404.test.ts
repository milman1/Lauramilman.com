import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const page404 = themeFile('templates/404.liquid');
const filter = themeFile('sections/diamond-filter.liquid');

function scriptOf(src: string): string {
  const m = src.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no script');
  return m[1];
}

/** Run the 404 script for a path; return where it sends the visitor, or null. */
function redirectFor(pathname: string): string | null {
  let target: string | null = null;
  const window = { location: { pathname, replace: (u: string) => { target = u; } } };
  new Function('window', scriptOf(page404))(window);
  return target;
}

describe('sold diamond pages that no longer exist', () => {
  it('sends lab stones, including colored lab, to lab-grown search', () => {
    expect(redirectFor('/products/lg-892696')).toBe('/collections/lab-grown-diamonds?lmny_redirect=lg-892696');
    expect(redirectFor('/products/lg-color-bd-12345')).toBe('/collections/lab-grown-diamonds?lmny_redirect=lg-color-bd-12345');
    expect(redirectFor('/products/LG-892696/')).toBe('/collections/lab-grown-diamonds?lmny_redirect=lg-892696');
  });

  it('sends natural stones to natural search', () => {
    expect(redirectFor('/products/nd-201989a')).toBe('/collections/natural-diamonds?lmny_redirect=nd-201989a');
  });

  it('leaves every other missing page on the 404', () => {
    for (const p of ['/products/oval-solitaire-ring', '/products/lg-', '/collections/lg-1', '/pages/nd-1', '/products/lg-1/extra', '/products/lgx-1']) {
      expect(redirectFor(p)).toBeNull();
    }
  });

  it('uses the same targets as the feed sync redirects', () => {
    const targets = themeFile('lmny-feeds/src/archiveRedirects.ts');
    expect(targets).toContain("natural: '/collections/natural-diamonds'");
    expect(targets).toContain("lab: '/collections/lab-grown-diamonds'");
  });

  it('builds a redirect parameter the GA4 redirect event accepts', () => {
    const ga4 = themeFile('assets/lmny-ga4.js');
    expect(ga4).toContain("/^(lg|nd)-[a-z0-9-]{1,96}$/");
  });

  it('shows a sold note on the diamond search only for a redirected stone', () => {
    expect(filter).toMatch(/<p class="lm-dfilter__sold-note" data-sold-note hidden>/);
    expect(filter).toContain('That diamond has sold.');
    expect(filter).toContain("get('lmny_redirect')");
    expect(filter).toContain('/^(lg|nd)-[a-z0-9-]{1,96}$/.test(h)');
  });
});
