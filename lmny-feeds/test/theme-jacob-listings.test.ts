import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Jacob & Co. Timepieces listing surfaces', () => {
  it('keeps the Timepieces dropdown on the live jacob-co collection', () => {
    const header = readFileSync(new URL('../../sections/header.liquid', import.meta.url), 'utf8');
    expect(header).toContain('/collections/jacob-co');
    expect(header).toContain('Jacob &amp; Co.');
    expect(header).not.toContain('/collections/jacob-co-watches');
  });

  it('renders New Vintage badges and diamond-weight spec rows on the PDP', () => {
    const pdp = readFileSync(new URL('../../sections/main-product.liquid', import.meta.url), 'utf8');
    expect(pdp).toContain("t contains 'new vintage'");
    expect(pdp).toContain("assign status_pill = 'New Vintage'");
    expect(pdp).toContain('diamond_weight:Diamond Weight');
  });
});
