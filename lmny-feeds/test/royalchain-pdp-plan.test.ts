import { describe, expect, it } from 'vitest';
import { factsFromCatalogProduct, parseDetailRows, planToJsonl, royalChainPdpPlan } from '../scripts/royalchain-pdp-plan.js';

/** Two products in the shape of the live GraphQL catalog snapshot. */
const catalog = {
  data: {
    products: {
      nodes: [
        {
          id: 'gid://shopify/Product/1',
          handle: 'lmny-cuban-3-9-mm-nmc120',
          title: '3.9mm Cuban Chain Necklace in 14K Yellow Gold',
          descriptionHtml:
            '<section class="lmny-product-description"><p>This 3.9mm cuban necklace is crafted in 14K Yellow Gold and offered by Laura Milman New York.</p>\n<h2>Details</h2>\n<ul>\n<li>\n<strong>Material:</strong> 14K Yellow Gold</li>\n<li>\n<strong>Style:</strong> Cuban</li>\n<li>\n<strong>Width:</strong> 3.9 mm</li>\n<li>\n<strong>Available lengths:</strong> 18 in, 20 in, 22 in, 24 in, 26 in</li>\n<li>\n<strong>Closure:</strong> Box with Figure 8</li>\n<li>\n<strong>Finish:</strong> Polished</li>\n<li>\n<strong>Condition:</strong> New</li>\n</ul></section>',
          productType: 'Necklaces',
          variants: {
            nodes: [18, 20, 22, 24, 26].map((inches) => ({
              title: `14K Yellow - ${inches} in`,
              selectedOptions: [{ name: 'Metal and Length', value: `14K Yellow - ${inches} in` }],
            })),
          },
        },
        {
          id: 'gid://shopify/Product/2',
          handle: 'lmny-box-1-4-mm-box073-bracelet',
          title: '1.4mm Box Chain Bracelet in 14K Rose Gold',
          descriptionHtml:
            '<section class="lmny-product-description"><p>This 1.4mm box bracelet is crafted in 14K Rose Gold and offered by Laura Milman New York.</p>\n<h2>Details</h2>\n<ul>\n<li>\n<strong>Material:</strong> 14K Rose Gold</li>\n<li>\n<strong>Style:</strong> Box</li>\n<li>\n<strong>Width:</strong> 1.4 mm</li>\n<li>\n<strong>Available lengths:</strong> 8.5 in</li>\n<li>\n<strong>Closure:</strong> Lobster</li>\n<li>\n<strong>Construction:</strong> Solid</li>\n<li>\n<strong>Condition:</strong> New</li>\n</ul></section>',
          productType: 'Bracelets',
          variants: {
            nodes: [{ title: '14K Rose - 8.5 in', selectedOptions: [{ name: 'Metal and Length', value: '14K Rose - 8.5 in' }] }],
          },
        },
      ],
    },
  },
};

describe('Royal Chain PDP plan', () => {
  it('reads every Details row and the variant option lengths', () => {
    const rows = parseDetailRows(catalog.data.products.nodes[0]!.descriptionHtml);
    expect(rows).toMatchObject({ Material: '14K Yellow Gold', Style: 'Cuban', Width: '3.9 mm', Closure: 'Box with Figure 8', Finish: 'Polished', Condition: 'New' });
    expect(factsFromCatalogProduct(catalog.data.products.nodes[0]!).lengths).toEqual(['18 in', '20 in', '22 in', '24 in', '26 in']);
    expect(factsFromCatalogProduct(catalog.data.products.nodes[1]!).singularType).toBe('Bracelet');
  });

  it('plans one prose paragraph and a full Specifications grid per product', () => {
    const plan = royalChainPdpPlan(catalog);
    expect(plan.anomalies).toEqual([]);
    expect(plan.lines).toHaveLength(2);

    const [necklace, bracelet] = plan.lines;
    expect(necklace!.productId).toBe('gid://shopify/Product/1');
    expect(necklace!.descriptionHtml).toBe(
      '<p>This 3.9mm cuban chain necklace is crafted in 14K Yellow Gold and offered by Laura Milman New York. Finished polished and closed with a box with figure 8 clasp.</p>',
    );
    expect(necklace!.descriptionHtml).not.toMatch(/<h2>|<ul>|<li>|<section/);
    expect(necklace!.seo).toEqual({
      title: '3.9mm Cuban Chain Necklace in 14K Yellow Gold | Laura Milman',
      description: 'Shop the 3.9mm cuban chain necklace in 14K Yellow Gold, available in 18 to 26 in, from Laura Milman New York.',
    });
    expect(necklace!.metafields).toEqual([
      { namespace: 'custom', key: 'metal', type: 'single_line_text_field', value: '14K Yellow Gold' },
      { namespace: 'custom', key: 'link', type: 'single_line_text_field', value: 'Cuban' },
      { namespace: 'custom', key: 'width', type: 'single_line_text_field', value: '3.9 mm' },
      { namespace: 'custom', key: 'length', type: 'single_line_text_field', value: '18, 20, 22, 24, 26 in' },
      { namespace: 'custom', key: 'clasp', type: 'single_line_text_field', value: 'Box with Figure 8' },
      { namespace: 'custom', key: 'finish', type: 'single_line_text_field', value: 'Polished' },
      { namespace: 'custom', key: 'condition', type: 'single_line_text_field', value: 'New' },
      { namespace: 'custom', key: 'ebay_condition', type: 'single_line_text_field', value: '1500' },
    ]);

    // No Finish row and one length: no finish metafield, a single-length value, no span.
    expect(bracelet!.descriptionHtml).toBe(
      '<p>This 1.4mm box chain bracelet is crafted in 14K Rose Gold and offered by Laura Milman New York. Closed with a lobster clasp.</p>',
    );
    expect(bracelet!.metafields.map((metafield) => metafield.key)).toEqual(['metal', 'link', 'width', 'length', 'clasp', 'condition', 'ebay_condition']);
    expect(bracelet!.metafields.find((metafield) => metafield.key === 'length')!.value).toBe('8.5 in');
    expect(bracelet!.seo.description).toContain('available in 8.5 in');
    // Construction is dropped from the public listing.
    expect(JSON.stringify(bracelet)).not.toMatch(/construction|solid/i);

    for (const line of plan.lines) {
      expect(line.seo.title.length).toBeLessThanOrEqual(60);
      expect(line.seo.description.length).toBeLessThanOrEqual(160);
      expect(JSON.stringify(line)).not.toMatch(/royal\s*chain|metal_type|measurements|\$/i);
    }
    expect(planToJsonl(plan).trim().split('\n')).toHaveLength(2);
  });

  it('reports a missing required fact instead of inventing one', () => {
    const plan = royalChainPdpPlan({
      data: { products: { nodes: [{ id: 'gid://shopify/Product/3', handle: 'lmny-partial', productType: 'Necklaces', descriptionHtml: '<ul><li><strong>Material:</strong> 14K Yellow Gold</li></ul>', variants: { nodes: [] } }] } },
    });
    expect(plan.anomalies).toEqual([{ handle: 'lmny-partial', missing: ['link', 'width', 'length'] }]);
    expect(plan.lines[0]!.metafields.map((metafield) => metafield.key)).toEqual(['metal']);
  });

  it('rejects a supplier name reaching public copy', () => {
    expect(() =>
      royalChainPdpPlan({
        data: { products: { nodes: [{ id: 'gid://shopify/Product/4', handle: 'lmny-x', productType: 'Necklaces', descriptionHtml: '<ul><li><strong>Style:</strong> Royal Chain Cuban</li></ul>', variants: { nodes: [] } }] } },
      }),
    ).toThrow(/supplier name/i);
  });
});
