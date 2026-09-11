import { describe, expect, it } from 'vitest';
import { buildWatchConditionPlan, catalogDrift, catalogStockCandidates, desiredConditions, sourceWatchCondition, validatePlanSnapshot } from '../src/watchConditionRepair.js';

const catalog = (overrides = {}) => ({
  productId: 'gid://shopify/Product/1', handle: 'w-rw3096', sku: 'RW3096',
  ebayCondition: '1000', googleCondition: 'new', ...overrides,
});

describe('source-backed watch condition repair', () => {
  it('joins legacy RW handles and exact source stock references', () => {
    expect(catalogStockCandidates(catalog({ sku: '', handle: 'rw3096' }))).toContain('RW3096');
    const source = sourceWatchCondition({ Stock_no: 'RW3096', Condition: 'PRE OWNED', Box: 'YES', Paper: 'YES' })!;
    expect(buildWatchConditionPlan([source], [catalog({ sku: '', handle: 'rw3096' })], new Set(['RW3096']))[0]?.after)
      .toEqual({ ebayCondition: '3000', googleCondition: 'used' });
  });

  it('gates new conditions on authoritative state and explicit accessories', () => {
    expect(desiredConditions({ stockRef: '1', state: 'preowned', box: true, papers: true })).toEqual({ ebayCondition: '3000', googleCondition: 'used' });
    expect(desiredConditions({ stockRef: '2', state: 'unworn', box: true, papers: true })).toEqual({ ebayCondition: '1000', googleCondition: 'new' });
    expect(desiredConditions({ stockRef: '3', state: 'unworn', box: true, papers: false })).toEqual({ ebayCondition: '1500', googleCondition: 'new' });
    expect(desiredConditions({ stockRef: '4', state: 'unworn', box: null, papers: true })).toEqual({ ebayCondition: '1500', googleCondition: 'new' });
  });

  it('stops duplicate and ambiguous joins', () => {
    const one = { stockRef: 'RW1', state: 'preowned' as const, box: true, papers: true };
    expect(() => buildWatchConditionPlan([one, one], [catalog()], new Set(['RW1']))).toThrow(/duplicate source/);
    const sources = [one, { ...one, stockRef: 'RW2' }];
    expect(() => buildWatchConditionPlan(sources, [catalog({ sku: 'RW1', handle: 'w-rw2' })], new Set(['RW1', 'RW2'])))
      .toThrow(/conflicting catalog SKU\/handle identifiers/);
    expect(() => buildWatchConditionPlan([one], [catalog({ sku: 'OTHER', handle: 'w-rw1' })], new Set(['RW1'])))
      .toThrow(/conflicting catalog SKU\/handle identifiers/);
  });

  it('plans only changed condition values for allowed source watches', () => {
    const source = { stockRef: 'RW3096', state: 'preowned' as const, box: true, papers: true };
    const plan = buildWatchConditionPlan([source], [catalog()], new Set(['RW3096']));
    expect(plan).toEqual([expect.objectContaining({
      productId: 'gid://shopify/Product/1', stockRef: 'RW3096',
      before: { ebayCondition: '1000', googleCondition: 'new' },
      after: { ebayCondition: '3000', googleCondition: 'used' },
    })]);
    expect(Object.keys(plan[0]!.after).sort()).toEqual(['ebayCondition', 'googleCondition']);
    expect(() => buildWatchConditionPlan([source], [catalog()], new Set(['OTHER']))).toThrow(/0 allowed source/);
  });

  it('validates reviewed plan schema, unique IDs, age, and stock identity', () => {
    const now = Date.parse('2026-09-11T12:00:00Z');
    const row = {
      productId: 'gid://shopify/Product/1', handle: 'w-rw3096', sku: 'RW3096', stockRef: 'RW3096',
      before: { ebayCondition: '1000', googleCondition: 'new' },
      after: { ebayCondition: '3000', googleCondition: 'used' as const },
    };
    const snapshot = { schemaVersion: 1 as const, generatedAt: '2026-09-11T11:00:00Z', rows: [row] };
    expect(validatePlanSnapshot(snapshot, now)).toEqual(snapshot);
    expect(() => validatePlanSnapshot({ ...snapshot, rows: [row, row] }, now)).toThrow(/duplicate reviewed productId/);
    expect(() => validatePlanSnapshot({ ...snapshot, generatedAt: '2026-09-09T11:00:00Z' }, now)).toThrow(/stale/);
    expect(() => validatePlanSnapshot({ ...snapshot, rows: [{ ...row, stockRef: 'OTHER' }] }, now)).toThrow(/stock identity mismatch/);
    expect(() => validatePlanSnapshot({ ...snapshot, rows: [{ ...row, title: 'must not be allowed' }] }, now)).toThrow(/row schema/);
    expect(() => validatePlanSnapshot({ ...snapshot, rows: [{ ...row, after: { ebayCondition: 3000, googleCondition: 'used' } }] }, now)).toThrow(/condition value/);
    expect(() => validatePlanSnapshot({ ...snapshot, rows: [{ ...row, after: { ebayCondition: '3000', googleCondition: true } }] }, now)).toThrow(/condition value/);
    expect(() => validatePlanSnapshot({ ...snapshot, rows: [{ ...row, before: { ebayCondition: {}, googleCondition: 'new' } }] }, now)).toThrow(/before condition value/);
    expect(() => validatePlanSnapshot({ ...snapshot, rows: [{ ...row, before: { ebayCondition: '1000', googleCondition: [] } }] }, now)).toThrow(/before condition value/);
  });

  it('detects any pre-write identity, status-presence, or condition drift', () => {
    const plan = [{
      productId: 'gid://shopify/Product/1', handle: 'w-rw3096', sku: 'RW3096', stockRef: 'RW3096',
      before: { ebayCondition: '1000', googleCondition: 'new' },
      after: { ebayCondition: '3000', googleCondition: 'used' as const },
    }];
    expect(catalogDrift(plan, [catalog()])).toEqual([]);
    expect(catalogDrift(plan, [])).toEqual([expect.stringContaining('missing or inactive')]);
    expect(catalogDrift(plan, [catalog({ sku: 'OTHER' })])).toEqual([expect.stringContaining('SKU/handle changed')]);
    expect(catalogDrift(plan, [catalog({ ebayCondition: '3000' })])).toEqual([expect.stringContaining('condition values changed')]);
  });
});
