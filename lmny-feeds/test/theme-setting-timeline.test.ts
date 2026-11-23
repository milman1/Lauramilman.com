import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';
import { describe, expect, it } from 'vitest';

const LINE = 'Choose your diamond and setting, and we will set it within two business days, then ship it the next day.';

const rules = {
  enabled: true,
  show_tags: 'ring-setting, center-stone-excluded, set-stone, Engagement Rings',
  show_types: 'Engagement Ring, Engagement Rings, Solitaire Ring',
  show_collections: 'engagement-rings, lab-grown-engagement-rings, ring-settings, solitaire-ring-settings, hidden-halo-ring-settings',
  hide_tags: 'no-setting-timeline, backvault-feed, antique-estate, designer-jewelry, estate, vintage, pre-owned, preowned',
  all_rings: false,
};

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function product(partial: {
  title?: string;
  type?: string;
  tags?: string[];
  collections?: string[];
}) {
  return {
    title: partial.title ?? 'Sample piece',
    type: partial.type ?? '',
    tags: partial.tags ?? [],
    collections: (partial.collections ?? []).map((handle) => ({ handle })),
  };
}

async function shows(partial: Parameters<typeof product>[0], overrides: Partial<typeof rules> = {}) {
  const liquid = new Liquid({
    root: fileURLToPath(new URL('../../snippets/', import.meta.url)),
    extname: '.liquid',
  });
  const html = await liquid.parseAndRender(themeFile('snippets/stone-set-timeline.liquid'), {
    product: product(partial),
    ...rules,
    ...overrides,
  });
  return html.trim() === 'true';
}

describe('stone-setting timeline', () => {
  it('places the line under the price, with the sentence editable in the product section', () => {
    const section = themeFile('sections/main-product.liquid');
    const priceAt = section.indexOf('class="product-price-row"');
    const lineAt = section.indexOf("render 'stone-set-timeline'");
    const viewingAt = section.indexOf('pdp-private-viewing');
    expect(priceAt).toBeGreaterThan(0);
    expect(lineAt).toBeGreaterThan(priceAt);
    expect(viewingAt).toBeGreaterThan(lineAt);
    expect(section).toContain('class="pdp-setting-timeline"');
    expect(section).toContain('font-family: var(--font-body, \'Montserrat\', sans-serif)');
    expect(section).toContain('font-size: 12px');
    expect(section).toContain('color: var(--text-dark, #2C1810)');
    expect(section).toContain('"id": "setting_timeline_enabled"');
    expect(section).toContain('"id": "setting_timeline_all_rings"');
    expect(section).toContain(LINE);
    expect(section).not.toContain('private appointment');
    expect(section).not.toContain('showroom');
    expect(section).not.toContain('Midtown');
    expect(section).not.toContain('Diamond District');
    expect(themeFile('locales/en.default.json')).toContain(`"setting_timeline": "${LINE}"`);
    for (const template of ['templates/product.json', 'templates/product.ring-builder.json']) {
      const json = JSON.parse(themeFile(template));
      expect(json.sections.main.settings.setting_timeline_text).toBe(LINE);
      expect(json.sections.main.settings.setting_timeline_enabled).toBe(true);
      expect(json.sections.main.settings.setting_timeline_all_rings).toBe(false);
    }
  });

  it('shows the line on settings, engagement rings, and mountings', async () => {
    expect(await shows({
      title: 'Round Solitaire Setting in 14K or 18K White Gold',
      type: 'Rings',
      tags: ['ring-setting', 'center-stone-excluded', 'made-to-order', 'Rings'],
    })).toBe(true);
    expect(await shows({
      title: 'Halo Cushion Cut Lab Grown Diamond Engagement Ring',
      type: 'Engagement Ring',
      tags: ['alyce-import'],
    })).toBe(true);
    expect(await shows({
      title: 'Halo Diamond Ring in 18K White Gold',
      type: 'Rings',
      tags: ['Engagement Rings', 'Halo'],
    })).toBe(true);
    expect(await shows({
      title: 'Oval solitaire mounting',
      type: 'Jewelry',
      collections: ['ring-settings'],
    })).toBe(true);
    expect(await shows({
      title: 'Vintage-Style Oval Diamond Engagement Ring',
      type: 'Engagement Rings',
    })).toBe(true);
  });

  it('stays off watches, other jewelry, finished estate, bands, and loose stones', async () => {
    expect(await shows({
      title: 'Pre-Owned Cartier 18K White Gold Diamond C Ring',
      type: 'Rings',
      tags: ['antique-estate', 'backvault-feed', 'designer-jewelry', 'Rings'],
    })).toBe(false);
    expect(await shows({
      title: 'Pre-Owned Bvlgari Quadrato Watch',
      type: 'Watch',
      tags: ['Watch'],
    })).toBe(false);
    expect(await shows({ title: 'Flower Petal Diamond Stud Earrings', type: 'Earrings' })).toBe(false);
    expect(await shows({ title: 'Station Bracelet', type: 'Bracelets' })).toBe(false);
    expect(await shows({ title: 'Chain Necklace', type: 'Necklaces' })).toBe(false);
    expect(await shows({ title: 'Men\'s Beveled Edge Matte Wedding Band', type: 'Rings', tags: ['ebay'] })).toBe(false);
    expect(await shows({
      title: 'Lab-Grown Round Diamond Eternity Band in White Gold',
      type: 'Rings',
      tags: ['wedding-band', 'made-to-order', 'Rings'],
    })).toBe(false);
    expect(await shows({ title: '1.20ct Round Natural Diamond', type: 'Natural Diamond' })).toBe(false);
    expect(await shows({ title: 'Nut Style Ring in 14K Yellow Gold', type: 'Rings', tags: ['Rings'] })).toBe(false);
    expect(await shows({
      title: 'Round Solitaire Setting in 14K White Gold',
      type: 'Rings',
      tags: ['ring-setting', 'no-setting-timeline'],
    })).toBe(false);
  });

  it('lets set-stone and the every-ring setting widen the line, and a switch turn it off', async () => {
    expect(await shows({ title: 'Pendant mounting', type: 'Pendants', tags: ['set-stone'] })).toBe(true);
    expect(await shows({
      title: 'Pendant mounting',
      type: 'Pendants',
      tags: ['set-stone', 'no-setting-timeline'],
    })).toBe(false);
    expect(await shows({ title: 'Nut Style Ring in 14K Yellow Gold', type: 'Rings' }, { all_rings: true })).toBe(true);
    expect(await shows({
      title: 'Men\'s Beveled Edge Matte Wedding Band',
      type: 'Rings',
    }, { all_rings: true })).toBe(false);
    expect(await shows({
      title: 'Pre-Owned Cartier Ring',
      type: 'Rings',
      tags: ['backvault-feed'],
    }, { all_rings: true })).toBe(false);
    expect(await shows({
      title: 'Round Solitaire Setting',
      type: 'Rings',
      tags: ['ring-setting'],
    }, { enabled: false })).toBe(false);
  });
});
