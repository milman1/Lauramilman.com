import { describe, expect, it } from 'vitest';
import {
  buildActivationSnapshot,
  canonicalJson,
  finalVerificationExitCode,
  parseAvailabilityCsv,
  sha256Text,
  supplierScrubViolations,
  validatePlan,
  validateReviewedSnapshot,
  verifyFinalState,
  verifySnapshotChecksum,
} from '../src/royalchain/activation.js';

function product(handle: string, sku: string) {
  return {
    handle, title: '2mm Snake Chain Necklace in 14K Yellow Gold', descriptionHtml: '<p>Gold chain</p>', vendor: 'Laura Milman New York', productType: 'Necklaces', category: 'gid://shopify/TaxonomyCategory/aa-6-8', status: 'DRAFT', tags: ['Laura Milman New York', 'Necklaces', 'media-missing'], seo: { title: 'Snake chain | Laura Milman', description: 'Gold snake chain.' },
    metafields: [{ namespace: 'custom', key: 'condition', value: 'New' }, { namespace: 'custom', key: 'ebay_condition', value: '1500' }], variants: [{ sku, price: '300.00', inventoryPolicy: 'DENY', inventoryItem: { tracked: true, cost: '100.00', measurement: { weight: { value: 4.2, unit: 'GRAMS' } } } }],
  };
}

function reviewedFixture() {
  const plan = Array.from({ length: 32 }, (_, productIndex) => {
    const item = product(`lmny-reviewed-${productIndex}`, `RC-${productIndex}-01`);
    item.variants = Array.from({ length: productIndex < 29 ? 3 : 2 }, (_, variantIndex) => ({
      sku: `RC-${productIndex}-${String(variantIndex + 1).padStart(2, '0')}`,
      price: `${300 + variantIndex}.00`, inventoryPolicy: 'DENY',
      inventoryItem: { tracked: true, cost: `${100 + variantIndex}.00`, measurement: { weight: { value: 4.2 + variantIndex, unit: 'GRAMS' } } },
    }));
    return item;
  });
  const availability = new Map(plan.flatMap((item) => item.variants.map((variant) => [variant.sku, true] as const)));
  const live = plan.map((item) => ({
    ...item,
    id: `gid://shopify/Product/${item.handle}`,
    category: { id: item.category },
    metafields: { nodes: item.metafields },
    media: { nodes: [1, 2, 3].map((n) => ({ status: 'READY', mediaContentType: 'IMAGE', alt: `${item.title} view ${n}`, image: { url: `https://cdn.shopify.com/s/files/1/${item.handle}-${n}.jpg` } })) },
    variants: { nodes: item.variants.map((variant) => ({ sku: variant.sku, price: variant.price, inventoryQuantity: 0, inventoryPolicy: variant.inventoryPolicy, inventoryItem: { tracked: true, unitCost: { amount: variant.inventoryItem.cost }, measurement: variant.inventoryItem.measurement } })) },
    resourcePublications: { nodes: [] },
  }));
  const planText = plan.map((item) => JSON.stringify(item)).join('\n');
  const availabilityText = `child_sku,available\n${[...availability].map(([sku, value]) => `${sku},${value}`).join('\n')}\n`;
  return { plan, liveProducts: live, availability, planText, availabilityText };
}

function resign<T extends { snapshotSha256: string }>(snapshot: T): T {
  const { snapshotSha256: _old, ...unsigned } = snapshot;
  return { ...snapshot, snapshotSha256: sha256Text(canonicalJson(unsigned)) };
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
    expect(result.activationGaps.map((b) => b.code)).toEqual(expect.arrayContaining(['status', 'online-store', 'ebay-tag', 'inventory-quantity']));
    expect(result.blockers.map((b) => b.code)).toContain('media-count');
  });

  it('builds a clean 32-product snapshot while keeping human activation gaps separate', () => {
    const fixture = reviewedFixture();
    const snapshot = buildActivationSnapshot({ ...fixture });
    expect(snapshot.blockers).toEqual([]);
    expect(snapshot.activationGaps.map((gap) => gap.code)).toEqual(expect.arrayContaining(['status', 'online-store', 'ebay-tag', 'inventory-quantity']));
    expect(validateReviewedSnapshot(snapshot)).toEqual([]);
    expect(snapshot.targetProducts).toBe(32);
    expect(snapshot.targetVariants).toBe(93);
    expect(snapshot.availabilitySha256).toBeTruthy();
  });

  it('fails final verification for untouched Draft, unpublished, untagged, zero-quantity products', () => {
    const fixture = reviewedFixture();
    const snapshot = buildActivationSnapshot({ ...fixture });
    const result = verifyFinalState(snapshot, fixture.liveProducts);
    expect(result.blockers).toEqual([]);
    expect(result.activationGaps.map((gap) => gap.code)).toEqual(expect.arrayContaining(['status', 'online-store', 'ebay-tag', 'inventory-quantity']));
    expect(finalVerificationExitCode(result.blockers, result.activationGaps)).toBe(2);
  });

  it('blocks exact cost, weight unit, variant set, and media URL/alt drift during dry-run', () => {
    const fixture = reviewedFixture();
    const changed = fixture.liveProducts[0]!;
    changed.media!.nodes![0]!.image!.url = 'https://supplier.invalid/image.jpg';
    changed.media!.nodes![1]!.alt = '';
    changed.variants!.nodes![0]!.inventoryItem!.unitCost!.amount = '999.00';
    changed.variants!.nodes![1]!.inventoryItem!.measurement!.weight!.unit = 'KILOGRAMS';
    changed.variants!.nodes!.push({ ...changed.variants!.nodes![2]!, sku: 'RC-extra' });
    const snapshot = buildActivationSnapshot({ ...fixture });
    expect(snapshot.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining(['media-url', 'media-alt', 'variant-count', 'variant-set', 'variant-facts']));
  });

  it('rejects a tampered or incomplete reviewed snapshot before final verification', () => {
    const fixture = reviewedFixture();
    const snapshot = buildActivationSnapshot({ ...fixture });
    snapshot.targets[0]!.handle = snapshot.targets[1]!.handle;
    expect(validateReviewedSnapshot(snapshot).map((blocker) => blocker.code)).toEqual(expect.arrayContaining(['snapshot-checksum', 'snapshot-handle-set']));
    const missingAvailability = { ...buildActivationSnapshot({ ...fixture }), availabilitySha256: null };
    expect(validateReviewedSnapshot(missingAvailability).map((blocker) => blocker.code)).toContain('snapshot-availability');
  });

  it('rejects swapped, missing, extra, and non-boolean per-target availability maps', () => {
    const fixture = reviewedFixture();
    const cases = [
      (snapshot: ReturnType<typeof buildActivationSnapshot>) => { snapshot.targets[0]!.sourceAvailable = { ...snapshot.targets[1]!.sourceAvailable }; },
      (snapshot: ReturnType<typeof buildActivationSnapshot>) => { delete snapshot.targets[0]!.sourceAvailable[snapshot.targets[0]!.publicExpected.variants[0]!.sku]; },
      (snapshot: ReturnType<typeof buildActivationSnapshot>) => { snapshot.targets[0]!.sourceAvailable.EXTRA = true; },
      (snapshot: ReturnType<typeof buildActivationSnapshot>) => { (snapshot.targets[0]!.sourceAvailable as Record<string, unknown>)[snapshot.targets[0]!.publicExpected.variants[0]!.sku] = 'yes'; },
    ];
    for (const mutate of cases) {
      const snapshot = buildActivationSnapshot({ ...fixture });
      mutate(snapshot);
      const codes = validateReviewedSnapshot(resign(snapshot)).map((blocker) => blocker.code);
      expect(codes).toContain('snapshot-target-availability');
    }
  });

  it('passes final verification only after the person-run activation fields are complete', () => {
    const fixture = reviewedFixture();
    const snapshot = buildActivationSnapshot({ ...fixture });
    const finalLive = fixture.liveProducts.map((item) => ({
      ...item,
      status: 'ACTIVE',
      tags: item.tags.filter((tag) => tag !== 'media-missing').concat('ebay'),
      resourcePublications: { nodes: [{ isPublished: true, publication: { name: 'Online Store' } }] },
      variants: { nodes: item.variants.nodes.map((variant) => ({ ...variant, inventoryQuantity: 1 })) },
    }));
    const result = verifyFinalState(snapshot, finalLive);
    expect(result.blockers).toEqual([]);
    expect(result.activationGaps).toEqual([]);
    expect(finalVerificationExitCode(result.blockers, result.activationGaps)).toBe(0);
  });

  it('rejects a final read whose Shopify product ID differs from the reviewed snapshot', () => {
    const fixture = reviewedFixture();
    const snapshot = buildActivationSnapshot({ ...fixture });
    const finalLive = fixture.liveProducts.map((item) => ({ ...item, id: item.id === snapshot.targets[0]!.productId ? 'gid://shopify/Product/drifted' : item.id }));
    expect(verifyFinalState(snapshot, finalLive).blockers.map((blocker) => blocker.code)).toContain('product-id');
  });
});
