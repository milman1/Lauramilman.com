import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function repoFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('lab-grown landing pages', () => {
  const filter = repoFile('sections/diamond-filter.liquid');
  const script = repoFile('assets/diamond-storefront.js');
  const links = repoFile('snippets/lab-landing-links.liquid');
  const pages = JSON.parse(repoFile('docs/seo/landing/lab-grown-landing-pages.json')) as Array<{
    handle: string;
    title: string;
    shape: string;
    tags: string[];
    preset_min_carat: number;
    preset_max_carat: number | null;
    seo_title: string;
    seo_description: string;
    guide_html: string;
    guide_faq: Array<{ question: string; answer: string }>;
  }>;

  it('reads a collection preset and applies it only when the link has no filters', () => {
    expect(filter).toContain('collection.metafields.custom.preset_shape.value');
    expect(filter).toContain('data-preset-shape=');
    expect(filter).toContain('data-preset-min-carat=');
    expect(filter).toContain('data-preset-max-carat=');
    expect(script).toContain('root.dataset.presetShape');
    expect(script).toContain('if (!urlHasFilters)');
  });

  it("shows a landing page's own title and description, not the lab-grown search heading", () => {
    expect(filter).toContain('{{ collection.title | escape }}');
    expect(filter).toContain('if api_mode and preset_shape != blank');
  });

  it('renders the guide block only on the lab-grown search and landing pages', () => {
    expect(filter).toContain("collection.handle == 'lab-grown-diamonds' or is_landing");
    expect(filter.match(/render 'collection-longform'/g)).toHaveLength(1);
    // Jewelry collections show the guide only on an explicit list (Cartier, David Webb).
    const mainCollection = repoFile('sections/main-collection.liquid');
    expect(mainCollection.match(/render 'collection-longform'/g)).toHaveLength(1);
    expect(mainCollection).toContain('{%- if longform_handles contains collection.handle -%}');
    const listed = mainCollection.match(/assign longform_handles = '([^']+)'/)?.[1].split(',') ?? [];
    expect(listed).toContain('cartier');
    expect(listed).toContain('hermes');
    for (const excluded of ['lab-grown-diamonds', 'natural-diamonds', 'rolex-watches', 'time-pieces']) {
      expect(listed).not.toContain(excluded);
    }
  });

  it('links to a landing page only when its collection exists', () => {
    expect(links).toContain('c.products_count > 0');
    for (const page of pages) expect(links).toContain(page.handle);
  });

  it('defines 12 pages with unique handles, tight SEO text and an FAQ', () => {
    expect(pages).toHaveLength(12);
    expect(new Set(pages.map((p) => p.handle)).size).toBe(12);
    for (const p of pages) {
      expect(p.seo_title.length).toBeLessThanOrEqual(60);
      expect(p.seo_description.length).toBeLessThanOrEqual(160);
      expect(p.tags).toHaveLength(2);
      if (p.preset_max_carat !== null) expect(p.preset_min_carat).toBeLessThan(p.preset_max_carat);
      expect(p.guide_faq).toHaveLength(3);
      expect(p.guide_html).toContain('/pages/ring-builder');
      // Facts the page text may not contain: prices, supplier names, hype, long return windows.
      const text = JSON.stringify([p.guide_html, p.guide_faq, p.seo_description]);
      expect(text).not.toMatch(/\$\d/);
      expect(text).not.toMatch(/dnalinks|belgium|royal ?chain|back vault/i);
      expect(text).not.toMatch(/stunning|must-have|breathtaking|eco-?friendly|ethical|sustainab/i);
      expect(text).not.toMatch(/14-day|30-day|lifetime/i);
    }
  });

  it('keeps every guide link on a page that exists', () => {
    const allowed = new Set([
      '/collections/lab-grown-diamonds',
      '/blogs/journal/igi-vs-gia-certified-lab-diamonds',
      '/pages/ring-builder',
      '/pages/shipping-returns',
    ]);
    for (const p of pages) {
      const hrefs = [...JSON.stringify([p.guide_html, p.guide_faq]).replace(/\\"/g, '"').matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
      for (const h of hrefs) expect(allowed.has(h)).toBe(true);
    }
  });
});
