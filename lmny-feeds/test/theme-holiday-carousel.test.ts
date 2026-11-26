import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function themeJson(path: string): {
  sections: Record<string, { type?: string; settings?: Record<string, unknown>; block_order?: string[]; blocks?: Record<string, { settings?: Record<string, unknown> }> }>;
  order: string[];
} {
  return JSON.parse(themeFile(path).replace(/\/\*[\s\S]*?\*\//g, ''));
}

describe('homepage holiday carousel', () => {
  const section = themeFile('sections/holiday-carousel.liquid');
  const css = themeFile('assets/holiday-carousel.css');
  const script = themeFile('assets/holiday-carousel.js');
  const home = themeJson('templates/index.json');

  it('leads the homepage and does not render the year-round hero under the carousel', () => {
    expect(home.order[0]).toBe('holiday');
    expect(home.sections.holiday.type).toBe('holiday-carousel');
    expect(home.sections.hero.type).toBe('lmh-hero');
    expect(home.sections.hero.disabled).toBe(true);
    expect(home.order.indexOf('private-clients')).toBe(home.order.length - 1);
  });

  it('keeps the offer copy inside the house rules', () => {
    const slides = home.sections.holiday.blocks ?? {};
    const copy = Object.values(slides).map((block) => JSON.stringify(block.settings)).join('\n');
    expect(copy).toContain('Black Friday Sale');
    expect(copy).toContain('20% off all jewelry, now through December 1. Use code LMNY20.');
    expect(copy).toContain('20% off finished rings and settings with code LMNY20.');
    expect(copy).toContain('20% off diamond and gold earrings with code LMNY20.');
    expect(copy).toContain('20% off gold and diamond bracelets with code LMNY20.');
    expect(copy).toContain('20% off fine necklaces and pendants with code LMNY20.');
    expect(copy).toContain('Blue loose diamonds. 20% off any setting with code LMNY20.');
    expect(copy).toContain('Red loose diamonds. 20% off any setting with code LMNY20.');
    expect(copy).toContain('Green loose diamonds. 20% off any setting with code LMNY20.');
    expect(copy).toContain('Yellow loose diamonds. 20% off any setting with code LMNY20.');
    expect(copy).toContain('Ends December 1');
    expect(copy).toContain('Black Friday 20% off all jewelry with code LMNY20.');
    // Merchant 2026-11-26: the discount is shown as the number "20%", not spelled out.
    expect(copy).not.toMatch(/New York City|Christmas|December 22|percent/i);
    expect(copy).toContain('20% off vintage jewelry');
    expect(copy).toContain('/collections/vintage-jewelry');
    expect(copy).toContain('/collections/rings');
    expect(copy).toContain('/collections/all-earrings');
    expect(copy).toContain('/collections/all-bracelets');
    expect(copy).toContain('/collections/necklaces');
    expect(copy).not.toMatch(/watch|jacob/i);
    expect(copy).toContain('home-bracelets.webp');
    expect(copy).toContain('Blue, for the season');
    expect(copy).toContain('Red, for the holidays');
    expect(copy).toContain('Green, beside the diamonds');
    expect(copy).toContain('A warm yellow light');
    expect(copy).toContain('/collections/colored-lab-grown-diamonds');
    expect(copy).toContain('/collections/fancy-yellow-diamonds');
    expect(home.sections.holiday.block_order).toEqual([
      'slide-jewelry',
      'slide-rings',
      'slide-earrings',
      'slide-bracelets',
      'slide-necklaces',
      'slide-vintage',
      'slide-blue',
      'slide-red',
      'slide-green',
      'slide-yellow',
      'slide-velvet',
      'slide-gifts',
    ]);
    const images: Record<string, string> = {
      'slide-jewelry': 'holiday-velvet-desktop.webp',
      'slide-velvet': 'holiday-velvet-desktop.webp',
      'slide-vintage': 'holiday-velvet-desktop.webp',
      'slide-gifts': 'holiday-velvet-desktop.webp',
      'slide-rings': 'holiday-ring-desktop.webp',
      'slide-earrings': 'holiday-earrings-desktop.webp',
      'slide-bracelets': 'home-bracelets.webp',
      'slide-necklaces': 'holiday-necklace-desktop.webp',
      'slide-blue': 'holiday-blue-desktop.webp',
      'slide-red': 'holiday-red-desktop.webp',
      'slide-green': 'holiday-green-desktop.webp',
      'slide-yellow': 'holiday-yellow-desktop.webp',
    };
    for (const [id, image] of Object.entries(images)) {
      const slide = slides[id].settings ?? {};
      expect(slide.image_asset).toBe(image);
      if (image !== 'home-bracelets.webp') expect(String(slide.mobile_image_asset)).toMatch(/-mobile\.webp$/);
      expect(slide.show_snow).toBe(true);
      expect(String(slide.image_alt)).not.toMatch(/velvet|watch/i);
    }
    const velvet = slides['slide-velvet'].settings ?? {};
    expect(velvet.heading).toBe('20% off lab-grown diamond jewelry');
    expect(velvet.subtext).toBe('Lab-grown diamond rings, earrings, necklaces and bracelets. Use code LMNY20, now through December 1.');
    expect([velvet.eyebrow, velvet.heading, velvet.subtext, velvet.image_alt, velvet.button_label].join('\n')).not.toMatch(/velvet|on red/i);
    expect(copy).not.toMatch(/Diamond District|Midtown|private appointment|showroom/i);
  });

  it('is an editable, accessible carousel', () => {
    expect(section).toContain('"type": "image_picker", "id": "image"');
    expect(section).toContain('"id": "mobile_image"');
    expect(section).toContain('"id": "heading"');
    expect(section).toContain('"id": "subtext"');
    expect(section).toContain('"id": "button_label"');
    expect(section).toContain('"id": "button_link"');
    expect(section).toContain('aria-roledescription="carousel"');
    expect(section).toContain('aria-roledescription="slide"');
    expect(section).toContain('data-holiday-prev');
    expect(section).toContain('data-holiday-next');
    expect(section).toContain('data-holiday-dot');
    expect(section).toContain('data-holiday-pause');
    expect(section).toContain('loading="lazy"');
    expect(section).toContain('fetchpriority="high"');
    expect(css).toContain('aspect-ratio: 1440 / 640');
    expect(css).toContain('aspect-ratio: 390 / 560');
    expect(section).toContain('lm-holiday__snow');
    expect(section).toContain('show_snow');
    expect(css).toContain('lm-holiday-snow');
    expect(css).toContain('.lm-holiday__snow');
    expect(css).toContain('pointer-events: none');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('Cormorant Garamond');
    expect(script).toContain('prefers-reduced-motion');
    expect(script).toContain('mouseenter');
    expect(script).toContain('focusin');
    expect(script).toContain('pointerdown');
    expect(script).toContain("event.key === 'ArrowRight'");
  });
});
