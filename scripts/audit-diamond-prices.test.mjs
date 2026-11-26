import test from 'node:test';
import assert from 'node:assert/strict';
import { auditExitCode, sampleDisposition } from './audit-diamond-prices.mjs';

const archived = { handle: 'lg-820931', status: 'ARCHIVED', onlineStoreUrl: null };

test('an archived sample has no public page and is not a price failure', () => {
  assert.deepEqual(sampleDisposition(archived), { action: 'skip', detail: 'ARCHIVED product has no public page' });
  assert.equal(auditExitCode(['compared', 'skip']), 0);
});

test('a draft sample is skipped the same way', () => {
  assert.equal(sampleDisposition({ status: 'DRAFT', onlineStoreUrl: null }).action, 'skip');
});

test('an active product with no storefront URL still fails', () => {
  assert.deepEqual(sampleDisposition({ status: 'ACTIVE', onlineStoreUrl: null }), { action: 'fail', detail: 'missing storefront URL' });
  assert.equal(auditExitCode(['compared', 'fail']), 1);
});

test('a missing product still fails', () => {
  assert.equal(sampleDisposition(null).detail, 'missing in Shopify');
});

test('a public price match is compared, and a sample of only skips does not pass', () => {
  assert.equal(sampleDisposition({ status: 'ACTIVE', onlineStoreUrl: 'https://lauramilman.com/products/lg-1' }).action, 'compare');
  assert.equal(auditExitCode(['skip', 'skip']), 1);
  assert.equal(auditExitCode(['compared']), 0);
});
