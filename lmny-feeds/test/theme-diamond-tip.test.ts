import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('diamond grade tips', () => {
  it('keeps the info bubble inside the filter panel', () => {
    const css = readFileSync(new URL('../../sections/diamond-filter.liquid', import.meta.url), 'utf8');
    const tip = css.slice(css.indexOf('.lm-dfilter__info::after {'), css.indexOf('.lm-dfilter__info:hover::after'));
    expect(tip).toContain('left: 0;');
    expect(tip).toContain('width: 260px;');
    expect(tip).toContain('max-width: calc(100vw - 3rem);');
    expect(tip).toContain('white-space: normal;');
    expect(tip).not.toContain('translateX(-50%)');
    expect(tip).not.toContain('width: 240px');
    expect(css).toContain('position: static;');
    const form = css.slice(css.indexOf('.lm-dfilter__form {'), css.indexOf('.lm-dfilter__origin {'));
    expect(form).toContain('overflow: visible;');
    expect(form).not.toContain('overflow: hidden;');
  });
});
