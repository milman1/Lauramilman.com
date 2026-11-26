import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const picker = readFileSync(new URL('../../snippets/diamond-setting-picker.liquid', import.meta.url), 'utf8');

describe('setting cards without a photo', () => {
  it('prefer the real photo, then a captioned six-prong drawing, then a plain placeholder', () => {
    const photo = picker.indexOf('{%- elsif ring.featured_image -%}');
    const drawing = picker.indexOf("{%- elsif ring.metafields.custom.setting_style.value contains 'Six-Prong' -%}");
    const placeholder = picker.indexOf('<span class="dsp__placeholder">Photo coming soon</span>');
    expect(photo).toBeGreaterThan(-1);
    expect(drawing).toBeGreaterThan(photo);
    expect(placeholder).toBeGreaterThan(drawing);
  });

  it('labels the drawing as an illustration and draws six prongs', () => {
    const svg = picker.match(/<svg class="dsp__drawing"[\s\S]*?<\/svg>/)?.[0] ?? '';
    expect(svg).toContain('aria-label="Illustration of a six-prong round solitaire setting, seen from above"');
    expect(svg.match(/r="15"/g)).toHaveLength(6);
    expect(picker).toContain('<small class="dsp__note dsp__caption">Illustration · photo coming soon</small>');
  });
});
