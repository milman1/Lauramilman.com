import { describe, expect, it } from 'vitest';
import {
  buildActivationSnapshot,
  canonicalJson,
  parseAvailabilityCsv,
  supplierScrubViolations,
  validatePlan,
  verifyFinalState,
  verifySnapshotChecksum,
} from '../src/royalchain/activation.js';

function product(handle: string, sku: string) {
  return {
    handle, title: '2mm Snake Chain Necklace in 14K Yellow Gold', descriptionHtml: '<p>Gold chain</p>', vendor: 'Laura Milman New York', productType: 'Necklaces', category: 'gid://shopify/TaxonomyCategory/aa-6-8', status: 'DRAFT', tags: ['Laura Milman New York', 'Necklaces', 'media-missing'], seo: { title: 'Snake chain | Laura Milman', description: 'Gold snake chain.' },
    metafields: [{ namespace: 'custom', key: 'condition', value: 'New' }, { namespace: 'custom', key: 'ebay_condition', value: '1500' }], variants: [{ sku, price: '300.00', inventoryPolicy: 'DENY', inventoryItem: { tracked: true, cost: '100.00', measurement: { weight: { value: 4.2, unit: 'GRAMS' } } } }],
  };
}

describe('Royal Chain activation plan gates', () => {
  it('parses an exact boolean availability manifest and rejects duplicates', () => {
    expect(parseAvailabilityCsv('child_sku,available\nA-18,yes\nB-20,false\n')).toEqual(new Map([['A-18', true], ['B-20', false]]));
    expect(() => parseAvailabilityCsv('child_sku,available\nA-18,yes\nA-18,no\n')).toThrow(/duplicate/i);
  });

  it('keeps the eBay tag out of the pre-review plan and requires source availability', () => {
    const one = product('lmny-snake-2-mm-ovsn200', 'OVSN200-18');
    expect(validatePlan([one]).blockers.map((b) => b.code)).toContain('availability-missing');
    one.tags.push('ebay');
    expect(validatePlan([one], new Map([['OVSN200-18', true]])).blockers.map((b) => b.code)).toContain('premature-ebay-tag');
  });

  it('binds a snapshot checksum and catches supplier leakage', () => {
    const plan = [product('lmny-safe', 'SAFE-18')];
    const snapshot = buildActivationSnapshot({ plan, planText: JSON.stringify(plan[0]), availability: new Map([['SAFE-18', true]]), availabilityText: 'child_sku,available\nSAFE-18,true\n', liveProducts: [] });
    expect(verifySnapshotChecksum(snapshot)).toBe(true);
    expect(supplierScrubViolations({ title: 'Royal-Chain necklace' })).toEqual(['$.title']);
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('fails final verification when human review has not completed', () => {
    const plan = [product('lmny-safe', 'SAFE-18')];
    const snapshot = buildActivationSnapshot({ plan, planText: JSON.stringify(plan[0]), availability: new Map([['SAFE-18', true]]), availabilityText: 'child_sku,available\nSAFE-18,true\n', liveProducts: [] });
    const result = verifyFinalState(snapshot, [{ ...plan[0], category: { id: 'gid://shopify/TaxonomyCategory/aa-6-8' }, metafields: { nodes: plan[0]!.metafields ?? [] }, id: 'gid://shopify/Product/1', status: 'DRAFT', resourcePublications: { nodes: [] }, media: { nodes: [] }, variants: { nodes: [{ sku: 'SAFE-18', price: '300.00', inventoryQuantity: 0, inventoryPolicy: 'DENY', inventoryItem: { tracked: true, measurement: { weight: { value: 4.2, unit: 'GRAMS' } } } }] } }]);
    expect(result.blockers.map((b) => b.code)).toEqual(expect.arrayContaining(['status', 'online-store', 'ebay-tag', 'media-count', 'inventory-quantity']));
  });
});
