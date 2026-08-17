import { describe, expect, it } from 'vitest';
import { extractSpecs } from '../../src/backvault/specs.js';

const LABELED_HTML = `
<div>A striking Cartier ring in 18K yellow gold.</div>
<br><strong>Center Diamond Weight:</strong> 4.45
<br><strong>Metal Type:</strong> 18K Yellow Gold
<br><strong>Metal Weight:</strong> 15.5 gr.
<br><strong>Signed:</strong> Cartier
<br><strong>Condition:</strong> Excellent. Custom engraving on the shank.
<br><strong>Stock:</strong> J10605
<br><strong>Measurements:</strong> Size 6.5
`;

describe('extractSpecs', () => {
  it('prefers labeled PDP fields over regex', () => {
    const specs = extractSpecs('Cartier Dolphin Ring', LABELED_HTML);
    expect(specs.metalType).toBe('18K Yellow Gold');
    expect(specs.metalWeight).toBe('15.5g');
    expect(specs.diamondWeight).toBe('4.45ct');
    expect(specs.condition).toBe('Excellent');
    expect(specs.measurements).toBe('Size 6.5');
  });

  it('ignores a zero center-diamond weight and falls back to prose carats', () => {
    const html =
      '<p>pavé-set with approximately 1.70 carats of diamonds.</p>' +
      '<strong>Center Diamond Weight:</strong> 0.00<br><strong>Metal Type:</strong> 18K Yellow Gold';
    const specs = extractSpecs('Van Cleef & Arpels Alhambra Bracelet', html);
    expect(specs.diamondWeight).toBe('1.70ct');
    expect(specs.metalType).toBe('18K Yellow Gold');
  });

  it('title-cases era matches', () => {
    const specs = extractSpecs('Art Deco diamond brooch', '<p>A vintage piece from the art deco period.</p>');
    expect(specs.era?.toLowerCase()).toContain('art deco');
  });
});
