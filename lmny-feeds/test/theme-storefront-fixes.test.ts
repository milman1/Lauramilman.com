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
  it('slides the homepage still and sends the collection hero to loose diamonds', () => {
    const block = themeFile('sections/peaceful-diamonds.liquid');
    const hero = themeFile('sections/peaceful-hero.liquid');
    const peaceful = themeJson('templates/collection.peaceful.json');

    expect(block).toContain('data-pd-slider');
    expect(block).toContain('data-pd-prev');
    expect(block).toContain('data-pd-next');
    expect(hero).toContain("/collections/lab-grown-diamonds");
    expect(hero).not.toContain('/collections/lab-grown-rings');
    expect(peaceful.sections.hero.settings?.primary_label).toBe('Shop Lab-Grown Jewelry');
    expect(peaceful.sections.hero.settings?.secondary_label).toBe('Shop Lab-Grown Diamonds');
    expect(peaceful.sections.hero.settings?.secondary_url).toBe('/collections/lab-grown-diamonds');
  });

  it('gives More to explore a lab-grown card and a product section', () => {
    const home = themeJson('templates/index.json');
    const worlds = home.sections['shop-worlds'];
    const titles = (worlds.block_order ?? []).map((id) => worlds.blocks?.[id]?.settings?.title);
    expect(titles[0]).toBe('Lab-Grown Jewelry');
    expect(home.sections['lab-grown-edit'].type).toBe('featured-products');
    expect(home.sections['lab-grown-edit'].settings?.collection).toBe('peaceful-diamonds-by-laura-milman-new-york');
    expect(home.order.indexOf('lab-grown-edit')).toBe(home.order.indexOf('shop-worlds') + 1);
  });
});

describe('homepage consultation and reviews', () => {
  it('uses a compact consultation band above the story, and the testimonial cards', () => {
    const home = themeJson('templates/index.json');
    const consult = themeFile('sections/private-clients.liquid');

    expect(home.sections['private-clients'].settings?.compact).toBe(true);
    expect(consult).toContain('lm-private--compact');
    expect(home.order.indexOf('private-clients')).toBeLessThan(home.order.indexOf('philosophy-quote'));
    expect(home.order.indexOf('private-clients')).toBeLessThan(home.order.indexOf('brand-story'));
    expect(home.sections.reviews.type).toBe('testimonials');
    expect(JSON.stringify(home.sections.reviews)).not.toContain('google-reviews-strip');
    expect(JSON.stringify(home.sections.reviews)).toContain('What Our Clients Say');
    expect(JSON.stringify(home.sections.reviews)).toContain('Alexandra K.');
  });
});
