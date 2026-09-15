import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('all-catalog PDP matches jewelry specifications layout', () => {
  const jewelry = themeFile('sections/main-product.liquid');
  const diamond = themeFile('sections/main-product-diamond.liquid');
  const standards = themeFile('docs/product-page-standards.md');
  const watchSchema = themeFile('lmny-feeds/docs/watch-listing-schema.md');

  it('prints a 2-column Specifications grid on jewelry and diamond PDPs', () => {
    expect(jewelry).toContain('<h2 class="pdp-specs__title">Specifications</h2>');
    expect(jewelry).toContain('class="product-specs"');
    expect(diamond).toContain('<h2 class="pdp-specs__title">Specifications</h2>');
    expect(diamond).toContain('class="product-specs"');
    expect(diamond).not.toContain('dpdp__specs-title');
  });

  it('renders a Description accordion on jewelry and diamond PDPs', () => {
    expect(jewelry).toContain('id="PdpDescription"');
    expect(jewelry).toContain('Description');
    expect(diamond).toContain('id="PdpDescription"');
    expect(diamond).toContain('accordion-trigger');
  });

  it('strips leftover Details lists and watch spec dumps from body HTML', () => {
    expect(jewelry).toContain("t === 'product details'");
    expect(jewelry).toContain('case size:');
    expect(jewelry).toContain("ul.querySelector('strong')");
    expect(diamond).toContain("ul.querySelector('strong')");
  });

  it('labels chain style and estate spec keys on the jewelry grid', () => {
    expect(jewelry).toContain("echo 'Chain Style'");
    expect(jewelry).toContain('metal_weight:Metal Weight');
    expect(jewelry).toContain('gemstones:Gemstones');
    expect(jewelry).toContain('era:Era');
    expect(jewelry).toContain("def_parts[0] == 'metal_type'");
  });

  it('documents one-paragraph body for every catalog including watches and diamonds', () => {
    expect(standards).toContain('Loose diamonds use the diamond template');
    expect(standards).toContain('Case size, Year, and bracelet links belong in the spec grid');
    expect(watchSchema).not.toContain('<strong>Case size:</strong>');
  });
});
