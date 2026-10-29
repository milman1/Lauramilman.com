import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

/** Template JSON may open with Shopify's auto-generated comment block. */
function template(path: string): { sections: Record<string, { type: string; settings?: Record<string, unknown> }>; order: string[] } {
  const raw = themeFile(path);
  const start = raw.includes('*/') ? raw.indexOf('{', raw.indexOf('*/')) : raw.indexOf('{');
  return JSON.parse(raw.slice(start));
}

function schema(path: string): { settings: Array<{ id?: string; default?: unknown }> } {
  const m = themeFile(path).match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  if (!m) throw new Error(`no schema in ${path}`);
  return JSON.parse(m[1]);
}

describe('ring builder templates (opt-in, ?view=ring-builder)', () => {
  it('is off unless a ring-builder template turns it on', () => {
    const product = schema('sections/main-product.liquid').settings.find((s) => s.id === 'ring_builder_enabled');
    const filter = schema('sections/diamond-filter.liquid').settings.find((s) => s.id === 'ring_builder_mode');
    expect(product?.default).toBe(false);
    expect(filter?.default).toBe(false);
    for (const path of ['templates/product.json', 'templates/product.diamond.json', 'templates/collection.diamonds.json', 'templates/collection.diamonds-lab.json', 'templates/index.json']) {
      expect(themeFile(path)).not.toMatch(/ring_builder_(enabled|mode)/);
    }
  });

  it('turns the chooser on for setting pages and builder mode on for the diamond search', () => {
    const product = template('templates/product.ring-builder.json');
    expect(product.order[0]).toBe('ring-bar');
    expect(product.sections['ring-bar'].type).toBe('ring-builder-bar');
    expect(product.sections.main.settings).toMatchObject({ ring_builder_enabled: true, ring_builder_view: 'ring-builder' });
    expect(String(product.sections.main.settings?.ring_builder_api_base)).toMatch(/^https:\/\/.+\/functions\/v1\/diamonds$/);

    const search = template('templates/collection.ring-builder.json');
    expect(search.order).toEqual(['ring-bar', 'main']);
    expect(search.sections.main.type).toBe('diamond-filter');
    expect(search.sections.main.settings).toMatchObject({ ring_builder_mode: true });

    const start = template('templates/page.ring-builder-start.json');
    expect(start.sections.main.type).toBe('ring-builder-flow');
    expect(template('templates/page.ring-builder.json').sections.main.type).toBe('ring-builder-flow');
  });

  it('lists diamonds only on settings sold without a center stone, by the ring shape', () => {
    const pairing = themeFile('snippets/ring-diamond-pairing.liquid');
    expect(pairing).toContain('if builder and is_setting and builder_api_base != blank');
    expect(pairing).toContain("shapes: ringShape");
    // A stone picked on the page goes through the same shape, type and availability checks as ?diamond=.
    expect(pairing).toContain('loadStone(handle, true)');
    expect(pairing).toContain('if (HANDLE.test(handle)) loadStone(handle, !!fromUrl);');
  });

  it('fixes the search to the setting shape and returns to the setting with the stone', () => {
    const js = themeFile('assets/diamond-storefront.js');
    expect(js).toContain("(p.tags || []).indexOf('ring-setting') === -1");
    expect(js).toContain('input.checked = input.value === builder.shape;');
    expect(js).toContain("ringPath('&diamond=' + encodeURIComponent(handle) + '#RingPairing')");
    expect(themeFile('sections/diamond-filter.liquid')).toContain('data-ring-builder="true"');
  });

  it('start page matches settings by stated center shape, never the title', () => {
    const start = themeFile('sections/ring-builder-start.liquid');
    expect(start).toContain("{% render 'center-stone-shape', product: ring %}");
    expect(start).toContain("ring.tags contains 'ring-setting'");
    expect(start).toContain('/pages/ring-builder?setting={{ photo_ring.handle | url_encode }}');
    expect(start).toContain('shape={{ photo_ring_shape | url_encode }}');
  });
});

describe('ring builder page chrome', () => {
  it('confirms a sent ring email at the top and clears the posted flag', () => {
    const flow = themeFile('sections/ring-builder-flow.liquid');
    const js = themeFile('assets/ring-builder-flow.js');
    const en = JSON.parse(themeFile('locales/en.default.json').replace(/^\s*\/\*[\s\S]*?\*\//, '')).ring_flow;
    expect(flow).toContain('<div class="ring-sent" data-ring-sent tabindex="-1" role="status" hidden></div>');
    expect(flow).toContain('data-ring-email-sent>{{ \'ring_flow.email_sent_heading\' | t }}</h2>');
    expect(flow).toContain('data-ring-email-error');
    for (const key of ['email_sent_title', 'email_sent', 'keep_personalizing']) {
      expect(flow).toContain(`"${key}":{{ 'ring_flow.${key}' | t | json }}`);
      expect(en[key]).toBeTruthy();
    }
    expect(en.email_sent_heading).toBe('Sent to Laura');
    // Runs once the review is drawn, so the confirmation is where the shopper lands.
    expect(js).toMatch(/ready = true;\s*afterRingEmail\(\);/);
    expect(js).toContain("u.searchParams.delete('contact_posted')");
    expect(js).toContain("action === 'keep-personalizing'");
  });

  it('keeps the welcome offer off ring-builder templates', () => {
    expect(themeFile('snippets/welcome-popup.liquid')).toContain("unless customer.tags contains 'welcome10' or template.suffix contains 'ring-builder'");
  });

  it('shows only the steps the builder owns and a mobile dock', () => {
    const flow = themeFile('sections/ring-builder-flow.liquid');
    expect(flow).not.toContain("ring_flow.checkout' | t }}</span>");
    expect(flow).toContain('data-flow-dock');
  });
});

describe('one ring builder', () => {
  it('sends setting entry points to /pages/ring-builder', () => {
    const header = themeFile('sections/header.liquid');
    expect(header).toContain('href="/pages/ring-builder?start=setting"');
    expect(header).toContain('href="/pages/ring-builder?start=diamond"');
    expect(themeFile('snippets/diamond-setting-picker.liquid')).toContain('{% if is_setting %}/pages/ring-builder?setting={{ ring.handle | url_encode }}&amp;diamond={{ product.handle | url_encode }}');
    expect(themeFile('snippets/ring-diamond-pairing.liquid')).toContain('href="/pages/ring-builder?setting={{ product.handle | url_encode }}"');
  });

  it('hands the older diamond search over, never the setting product pages', () => {
    const bar = themeFile('sections/ring-builder-bar.liquid');
    expect(bar).toContain('window.Shopify.designMode');
    // Every setting product uses product.ring-builder; its page must not redirect.
    expect(bar).toMatch(/\{%-? if template\.name == 'collection' -?%\}\s*<script>\s*\(function \(\) \{\s*if \(window\.Shopify && window\.Shopify\.designMode\) return;/);
    expect(bar).not.toContain('product.handle | json');
    expect(bar).toContain("location.replace('/pages/ring-builder?' + to.toString())");
  });
});

describe('theme validator and footer fixes', () => {
  it('keeps the header search script free of the parser trap and non-blocking', () => {
    const header = themeFile('sections/header.liquid');
    // A regex written /</g reads as a closing tag to Shopify's Liquid parser and hides every later error.
    expect(header).not.toContain('replace(/</g');
    expect(header).toContain("escapeSearch(q)");
    expect(header).toContain("<script src=\"{{ 'diamond-query.js' | asset_url }}\" defer></script>");
  });

  it('gives the product gallery image and footer logo their dimensions', () => {
    expect(themeFile('sections/main-product.liquid')).toContain('height="{{ media.preview_image.height | times: 1200 | divided_by: media.preview_image.width }}"');
    expect(themeFile('sections/footer.liquid')).toContain('width="200" height="{{ section.settings.logo.height | times: 200 | divided_by: section.settings.logo.width }}"');
  });

  it('lets the single footer column shrink so the signup button stays on screen', () => {
    expect(themeFile('sections/footer.liquid')).toMatch(/@media \(max-width: 576px\)[\s\S]*?\.footer__grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
  });
});
