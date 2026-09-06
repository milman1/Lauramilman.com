import { describe, expect, it } from 'vitest';
import {
  AUTH_LINE,
  GUARANTEE_WATCH,
  HOUSE_WATCH,
  applyBrandedTemplate,
  brandedDescriptionHtml,
  hasCanonicalBrandedFooter,
  listingKindFromProduct,
} from '../src/brandedDescription.js';

describe('brandedDescriptionHtml', () => {
  it('builds the watch template for future Shopify and eBay listings', () => {
    const html = brandedDescriptionHtml({
      opening:
        'This Pre-Owned Rolex Datejust 126334 from December 2022 is offered by Laura Milman New York with its original box and papers. It is in excellent condition.',
      kind: 'watch',
    });
    expect(html).toContain('is offered by Laura Milman New York with its original box and papers');
    expect(html).toContain(AUTH_LINE);
    expect(html).toContain(HOUSE_WATCH);
    expect(html).toContain(GUARANTEE_WATCH);
    expect(html).not.toMatch(/new with box/i);
    expect(html).not.toContain('http');
    expect(html).not.toContain('@');
    expect(html).not.toContain('<table>');
  });

  it('escapes copy and keeps optional notes before the branded footer', () => {
    const html = brandedDescriptionHtml({
      opening: 'This Tiffany & Co. estate bracelet is offered by Laura Milman New York.',
      notes: 'Serviced 2024 <see papers>',
      kind: 'jewelry',
    });
    expect(html).toContain('Tiffany &amp; Co.');
    expect(html).toContain('Serviced 2024 &lt;see papers&gt;');
    expect(html.indexOf('Serviced 2024')).toBeLessThan(html.indexOf(AUTH_LINE));
  });
});

describe('applyBrandedTemplate', () => {
  it('appends the footer to a one-line schema description', () => {
    const existing =
      '<p>This Pre-Owned Rolex Sea Dweller 16600 is offered by Laura Milman New York on its own, without box or papers. It is in excellent condition.</p>';
    const { html, changed } = applyBrandedTemplate(existing, 'watch');
    expect(changed).toBe(true);
    expect(html.startsWith(existing)).toBe(true);
    expect(hasCanonicalBrandedFooter(html, 'watch')).toBe(true);
    expect(applyBrandedTemplate(html, 'watch').changed).toBe(false);
  });

  it('does not repeat the auth line already present in unique estate copy', () => {
    const existing =
      '<p>Chopard Gabel ladies wristwatch in 18K yellow gold.</p><p>Crafted in 18K Yellow Gold, weighing 97.7 gr.. Authenticated and hand-inspected by Laura Milman New York, this pre-owned Chopard watch is offered in good condition.</p>';
    const { html, changed } = applyBrandedTemplate(existing, 'watch');
    expect(changed).toBe(true);
    expect(html.split(AUTH_LINE).length - 1).toBe(1);
    expect(html).toContain(HOUSE_WATCH);
    expect(html).toContain(GUARANTEE_WATCH);
    expect(applyBrandedTemplate(html, 'watch').changed).toBe(false);
  });
});

describe('listingKindFromProduct', () => {
  it('treats Watch product types as watches', () => {
    expect(listingKindFromProduct({ productType: 'Watch' })).toBe('watch');
    expect(listingKindFromProduct({ productType: 'Bracelets', tags: ['Cartier'] })).toBe('jewelry');
    expect(listingKindFromProduct({ productType: 'Jewelry', tags: ['Pre-Owned Watches'] })).toBe('watch');
  });
});
