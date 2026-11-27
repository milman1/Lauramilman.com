import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

type Offer = {
  shippingDetails: { deliveryTime?: { handlingTime: { minValue: number; maxValue: number }; transitTime: { minValue: number; maxValue: number } } };
  hasMerchantReturnPolicy?: { returnPolicyCategory: string; merchantReturnDays?: number };
};

async function offerFor(type: string): Promise<Offer> {
  const liquid = new Liquid({ root: fileURLToPath(new URL('../../snippets/', import.meta.url)), extname: '.liquid' });
  liquid.registerFilter('json', (value) => JSON.stringify(value ?? null));
  const variant = { sku: 'TEST-1', url: '/products/sample?variant=1', price: 150000, available: true };
  const template = themeFile('snippets/structured-data-product.liquid').replace(/{% doc %}[\s\S]*?{% enddoc %}/, '');
  const html = await liquid.parseAndRender(template, {
    canonical_url: 'https://example.com/products/sample',
    shop: { url: 'https://example.com', name: 'LMNY', currency: 'USD' },
    current_variant: variant,
    product: { title: 'Sample', description: 'Test', images: [], type, tags: [], collections: [], variants: [variant], metafields: {} },
  });
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  return JSON.parse(block?.[1] ?? '').offers[0];
}

describe('loose diamond structured data matches the pages and refund policy', () => {
  it.each(['Lab-Grown Diamond', 'Natural Diamond'])('%s: 30-day returns and 1-2 day delivery', async (type) => {
    const offer = await offerFor(type);
    expect(offer.hasMerchantReturnPolicy?.returnPolicyCategory).toBe('https://schema.org/MerchantReturnFiniteReturnWindow');
    expect(offer.hasMerchantReturnPolicy?.merchantReturnDays).toBe(30);
    const t = offer.shippingDetails.deliveryTime!;
    expect([t.handlingTime.minValue, t.handlingTime.maxValue, t.transitTime.minValue, t.transitTime.maxValue]).toEqual([0, 0, 1, 2]);
  });

  it('gives jewelry the same returns but no delivery promise', async () => {
    const offer = await offerFor('Rings');
    expect(offer.hasMerchantReturnPolicy?.merchantReturnDays).toBe(14);
    expect(offer.shippingDetails.deliveryTime).toBeUndefined();
  });

  it('agrees with the copy shoppers read', () => {
    expect(themeFile('sections/main-product-diamond.liquid')).toContain('<li>30-day returns</li>');
    expect(themeFile('templates/page.shipping-returns.json')).toContain('within <strong>30 days of delivery</strong>');
  });
});
