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

  it('keeps a source-confirmed bracelet wrist size and metal weight', () => {
    const html = '<p>Writs size 6.25 inches.</p><strong>Metal Weight:</strong> 146.0 gr.<strong>Condition:</strong> Excellent.';
    const specs = extractSpecs('David Webb Elephant Bracelet', html);
    expect(specs.measurements).toBe('Wrist size 6.25 inches');
    expect(specs.metalWeight).toBe('146.0g');
    expect(specs.condition).toBe('Excellent');
  });

  it('keeps the length, the signature and a condition line that says more than a grade', () => {
    const html =
      '<div>Diamond and enamel bracelet; estimated total diamond weight: 2.30 carats. Length 7 inches.</div>' +
      '<br><strong>Signed:</strong> WEBB 18K David Webb' +
      '<br><strong>Condition:</strong> Enamel: very good, very minor loss where safety catch clips into link.' +
      '<br><strong>Stock:</strong> RR6485';
    const specs = extractSpecs('David Webb Blue Enamel And Diamond Bracelet', html);
    expect(specs.length).toBe('7 inches');
    expect(specs.signed).toBe('WEBB 18K David Webb');
    expect(specs.conditionNote).toBe('Enamel: very good, very minor loss where safety catch clips into link');
  });

  it('has no condition note for a bare grade, and no length when the supplier gives none', () => {
    const specs = extractSpecs('Cartier Ring', '<strong>Condition:</strong> Excellent.');
    expect(specs.condition).toBe('Excellent');
    expect(specs.conditionNote).toBeUndefined();
    expect(specs.length).toBeUndefined();
    expect(extractSpecs('Cartier Dolphin Ring', LABELED_HTML).conditionNote).toBe('Excellent. Custom engraving on the shank');
  });
});
