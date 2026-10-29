import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('homepage: where to begin is picture-led', () => {
  const start = themeFile('sections/ring-builder-start.liquid');

  it('uses the homepage tile pattern: one picture per path, serif title, gold links', () => {
    expect(start).toContain('class="lmh lmh-split rbs"');
    expect(start).toContain('class="lmh-split__media rbs__case"');
    expect(start).toContain('data-rbs-stones');
    expect(start).toContain('class="lmh-split__label">Start with a diamond<');
    expect(start).toContain('class="lmh-split__label">Start with a setting<');
    for (const removed of ['rbs__note', 'rbs__count', 'rbs__pill', 'rbs__card', 'Certified, priced stone by stone', 'Choose a stone, then set it in a ring']) {
      expect(start).not.toContain(removed);
    }
    // Links, not sentences: lab-grown, natural, by shape, and See all.
    expect(start).toContain('>Lab-grown {% render \'lmh-arrow\' %}</a>');
    expect(start).toContain('>Natural {% render \'lmh-arrow\' %}</a>');
    expect(start).toContain('>By shape {% render \'lmh-arrow\' %}</a>');
    expect(start).toContain('See all {{ total }} setting');
  });

  it('shows the stones small and uncropped on navy, never a stand-in picture', () => {
    // The stone cells are live inventory photos; until they load, a shape icon.
    expect(start).not.toContain("render 'lmh-img'");
    expect(start).not.toMatch(/\.webp|\.jpg|'[a-z-]+\.(png|svg)' \| asset_url/);
    expect(start).toContain("render 'diamond-shape-icon'");
    expect(start).toContain("'Round,Oval,Pear' | split: ','");
    expect(start).toContain('background: var(--lmh-navy)');
    expect(start).toContain('.rbs .rbs__stone { flex: 0 0 27%;');
    // One in-stock lab-grown stone per shape, linking to that stone's own page.
    expect(start).toContain('kind=lab&shapes=');
    expect(start).toContain("cell.setAttribute('href', '/products/' + handle)");
    expect(start).toContain("/^https:/.test(list[i].image_urls[0]");
  });

  it('uses the approved diamonds-first gallery only on the homepage', () => {
    const home = themeFile('templates/index.json');
    expect(home).toContain('"type": "home-ring-gallery"');
    expect(home).toContain('"title": "Make it yours."');
    expect(home).toContain('"subtitle": "Start with the stone or the ring."');
  });
});

describe('lab-grown diamond pages: pictures first, text on request', () => {
  const guide = themeFile('snippets/diamond-visual-guide.liquid');
  const longform = themeFile('snippets/collection-longform.liquid');
  const filter = themeFile('sections/diamond-filter.liquid');

  it('draws the four Cs and states only what the written guide already says', () => {
    for (const caption of ['IGI or GIA graded', 'Live price on every stone', 'Photos, most with video', 'Free insured US shipping']) {
      expect(guide).toContain(caption);
    }
    for (const c of ['Cut', 'Color', 'Clarity', 'Carat']) expect(guide).toContain(`<h3>${c}</h3>`);
    expect(guide).toContain('Excellent or Ideal on rounds');
    expect(guide).toContain('D&ndash;F icy white, G&ndash;H white once set');
    expect(guide).toContain('VS1&ndash;VS2 usually clean to the eye');
    expect(guide).toContain('Weight, not size. Compare mm');
    // Nothing the guide does not say: no prices, no supplier, no hype.
    expect(guide).not.toMatch(/\$\d|dnalinks|belgium|royal ?chain|stunning|breathtaking/i);
  });

  it('shows the pictures above the written guide, on the same pages as before', () => {
    const block = filter.slice(filter.indexOf("collection.handle == 'lab-grown-diamonds' or is_landing"));
    expect(block.indexOf("render 'diamond-visual-guide'")).toBeGreaterThan(-1);
    expect(block.indexOf("render 'diamond-visual-guide'")).toBeLessThan(block.indexOf("render 'collection-longform'"));
    expect(block).toContain("render 'collection-longform', collection: collection, accordion: true");
  });

  it('turns each guide heading into a closed section but keeps it a real heading', () => {
    expect(longform).toContain("guide_html | split: '<h2>'");
    expect(longform).toContain('<details class="lm-longform__sec">');
    expect(longform).toContain('<summary><h2 class="lm-longform__sec-title">{{ pair[0] }}</h2></summary>');
    // The section body is rendered, not dropped, so the words stay in the page.
    expect(longform).toContain('{{ section_body }}');
  });

  it('leaves the guide as it was everywhere that does not ask for accordions', () => {
    expect(longform).toContain("{% if forloop.first and accordion == blank %} open{% endif %}");
    expect(longform).toContain('<div class="lm-longform__body">{{ guide_html }}</div>');
    expect(longform).toContain('"@type": "FAQPage"');
  });

  it('keeps the popular searches on one swipeable row on phones', () => {
    const links = themeFile('snippets/lab-landing-links.liquid');
    expect(links).toContain('flex-wrap: nowrap; overflow-x: auto');
  });
});
