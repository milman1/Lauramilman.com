import { describe, expect, it } from 'vitest';
import { VENDOR_CATALOG_SYNC, type VendorCatalogConfig } from '../../config/pricing.js';
import { belongsToVendor, planVendor, WITHDRAWN_TAG, type OurProduct, type VendorProduct } from '../../src/vendors/plan.js';
import { fetchVendorCatalog } from '../../src/vendors/sync.js';

const alyce = VENDOR_CATALOG_SYNC.vendors.find((v) => v.key === 'alyce')!;
const eric = VENDOR_CATALOG_SYNC.vendors.find((v) => v.key === 'eric-originals')!;

const ring: VendorProduct = {
  id: 101, title: 'Halo Ring', handle: 'halo-ring',
  variants: [
    { id: 9001, sku: 'RNG1', price: '3140.00', available: true },
    { id: 9002, sku: 'RNG1', price: '3920.00', available: true },
  ],
};
const ours = (over: Partial<OurProduct> = {}): OurProduct => ({
  id: 'gid://shopify/Product/1', handle: 'halo-ring', title: 'Halo Ring', status: 'ACTIVE',
  tags: ['alyce-import', 'source-product-101'],
  variants: [
    { id: 'gid://shopify/ProductVariant/11', sku: 'ALYCE-9001', price: '3935.00' },
    { id: 'gid://shopify/ProductVariant/12', sku: 'ALYCE-9002', price: '3920.00' },
  ],
  ...over,
});

describe('vendor catalog sync plan', () => {
  it('matches the vendor price per variant, up or down, using the variant id in our SKU', () => {
    const plan = planVendor(alyce, [ring], [ours()]);
    expect(plan.matched).toBe(1);
    expect(plan.priceUpdates).toEqual([
      expect.objectContaining({ variantId: 'gid://shopify/ProductVariant/11', from: 3935, to: 3140 }),
    ]);
    expect(plan.drafts).toEqual([]);
  });

  it('drafts an active piece the vendor no longer lists or has sold out', () => {
    const gone = planVendor(alyce, [{ ...ring, id: 999 }], [ours({ tags: ['alyce-import', 'source-product-101'], variants: [{ id: 'v', sku: 'ALYCE-1', price: '10' }] })]);
    expect(gone.drafts).toEqual([expect.objectContaining({ reason: 'not_in_vendor_catalog' })]);
    const soldOut = planVendor(alyce, [{ ...ring, variants: ring.variants.map((v) => ({ ...v, available: false })) }], [ours()]);
    expect(soldOut.drafts).toEqual([expect.objectContaining({ reason: 'sold_out_at_vendor' })]);
  });

  it('never drafts or reactivates a draft, but reports one the sync withdrew that is available again', () => {
    const plan = planVendor(alyce, [ring], [ours({ status: 'DRAFT', tags: ['alyce-import', 'source-product-101', WITHDRAWN_TAG] })]);
    expect(plan.drafts).toEqual([]);
    expect(plan.availableAgain).toEqual(['halo-ring']);
  });

  it('never writes a zero "contact for pricing" price', () => {
    const plan = planVendor(alyce, [{ ...ring, variants: ring.variants.map((v) => ({ ...v, price: '0.00' })) }], [ours()]);
    expect(plan.priceUpdates).toEqual([]);
    expect(plan.noVendorPrice).toHaveLength(2);
  });

  it('holds a price move over 50% for review instead of writing it', () => {
    const plan = planVendor(alyce, [{ ...ring, variants: [{ ...ring.variants[0]!, price: '1000.00' }, ring.variants[1]!] }], [ours()]);
    expect(plan.priceUpdates).toEqual([]);
    expect(plan.priceHeld).toEqual([expect.objectContaining({ from: 3935, to: 1000 })]);
  });

  it('stops all drafting for a vendor when too much disappears at once', () => {
    const many = Array.from({ length: 10 }, (_, i) => ours({ id: `p${i}`, handle: `h${i}`, tags: ['alyce-import', `source-product-${500 + i}`],
      variants: [{ id: `v${i}`, sku: `ALYCE-${700 + i}`, price: '100' }] }));
    const plan = planVendor(alyce, [ring], many);
    expect(plan.drafts).toHaveLength(10);
    expect(plan.draftLimit).toBe(VENDOR_CATALOG_SYNC.minDraftBrake);
    expect(plan.draftBrake).toBe(true);
  });

  it('matches untagged legacy Eric Originals pieces by their SKU and nothing else', () => {
    const piece: VendorProduct = { id: 7, title: 'Brooch', handle: 'brooch', variants: [{ id: 70, sku: 'P3559', price: '45000.00', available: true }] };
    const mine: OurProduct = { id: 'e1', handle: 'vca-brooch', title: 'VCA Brooch', status: 'ACTIVE', tags: ['pre-owned'],
      variants: [{ id: 'ev1', sku: 'P3559', price: '45000.00' }] };
    const stranger: OurProduct = { ...mine, id: 'x', handle: 'other', variants: [{ id: 'xv', sku: 'P9999', price: '1.00' }] };
    expect(belongsToVendor(mine, eric)).toBe(true);
    expect(belongsToVendor(stranger, eric)).toBe(false);
    const plan = planVendor(eric, [piece], [mine, stranger]);
    expect(plan.ours).toBe(1);
    expect(plan.matched).toBe(1);
    expect(plan.priceUpdates).toEqual([]);
  });

  it('ignores an ambiguous vendor SKU instead of guessing', () => {
    const vendor: VendorCatalogConfig = { ...eric, legacySkus: ['DUP'] };
    const a: VendorProduct = { id: 1, title: 'A', handle: 'a', variants: [{ id: 1, sku: 'DUP', price: '10', available: true }, { id: 3, sku: 'X', price: '1', available: true }] };
    const b: VendorProduct = { id: 2, title: 'B', handle: 'b', variants: [{ id: 2, sku: 'DUP', price: '20', available: true }, { id: 4, sku: 'Y', price: '1', available: true }] };
    const mine: OurProduct = { id: 'o', handle: 'o', title: 'O', status: 'ACTIVE', tags: [], variants: [{ id: 'ov', sku: 'DUP', price: '15' }] };
    const plan = planVendor(vendor, [a, b], [mine]);
    expect(plan.priceUpdates).toEqual([]);
    expect(plan.drafts).toEqual([]);
    expect(plan.skipped).toEqual([expect.objectContaining({ handle: 'o' })]);
  });
});

describe('fetchVendorCatalog', () => {
  const page = (n: number) => ({ products: Array.from({ length: n }, (_, i) => ({ id: i, title: 't', handle: 'h', variants: [] })) });
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('reads every page until a short one', async () => {
    const bodies = [page(250), page(3)];
    const got = await fetchVendorCatalog('https://v.example', (async () => reply(bodies.shift())) as typeof fetch);
    expect(got).toHaveLength(253);
  });

  it('fails closed on an empty catalog or an HTTP error, so nothing is drafted', async () => {
    await expect(fetchVendorCatalog('https://v.example', (async () => reply(page(0))) as typeof fetch)).rejects.toThrow(/empty/);
    await expect(fetchVendorCatalog('https://v.example', (async () => reply({}, 404)) as typeof fetch)).rejects.toThrow(/HTTP 404/);
  });
});
