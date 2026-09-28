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

  it('keeps one lab-grown door and one lab-grown product rail', () => {
    const home = themeJson('templates/index.json');
    const worlds = home.sections.worlds;
    const titles = (worlds.block_order ?? []).map((id) => worlds.blocks?.[id]?.settings?.title);
    expect(titles).toContain('Lab-Grown Jewelry');
    expect(home.sections['lab-grown'].type).toBe('featured-products');
    expect(home.sections['lab-grown'].settings?.collection).toBe('peaceful-diamonds-by-laura-milman-new-york');
    expect(home.order.indexOf('lab-grown')).toBeGreaterThan(home.order.indexOf('worlds'));
    expect(home.order.filter((id) => id === 'lab-grown')).toHaveLength(1);
    expect(home.order).not.toContain('build-the-stack');
    expect(home.order).not.toContain('also-from-the-house');
    expect(home.order).not.toContain('gold-jewelry');
  });
});

describe('homepage consultation and reviews', () => {
  it('puts a compact consultation above the newsletter and real Google quotes on the homepage', () => {
    const home = themeJson('templates/index.json');
    const consult = themeFile('sections/private-clients.liquid');
    const page = themeFile('templates/page.google-reviews.liquid');

    expect(home.sections['private-clients'].settings?.compact).toBe(true);
    expect(consult).toContain('lm-private--compact');
    expect(home.order.indexOf('private-clients')).toBeLessThan(home.order.indexOf('newsletter'));
    expect(home.order.indexOf('client-reviews')).toBeLessThan(home.order.indexOf('private-clients'));
    expect(home.order.at(-1)).toBe('newsletter');
    expect(home.sections['client-reviews'].type).toBe('client-reviews');
    expect(JSON.stringify(home.sections)).not.toContain('google-reviews-strip');
    expect(JSON.stringify(home.sections['client-reviews'])).toContain('Ilya Musheyev');
    expect(JSON.stringify(home.sections['client-reviews'])).toContain('Jennifer Seckler');
    expect(JSON.stringify(home.sections['client-reviews'])).toContain('Marcel Fi');
    expect(JSON.stringify(home.sections['client-reviews'])).not.toContain('Susan Finkelstein');
    expect(JSON.stringify(home.sections)).not.toContain('Alexandra K.');
    expect(page).toContain('data-embed-id="25717519"');
  });
});
