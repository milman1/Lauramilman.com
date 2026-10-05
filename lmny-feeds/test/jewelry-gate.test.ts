import { describe, expect, it, vi } from 'vitest';
import { activateReviewed, digest, POLICY, REVIEW_CHECKS, reviewTemplate, validateActivation, validateDraftInput, type GateClient, type Review, type Snapshot } from '../src/jewelryGate.js';
import { validateJewelryCsv } from '../src/jewelryCsv.js';

const NOW = Date.parse('2026-10-05T12:00:00Z');
function fixture(): { snapshot: Snapshot; review: Review } {
  const snapshot: Snapshot = { shopId: 'gid://shopify/Shop/1', currencyCode: 'USD', product: {
    id: 'gid://shopify/Product/1', handle: 'lab-grown-tennis-bracelet', status: 'DRAFT', updatedAt: '2026-10-05T11:00:00Z',
    title: 'Lab-Grown Diamond Tennis Bracelet in 14K White Gold', descriptionHtml: '<p>Lab-grown diamond tennis bracelet set in 14K white gold.</p>',
    productType: 'Bracelets', vendor: 'Laura Milman New York', tags: ['Lab Grown Diamond'], templateSuffix: null,
    seo: { title: 'Lab-Grown Diamond Tennis Bracelet | 14K White Gold', description: `Lab-grown diamond tennis bracelet in 14K white gold. ${POLICY}` },
    category: { id: 'gid://shopify/TaxonomyCategory/aa-6-3', fullName: 'Apparel & Accessories > Jewelry > Bracelets' },
    variants: { nodes: [{ id: 'gid://shopify/ProductVariant/1', sku: 'TEST-001', price: '246.90', inventoryQuantity: 1, inventoryPolicy: 'DENY', selectedOptions: [{ name: 'Title', value: 'Default Title' }], inventoryItem: { tracked: true, unitCost: { amount: '123.45', currencyCode: 'USD' } } }], pageInfo: { hasNextPage: false } },
    media: { nodes: ['VIDEO', 'IMAGE', 'IMAGE', 'IMAGE'].map((type, i) => ({ id: `media-${i}`, alt: 'Diamond tennis bracelet detail', mediaContentType: type, status: 'READY' })), pageInfo: { hasNextPage: false } },
    metafields: { nodes: [{ namespace: 'custom', key: 'metal', value: '14K White Gold', type: 'single_line_text_field' }], pageInfo: { hasNextPage: false } },
    resourcePublicationsV2: { nodes: [], pageInfo: { hasNextPage: false } },
  } };
  const review = reviewTemplate(snapshot, NOW);
  Object.assign(review, { kind: 'lab-grown', source: 'skylab', sourceEvidence: 'Private exact SKU source record', reviewedBy: 'Test reviewer', merchantAuthorization: 'Test-only exact product instruction' });
  for (const key of REVIEW_CHECKS) review.checks[key] = 'Test fixture verified evidence';
  return { snapshot, review };
}
function renew(snapshot: Snapshot, review: Review): void { review.snapshotSha256 = digest(snapshot); }
function mockClient(snapshot: Snapshot, after?: Snapshot) {
  const final = after ?? { ...snapshot, product: { ...snapshot.product, status: 'ACTIVE', updatedAt: '2026-10-05T12:00:01Z' } };
  const gql = vi.fn().mockResolvedValueOnce({ shop: { id: snapshot.shopId, currencyCode: snapshot.currencyCode }, product: snapshot.product })
    .mockResolvedValueOnce({ productUpdate: { product: { id: snapshot.product.id, status: 'ACTIVE' }, userErrors: [] } })
    .mockResolvedValueOnce({ shop: { id: final.shopId, currencyCode: final.currencyCode }, product: final.product });
  return { gql } as GateClient & { gql: typeof gql };
}
describe('jewelry activation gate', () => {
  it('accepts a complete reviewed draft without inventing optional specs', () => {
    const { snapshot, review } = fixture(); expect(validateActivation(snapshot, review, NOW)).toEqual([]);
  });
  it('generates an unapproved template', () => {
    const { snapshot } = fixture(); expect(validateActivation(snapshot, reviewTemplate(snapshot, NOW), NOW).length).toBeGreaterThan(8);
  });
  it.each(['ACTIVE', 'ARCHIVED'])('never activates a %s product', async status => {
    const { snapshot, review } = fixture(); snapshot.product.status = status; renew(snapshot, review);
    const client = mockClient(snapshot); await expect(activateReviewed(client, review, NOW)).rejects.toThrow('Only DRAFT'); expect(client.gql).toHaveBeenCalledTimes(1);
  });
  it.each(['title', 'cost', 'media', 'inventory', 'shop', 'channels'])('rejects stale review after %s changes before any mutation', async field => {
    const { snapshot, review } = fixture();
    if (field === 'title') snapshot.product.title += ' revised';
    if (field === 'cost') snapshot.product.variants.nodes[0]!.inventoryItem.unitCost!.amount = '120';
    if (field === 'media') snapshot.product.media.nodes.reverse();
    if (field === 'inventory') snapshot.product.variants.nodes[0]!.inventoryQuantity = 2;
    if (field === 'shop') snapshot.shopId = 'gid://shopify/Shop/2';
    if (field === 'channels') snapshot.product.resourcePublicationsV2.nodes.push({ publication: { id: 'gid://shopify/Publication/1' } });
    const client = mockClient(snapshot); await expect(activateReviewed(client, review, NOW)).rejects.toThrow('exact fresh'); expect(client.gql).toHaveBeenCalledTimes(1);
  });
  it('rejects expired reviews and blank evidence', () => {
    const { snapshot, review } = fixture(); review.expiresAt = new Date(NOW).toISOString(); review.checks.desktopAndMobilePreview = '';
    expect(validateActivation(snapshot, review, NOW).join(' ')).toMatch(/unexpired.*desktopAndMobilePreview/);
  });
  it.each(['variants', 'media', 'metafields'] as const)('fails closed on partial %s', key => {
    const { snapshot, review } = fixture(); snapshot.product[key].pageInfo.hasNextPage = true; renew(snapshot, review);
    expect(validateActivation(snapshot, review, NOW)).toContainEqual(expect.stringContaining(`Incomplete ${key}`));
  });
  it('checks later variants, costs, SKUs and stock', () => {
    const { snapshot, review } = fixture(); const v = structuredClone(snapshot.product.variants.nodes[0]!);
    Object.assign(v, { id: 'gid://shopify/ProductVariant/2', sku: '', inventoryQuantity: 0 }); v.inventoryItem.unitCost = null;
    snapshot.product.variants.nodes.push(v); renew(snapshot, review);
    const errors = validateActivation(snapshot, review, NOW).join(' '); expect(errors).toMatch(/SKU/); expect(errors).toMatch(/Stock/); expect(errors).toMatch(/cost/);
  });
  it('requires both evidence and sellable configuration for made to order', () => {
    const { snapshot, review } = fixture(); const v = snapshot.product.variants.nodes[0]!; v.inventoryQuantity = 0; review.madeToOrder[v.id] = 'Verified made-to-order supplier record'; renew(snapshot, review);
    expect(validateActivation(snapshot, review, NOW).join(' ')).toMatch(/Stock/);
    v.inventoryPolicy = 'CONTINUE'; renew(snapshot, review); expect(validateActivation(snapshot, review, NOW)).toEqual([]);
  });
  it('requires Skylab video first and every media item ready', () => {
    const { snapshot, review } = fixture(); snapshot.product.media.nodes.shift(); renew(snapshot, review);
    expect(validateActivation(snapshot, review, NOW).join(' ')).toMatch(/Skylab product video/);
    snapshot.product.media.nodes.push({ id: 'v', alt: '', mediaContentType: 'VIDEO', status: 'PROCESSING' }); renew(snapshot, review);
    const errors = validateActivation(snapshot, review, NOW).join(' '); expect(errors).toMatch(/READY/); expect(errors).toMatch(/first/);
  });
  it('retains settings at 3× instead of the finished lab-grown 2×', () => {
    const { snapshot, review } = fixture(); review.kind = 'setting'; snapshot.product.tags = ['ring-setting'];
    snapshot.product.title = 'Diamond Ring Setting in 14K White Gold'; snapshot.product.productType = 'Ring Settings';
    snapshot.product.descriptionHtml = '<p>Diamond ring setting in 14K white gold. Center diamond not included.</p>';
    snapshot.product.seo.title = 'Diamond Ring Setting | 14K White Gold';
    snapshot.product.variants.nodes[0]!.price = '370'; renew(snapshot, review);
    expect(validateActivation(snapshot, review, NOW)).toEqual([]);
    snapshot.product.variants.nodes[0]!.price = '246.90'; renew(snapshot, review); expect(validateActivation(snapshot, review, NOW).join(' ')).toMatch(/source rule/);
  });
  it.each(['Watches', 'Vintage Rings', 'Loose Diamonds', 'Lab-Grown Diamond', 'Pre-Owned Bracelets'])('rejects excluded %s', type => {
    const { snapshot, review } = fixture(); snapshot.product.productType = type; renew(snapshot, review); expect(validateActivation(snapshot, review, NOW).join(' ')).toMatch(/Excluded category/);
  });
  it('blocks bad SEO, embedded media, public supplier details and contradictory aliases', () => {
    const { snapshot, review } = fixture(); snapshot.product.seo.title = 'x'.repeat(61); snapshot.product.descriptionHtml += '<iframe></iframe>'; snapshot.product.vendor = 'Skylab';
    snapshot.product.metafields.nodes.push({ namespace: 'custom', key: 'metal_type', value: '18K Yellow Gold', type: 'single_line_text_field' }); renew(snapshot, review);
    const errors = validateActivation(snapshot, review, NOW).join(' '); for (const pattern of [/SEO title/, /paragraph/, /Supplier/, /Conflicting/]) expect(errors).toMatch(pattern);
  });
  it('activates only the exact approved product and independently verifies', async () => {
    const { snapshot, review } = fixture(); const client = mockClient(snapshot); await activateReviewed(client, review, NOW);
    expect(client.gql).toHaveBeenCalledTimes(3); expect(client.gql.mock.calls[1]![1]).toEqual({ product: { id: snapshot.product.id, status: 'ACTIVE' } });
  });
  it('reports failed readback without claiming success or attempting more writes', async () => {
    const { snapshot, review } = fixture(); const after = structuredClone(snapshot); after.product.status = 'ACTIVE'; after.product.variants.nodes[0]!.price = '1';
    const client = mockClient(snapshot, after); await expect(activateReviewed(client, review, NOW)).rejects.toThrow('may be ACTIVE'); expect(client.gql).toHaveBeenCalledTimes(3);
  });
});

const CSV_HEADER = ['Handle','Title','Body (HTML)','SEO Title','SEO Description','Type','Product Category','Variant SKU','Variant Inventory Tracker','Variant Inventory Qty','Variant Inventory Policy','Status','Published','Variant Price','Image Src','Image Alt Text','Option1 Value','Tags'];
const csvRow = (row: string[]) => row.map(x => `"${x.replaceAll('"','""')}"`).join(',');
function draftCsv(): string[][] {
  return [CSV_HEADER, ['ring','Gold Ring','<p>Gold ring in 14K yellow gold.</p>','Gold Ring | Laura Milman',`Gold ring in 14K yellow gold. ${POLICY}`,'Rings','Apparel & Accessories > Jewelry > Rings','TEST-1','shopify','1','deny','draft','false','100','https://example.com/1.jpg','Gold ring front','Default Title',''], ...['2','3'].map(n => CSV_HEADER.map(h => h === 'Handle' ? 'ring' : h === 'Image Src' ? `https://example.com/${n}.jpg` : h === 'Image Alt Text' ? 'Gold ring detail' : ''))];
}
describe('draft import preflight', () => {
  it('API creation refuses active status, existing IDs and later variants without SKUs', () => {
    const { snapshot } = fixture(); const p = snapshot.product;
    const input = { title: p.title, descriptionHtml: p.descriptionHtml, seo: p.seo, status: 'DRAFT', handle: p.handle, productType: p.productType, category: p.category!.id, vendor: p.vendor, tags: p.tags, metafields: p.metafields.nodes, variants: [{ sku: 'TEST-1', price: '246.90' }] };
    expect(validateDraftInput(input)).toEqual([]);
    expect(validateDraftInput({ ...input, status: 'ACTIVE', id: p.id, variants: [...input.variants, { price: '246.90' }] }).join(' ')).toMatch(/existing product.*DRAFT.*unique SKU/);
  });
  it('rejects a header-only CSV', () => expect(validateJewelryCsv(CSV_HEADER.join(','))).toContainEqual(expect.objectContaining({ field: 'file' })));
  it('accepts a structurally complete draft, including image continuation rows', () => expect(validateJewelryCsv(draftCsv().map(csvRow).join('\n'))).toEqual([]));
  it('rejects active or published imports even when a later row says draft', () => {
    const rows = draftCsv(); rows[1]![11] = 'active'; rows[1]![12] = 'true'; rows[2]![11] = 'draft';
    const errors = validateJewelryCsv(rows.map(csvRow).join('\n')); expect(errors.some(e => e.field === 'Status')).toBe(true); expect(errors.some(e => e.field === 'Published')).toBe(true);
  });
  it('catches missing SKU on a later variant', () => {
    const rows = draftCsv(); const variant = [...rows[1]!]; variant[7] = ''; variant[16] = 'Size 7'; rows.push(variant);
    expect(validateJewelryCsv(rows.map(csvRow).join('\n')).some(e => e.field === 'Variant SKU')).toBe(true);
  });
  it('fails malformed quoting', () => expect(validateJewelryCsv('Handle,Status\n"open')).toContainEqual(expect.objectContaining({ field: 'file' })));
});
