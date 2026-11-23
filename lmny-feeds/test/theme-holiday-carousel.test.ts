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

  it('leads the homepage and leaves the year-round hero in place', () => {
    expect(home.order[0]).toBe('holiday');
    expect(home.sections.holiday.type).toBe('holiday-carousel');
    expect(home.sections.hero.type).toBe('lmh-hero');
    expect(home.order.indexOf('hero')).toBe(1);
    expect(home.order.indexOf('private-clients')).toBe(home.order.length - 1);
  });

  it('keeps the offer copy inside the house rules', () => {
    const slides = home.sections.holiday.blocks ?? {};
    const copy = Object.values(slides).map((block) => JSON.stringify(block.settings)).join('\n');
    expect(copy).toContain('Twenty percent off jewelry');
    expect(copy).toContain('November 27 through December 1');
    expect(copy).toContain('Twenty percent off New watches');
    expect(copy).toContain('New Jacob & Co');
    expect(copy).toContain('Ship by December 22');
    expect(copy).toContain('New York City');
    expect(copy).toContain('/collections/all');
    expect(copy).toContain('/collections/jacob-co');
    expect(copy).toContain('/collections/lab-grown-diamond-jewelry');
    expect(copy).toContain('/collections/everyday-jewelry');
    expect(copy).toContain('holiday-velvet-desktop.webp');
    const velvet = slides['slide-velvet'].settings ?? {};
    const velvetCopy = [velvet.eyebrow, velvet.heading, velvet.subtext, velvet.image_alt, velvet.button_label].join('\n');
    expect(velvet.heading).toBe("The season's most brilliant gift");
    expect(velvet.subtext).toBe('Lab-grown diamond jewelry, chosen in New York City.');
    expect(velvet.image_alt).toBe('Diamond jewelry holiday display');
    expect(velvet.button_label).toBe('Shop diamond jewelry');
    expect(velvet.button_link).toBe('/collections/lab-grown-diamond-jewelry');
    expect(velvet.show_snow).toBe(true);
    expect(velvetCopy).not.toMatch(/velvet|on red/i);
    expect(slides['slide-jewelry'].settings?.show_snow).toBeUndefined();
    expect(copy).not.toMatch(/%|Diamond District|Midtown|private appointment|showroom/i);
    expect(copy).not.toMatch(/(?<!New )Jacob & Co/);
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
