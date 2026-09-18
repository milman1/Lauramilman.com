import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const section = themeFile('sections/ring-builder.liquid');
const template = JSON.parse(themeFile('templates/page.ring-builder.json'));
const main = template.sections.main;
const paths = Object.values(main.blocks).filter(
  (b): b is { type: string; settings: Record<string, unknown> } =>
    (b as { type: string }).type === 'path',
);

describe('ring builder paths', () => {
  it('offers complete rings, a natural build, and settings', () => {
    expect(paths).toHaveLength(3);
    expect(paths.map((b) => b.settings.collection)).toEqual([
      'engagement-rings',
      'natural-diamonds',
      'ring-settings',
    ]);
  });

  it('leads with complete rings, the deepest book', () => {
    expect(main.block_order[0]).toBe('path-complete');
    expect(paths[0]?.settings.featured).toBe(true);
    expect(paths[1]?.settings.featured).toBeUndefined();
    expect(paths[2]?.settings.featured).toBeUndefined();
  });

  it('keeps the natural path reachable when no stones are listed', () => {
    expect(paths[1]?.settings.fallback_url).toBe('/pages/private-clients');
  });

  it('hides the settings path instead of linking an empty collection', () => {
    expect(paths[2]?.settings.fallback_url).toBeUndefined();
    expect(paths[2]?.settings.cta_url).toBeUndefined();
  });
});

describe('ring builder section rendering rules', () => {
  it('renders a path only once it resolves to a destination', () => {
    expect(section).toContain('{%- if path_url != blank -%}');
    expect(section).toContain('assign path_url = block.settings.cta_url');
    expect(section).toContain('assign path_url = block.settings.fallback_url');
  });

  it('falls back to the collection link only while it holds products', () => {
    expect(section).toContain('if path_count > 0');
    expect(section).toContain('assign path_url = path_collection.url');
    expect(section).toContain('assign path_count = path_collection.products_count');
  });

  it('prints four- and five-figure stone counts with a thousands separator', () => {
    expect(section).toContain('assign count_thousands = path_count | divided_by: 1000');
    expect(section).toContain("| modulo: 1000 | prepend: '00' | slice: -3, 3");
    expect(section).toContain('{{ count_display }}');
  });

  it('states center-stone origin as a per-product fact, never per path', () => {
    const originNote = main.settings.origin_note as string;
    expect(originNote).toContain('lab-grown or natural');
    expect(originNote).toContain('product page');
    expect(section).toContain('origin_note');
  });

  it('never names a supplier on the page', () => {
    const copy = JSON.stringify(template) + section;
    expect(copy).not.toMatch(/sky[\s-]*lab/i);
    expect(copy).not.toMatch(/back[\s-]*vault/i);
  });
});

describe('stone-to-ring pairing request', () => {
  const diamondPdp = themeFile('sections/main-product-diamond.liquid');
  const themeJs = themeFile('assets/theme.js');

  it('puts the pairing request on the stone page itself', () => {
    expect(diamondPdp).toContain('data-chat-intent="setting"');
    expect(diamondPdp).toContain('Set this stone in a ring');
    expect(diamondPdp).toContain('js-open-product-chat');
    expect(diamondPdp).toContain('data-product-handle="{{ product.handle }}"');
  });

  it('names the stone in the composer instead of opening an empty chat', () => {
    expect(themeJs).toContain("if (intent === 'setting')");
    expect(themeJs).toContain('set in a ring');
    expect(themeJs).toContain("if (intent === 'setting') return 'Set this stone in a ring';");
  });

  it('leaves the shared inquiry pills alone', () => {
    const inquiry = themeFile('snippets/product-inquiry.liquid');
    expect(inquiry).not.toContain('data-chat-intent="setting"');
  });
});
