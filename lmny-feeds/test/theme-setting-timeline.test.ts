import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';
import { describe, expect, it } from 'vitest';

const LINE = 'Choose your diamond and setting. We set it here in New York and deliver it within three business days.';
const RETURNS = 'Unworn jewelry, and unset diamonds with their certificate, may be returned or exchanged within 14 days of delivery, with a prepaid, insured label. Once your diamond is set, the ring can be exchanged but not returned. Engraved pieces, bespoke commissions, and specially sourced stones (diamonds not listed on our site) are final sale, and we are happy to offer an exchange or store credit.';
const HOLIDAY = 'Order by December 22 for delivery before Christmas.';

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
    expect(section).toContain('class="pdp-setting-timeline"');
    expect(section).toContain('class="pdp-setting-returns"');
    expect(section).toContain('data-holiday-through');
    expect(section).toContain("timeZone: 'America/New_York'");
    expect(section).toContain('today <= through');
    expect(section).toContain('font-family: var(--font-body, \'Montserrat\', sans-serif)');
    expect(section).toContain('font-size: 12px');
    expect(section).toContain('color: var(--text-dark, #2C1810)');
    expect(section).toContain('"id": "setting_timeline_enabled"');
    expect(section).toContain('"id": "setting_holiday_enabled"');
    expect(section).toContain('"id": "setting_timeline_all_rings"');
    expect(section).toContain(LINE);
    expect(section).toContain(RETURNS);
    expect(section).toContain(HOLIDAY);
    expect(section).toContain('"default": "2026-12-22"');
    const priceAt = section.indexOf('class="product-price-row"');
    const lineAt = section.indexOf("render 'stone-set-timeline'");
    const returnsAt = section.indexOf('class="pdp-setting-returns"');
    const atcAt = section.indexOf('id="PdpAtcRow"');
    expect(priceAt).toBeGreaterThan(0);
    expect(lineAt).toBeGreaterThan(priceAt);
    expect(returnsAt).toBeGreaterThan(lineAt);
    expect(atcAt).toBeGreaterThan(returnsAt);
    expect(themeFile('locales/en.default.json')).toContain(`"setting_timeline": "${LINE}"`);
    expect(themeFile('locales/en.default.json')).toContain(`"setting_returns": "${RETURNS}"`);
    expect(themeFile('locales/en.default.json')).toContain(`"setting_holiday": "${HOLIDAY}"`);
    for (const template of ['templates/product.json', 'templates/product.ring-builder.json']) {
      const json = JSON.parse(themeFile(template));
      expect(json.sections.main.settings.setting_timeline_text).toBe(LINE);
      expect(json.sections.main.settings.setting_returns_text).toBe(RETURNS);
      expect(json.sections.main.settings.setting_holiday_text).toBe(HOLIDAY);
      expect(json.sections.main.settings.setting_holiday_through).toBe('2026-12-22');
      expect(json.sections.main.settings.setting_timeline_enabled).toBe(true);
      expect(json.sections.main.settings.setting_holiday_enabled).toBe(true);
      expect(json.sections.main.settings.setting_timeline_all_rings).toBe(false);
    }
    const home = themeFile('templates/index.json');
    expect(home).toContain('"text": "14-day returns on eligible jewelry"');
    expect(home).toContain('"link": "/pages/shipping-returns"');
    expect(themeFile('sections/header.liquid')).toContain('<a href="/pages/shipping-returns">14-day returns on eligible jewelry</a>');
    const shipping = JSON.parse(themeFile('templates/page.shipping-returns.json'));
    expect(shipping.sections.main.blocks['h-setting'].settings.text).toBe('Setting your diamond');
    expect(shipping.sections.main.blocks['t-setting'].settings.text).toBe(`<p>${LINE}</p>`);
    expect(shipping.sections.main.blocks['t-returns'].settings.text).toBe(`<p>${RETURNS}</p>`);
    expect(shipping.sections.main.blocks['t-shipping'].settings.text).toContain('specially sourced stones (diamonds not listed on our site)');
    const faq = JSON.parse(themeFile('templates/page.faq.json'));
    expect(faq.sections.main.blocks['qa-setting'].settings.question).toBe('How long does it take to set a diamond?');
    expect(faq.sections.main.blocks['qa-setting'].settings.answer).toBe(`<p>${LINE}</p>`);
    expect(faq.sections.main.blocks['qa-returns'].settings.answer).toContain(RETURNS);
    expect(faq.sections.main.blocks['qa-returns'].settings.answer).not.toContain('independent');
  });

  it('shows the holiday line through December 22, 2026 in New York and hides it the next day', () => {
    const nyDay = (iso: string) => new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
    const through = '2026-12-22';
    expect(nyDay('2026-12-23T04:59:00Z') <= through).toBe(true);
    expect(nyDay('2026-12-23T05:00:00Z') <= through).toBe(false);
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
