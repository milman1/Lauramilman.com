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

  it('uses an explicit total diamond weight in prose when the center weight is zero', () => {
    const html =
      '<p>pavé-set with approximately 1.70 carats of diamonds.</p>' +
      '<strong>Center Diamond Weight:</strong> 0.00<br><strong>Metal Type:</strong> 18K Yellow Gold';
    const specs = extractSpecs('Van Cleef & Arpels Alhambra Bracelet', html);
    expect(specs.diamondWeight).toBe('1.70ct');
    expect(specs.metalType).toBe('18K Yellow Gold');
  });

  it('never turns the Cartier J10546 gold fineness into diamond weight', () => {
    const title = 'Cartier 18K Yellow Gold Octagonal Circa 2000 Cuff Links';
    const html =
      '<p>Double sided cufflinks in 18ct yellow gold with octagonal faces.</p>' +
      '<strong>Center Diamond Weight:</strong> 0.00<br>' +
      '<strong>Metal Type:</strong> 18K Yellow Gold<br>' +
      '<strong>Metal Weight:</strong> 19.9 gr.';
    const specs = extractSpecs(title, html);
    expect(specs.diamondWeight).toBeUndefined();
    expect(specs.metalType).toBe('18K Yellow Gold');
    expect(specs.metalWeight).toBe('19.9g');
  });

  it.each(['18ct white gold', '18 carat rose gold', '18-ct gold', '18ct yellow, white and rose gold'])(
    'skips %s and retains real prose diamond weight',
    (metal) => {
      expect(extractSpecs('Estate ring', `<p>Made of ${metal} with a 1.25ct diamond.</p>`).diamondWeight).toBe('1.25ct');
      expect(extractSpecs('Estate ring', `<p>Made of ${metal}.</p>`).diamondWeight).toBeUndefined();
    },
  );

  it('requires diamond evidence, not another gemstone weight, after explicit zero center weight', () => {
    const label = '<strong>Center Diamond Weight:</strong> 0ct';
    expect(extractSpecs('Estate 2ct sapphire ring in 18ct yellow gold', label).diamondWeight).toBeUndefined();
    const prose = '<p>18ct yellow gold with a 2ct sapphire and side diamonds weighing 0.35ct.</p>';
    expect(extractSpecs('Estate ring', prose + label).diamondWeight).toBe('0.35ct');
  });

  it('does not replace an explicit zero total weight with an unlabeled carat amount', () => {
    const html = '<strong>Total Diamond Weight:</strong> 0.00<br><p>Cut from 18ct rose gold with a 2ct ruby.</p>';
    expect(extractSpecs('Estate ring', html).diamondWeight).toBeUndefined();
  });

  it('rejects gold fineness accidentally entered in a diamond weight label', () => {
    expect(extractSpecs('Estate cufflinks', '<strong>Diamond Weight:</strong> 18ct yellow gold').diamondWeight).toBeUndefined();
    expect(extractSpecs('Estate ring', '<strong>Diamond Weight:</strong> 2.40 cttw').diamondWeight).toBe('2.40 cttw');
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
