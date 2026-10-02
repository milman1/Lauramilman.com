import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function themeJson(path: string): { sections: Record<string, { type?: string; settings?: Record<string, unknown>; block_order?: string[]; blocks?: Record<string, { settings?: Record<string, unknown> }> }>; order: string[] } {
  const text = themeFile(path).replace(/\/\*[\s\S]*?\*\//g, '');
  return JSON.parse(text);
}

describe('collection filter drawer', () => {
  it('hides the chat launcher while the drawer is open and treats designer collections as estate', () => {
    const drawer = themeFile('snippets/filter-drawer.liquid');
    const collection = themeFile('sections/main-collection.liquid');

    expect(drawer).toContain('fd_is_designer');
    expect(drawer).toContain("jf_drawer_handle == 'cartier'");
    expect(drawer).toContain('Jewelry Type');
    expect(drawer).toContain('body.refine-open shopify-chat');
    expect(drawer).toContain("replace: '.00', ''");
    expect(collection).toContain("document.body.classList.add('refine-open')");
    expect(collection).toContain("document.body.classList.remove('refine-open')");
  });
});

describe('lab-grown jewelry merchandising', () => {
  it('slides the lab-grown still and sends the collection hero to loose diamonds', () => {
    const block = themeFile('sections/lab-grown-diamonds-feature.liquid');
    const hero = themeFile('sections/lab-grown-hero.liquid');
    const labGrown = themeJson('templates/collection.lab-grown.json');

    expect(block).toContain('data-pd-slider');
    expect(block).toContain('data-pd-prev');
    expect(block).toContain('data-pd-next');
    expect(hero).toContain("/collections/lab-grown-diamonds");
    expect(hero).not.toContain('/collections/lab-grown-rings');
    expect(labGrown.sections.hero.settings?.primary_label).toBe('Shop Lab-Grown Jewelry');
    expect(labGrown.sections.hero.settings?.secondary_label).toBe('Shop Lab-Grown Diamonds');
    expect(labGrown.sections.hero.settings?.secondary_url).toBe('/collections/lab-grown-diamonds');
  });

  it('gives the homepage a lab-grown world and a product row', () => {
    const home = themeJson('templates/index.json');
    const worlds = home.sections.worlds;
    const titles = (worlds.block_order ?? []).map((id) => worlds.blocks?.[id]?.settings?.title);
    expect(titles).toContain('Lab-Grown Diamonds');
    expect(home.sections['lab-grown'].type).toBe('lmh-product-row');
    expect(home.order.indexOf('lab-grown')).toBeGreaterThan(home.order.indexOf('worlds'));
    expect(home.order.indexOf('lab-grown')).toBeLessThan(home.order.indexOf('loose-diamonds'));
  });
});

describe('homepage consultation and reviews', () => {
  it('places the private-client band before the story and shows live Google reviews', () => {
    const home = themeJson('templates/index.json');
    const reviews = themeFile('sections/lmh-reviews.liquid');

    expect(home.sections['private-clients'].type).toBe('lmh-private-band');
    expect(home.sections['private-clients'].settings?.button_text).toBe('Book a Consultation');
    expect(home.order.indexOf('private-clients')).toBeLessThan(home.order.indexOf('brand-story'));
    expect(home.sections.reviews.type).toBe('lmh-reviews');
    expect(home.sections.reviews.settings?.title).toBe('What clients say');
    expect(home.sections.reviews.settings?.embed_id).toBe('25717519');
    expect(reviews).toContain('sk-ww-google-reviews');
    expect(JSON.stringify(home.sections.reviews)).not.toContain('Alexandra K.');
  });
});
