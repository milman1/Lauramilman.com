import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertRoyalChainPublicScrubbed,
  buildRoyalChainProduct,
  ROYALCHAIN_CATEGORY,
  shopifyCdnMediaUrlsAfterImport,
} from '../src/royalchain/listing.js';
import { generateRoyalChainPlan } from '../src/royalchain/plan.js';

describe('Royal Chain listing builder', () => {
  it('builds a scrubbed DRAFT with exact variant prices and costs', () => {
    const product = buildRoyalChainProduct({ itemNumber: 'ABC1', style: 'Cuban', widthMm: '4', imageUrl: 'https://supplier.invalid/a.jpg', variants: [{ label: '14K Yellow:18in', costUsd: 100.01, sku: 'ABC1-18', weightGrams: 12.5, available: true }] });
    expect(product).toMatchObject({ status: 'DRAFT', vendor: 'Laura Milman New York', productType: 'Necklaces', category: ROYALCHAIN_CATEGORY });
    expect(product.tags).toContain('media-missing');
    expect(product.tags).not.toContain('ebay');
    const publicCopy = JSON.stringify({ title: product.title, body: product.descriptionHtml, seo: product.seo, tags: product.tags });
    expect(publicCopy).not.toMatch(/royal\s*chain/i);
    expect(JSON.stringify(product)).not.toMatch(/authenticated/i);
    expect(String((product.seo as { title: string }).title).length).toBeLessThanOrEqual(60);
    expect(String((product.seo as { description: string }).description).length).toBeLessThanOrEqual(160);
    expect(product.descriptionHtml).not.toMatch(/\$|price|cost/i);
    expect(product.variants).toEqual([expect.objectContaining({ price: '305.00', sku: 'ABC1-18', inventoryItem: expect.objectContaining({ tracked: true, cost: '100.01', measurement: { weight: { value: 12.5, unit: 'GRAMS' } } }) })]);
  });

  it('escapes source text and rejects supplier names', () => {
    const safe = buildRoyalChainProduct({ itemNumber: 'A&1', style: 'Box <Classic>', widthMm: '2', imageUrl: '', variants: [{ label: '14K Rose:18in', costUsd: 10 }] });
    expect(safe.descriptionHtml).toContain('&lt;classic&gt;');
    expect(() => buildRoyalChainProduct({ itemNumber: 'X', style: 'Royal Chain Cuban', widthMm: '2', imageUrl: '', variants: [{ label: '14K Yellow:18in', costUsd: 10 }] })).toThrow(/supplier name/i);
    expect(() => assertRoyalChainPublicScrubbed({ metafields: [{ value: 'royalchain.com' }], ebay: { Style: 'Royal-Chain' } })).toThrow(/supplier name/i);
  });

  it('builds structured copy, deduped media, and eBay item specifics from source facts', () => {
    const product = buildRoyalChainProduct({
      itemNumber: 'CUBAN-4',
      style: 'Cuban',
      widthMm: '4',
      imageUrl: 'https://supplier.invalid/hero.jpg',
      imageUrls: [
        'https://supplier.invalid/hero.jpg',
        'https://supplier.invalid/detail.jpg',
        'https://supplier.invalid/on-body.jpg',
      ],
      condition: { state: 'new', evidence: 'Source product record expressly states new.', originalPackagingEvidence: 'Source record expressly confirms original retail packaging.' },
      variants: [
        { label: '14K Yellow:18in', costUsd: 100, sku: 'CUBAN-4-18', weightGrams: 11.2, available: true },
        { label: '14K Yellow:20in', costUsd: 101, sku: 'CUBAN-4-20', weightGrams: 12.7, available: true },
      ],
    }) as Record<string, any>;

    expect(product.descriptionHtml).toContain('<h2>Details</h2>');
    expect(product.descriptionHtml).toContain('<strong>Available lengths:</strong> 18 in, 20 in');
    expect(product.descriptionHtml).toContain('<strong>Material:</strong> 14K Yellow Gold');
    expect(product.files).toHaveLength(3);
    expect(product.tags).not.toContain('media-missing');
    expect(product.tags).not.toContain('ebay'); // DRAFT plans never activate a sales channel.
    expect(product.ebay).toMatchObject({
      eligible: true,
      title: expect.any(String),
      itemSpecifics: expect.objectContaining({
        Material: 'Gold',
        Metal: '14K Yellow Gold',
        Style: 'Cuban',
        'Chain Type': 'Cuban',
        Length: '18 in, 20 in',
        'Condition ID': '1000',
      }),
      itemSpecificMapping: expect.objectContaining({ 'Condition ID': 'custom.ebay_condition' }),
    });
    expect(product.ebay.title.length).toBeLessThanOrEqual(80);
    expect(product.metafields).toContainEqual(expect.objectContaining({ key: 'ebay_condition', value: '1000' }));
    expect(JSON.stringify({ descriptionHtml: product.descriptionHtml, ebay: product.ebay, metafields: product.metafields })).not.toMatch(/box|papers/i);
  });

  it('uses New Other unless original packaging evidence is explicit', () => {
    const product = buildRoyalChainProduct({
      itemNumber: 'NEW-OTHER', style: 'Box', widthMm: '2', imageUrls: ['https://supplier.invalid/1.jpg', 'https://supplier.invalid/2.jpg', 'https://supplier.invalid/3.jpg'],
      condition: { state: 'new', evidence: 'Source record states new.' },
      variants: [{ label: '14K Yellow:18in', costUsd: 10, sku: 'NEW-OTHER-18', weightGrams: 4.2, available: true }],
    }) as Record<string, any>;
    expect(product.ebay.itemSpecifics['Condition ID']).toBe('1500');
    expect(product.metafields).toContainEqual(expect.objectContaining({ key: 'ebay_condition', value: '1500' }));
  });

  it('splits bracelet and necklace variants, with unique handles and category-correct eBay types', async () => {
    const { buildRoyalChainProducts } = await import('../src/royalchain/listing.js');
    const products = buildRoyalChainProducts({
      itemNumber: 'MIXED', style: 'Curb', widthMm: '3', imageUrls: ['https://supplier.invalid/1.jpg', 'https://supplier.invalid/2.jpg', 'https://supplier.invalid/3.jpg'],
      condition: { state: 'preowned', evidence: 'Source record states pre-owned.' },
      variants: [
        { label: '14K Yellow:10in', costUsd: 10, sku: 'MIXED-10', weightGrams: 5, available: true },
        { label: '14K Yellow:18in', costUsd: 12, sku: 'MIXED-18', weightGrams: 8, available: true },
      ],
    }) as Array<Record<string, any>>;
    expect(products).toHaveLength(2);
    expect(products.map((product) => product.handle)).toEqual(['lmny-mixed-bracelet', 'lmny-mixed-necklace']);
    expect(products.map((product) => product.productType)).toEqual(['Bracelets', 'Necklaces']);
    expect(products.map((product) => product.ebay.itemSpecifics.Type)).toEqual(['Bracelet', 'Necklace']);
  });

  it('fails closed for eBay until all image, content, and condition gates are met', () => {
    const product = buildRoyalChainProduct({
      itemNumber: 'BASIC-2',
      style: 'Box',
      widthMm: '2',
      imageUrls: ['https://supplier.invalid/one.jpg', 'https://supplier.invalid/two.jpg'],
      variants: [{ label: '14K Rose:18in', costUsd: 10 }],
    }) as Record<string, any>;

    expect(product.status).toBe('DRAFT');
    expect(product.tags).toContain('media-missing');
    expect(product.ebay.eligible).toBe(false);
    expect(product.ebay.blockers).toEqual(expect.arrayContaining([
      'requires at least 3 source images',
      'requires source-backed condition evidence',
      'requires unique supplier child SKU for every variant',
      'requires exact positive gram weight for every variant',
      'requires explicit supplier availability for every variant',
    ]));
    expect(product.metafields).not.toContainEqual(expect.objectContaining({ key: 'ebay_condition' }));
  });

  it('keeps only Shopify CDN media URLs in post-import records', () => {
    expect(shopifyCdnMediaUrlsAfterImport([
      'https://supplier.invalid/hero.jpg',
      'https://cdn.shopify.com/s/files/1/123/files/hero.jpg?v=1',
      'https://cdn.shopify.com/s/files/1/123/files/hero.jpg?v=1',
    ])).toEqual(['https://cdn.shopify.com/s/files/1/123/files/hero.jpg?v=1']);
  });

  it('generates an idempotent reviewed-size plan without Shopify writes', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'royal-plan-'));
    const shortlist = path.join(dir, 'shortlist.csv');
    const privateFile = path.join(dir, 'private.csv');
    await writeFile(shortlist, 'style,item_number,width_mm,url,image_url,image_urls,condition,condition_evidence\nCuban,A1,4,https://example.test/a,https://supplier.invalid/a.jpg,https://supplier.invalid/a.jpg;https://supplier.invalid/a-detail.jpg;https://supplier.invalid/a-on-body.jpg,new,Source record states new.\nBox,B2,2,https://example.test/b,https://supplier.invalid/b.jpg,,,\n');
    await writeFile(privateFile, 'item_number,url,cost,retail,lengths_karats,error\nA1,https://example.test/a,10.00,30.00,14K Yellow:18in=$10.00|A1-18|5.1|yes;14K Yellow:20in=$11.00|A1-20|5.8|yes,\nB2,https://example.test/b,20.01,65.00,14K Rose:18in=$20.01|B2-18|4.2|yes,\n');
    const opts = { shortlistPath: shortlist, privatePath: privateFile, outputDir: dir, expectedProducts: 2, expectedVariants: 3 };
    await expect(generateRoyalChainPlan(opts)).resolves.toEqual({ products: 2, variants: 3 });
    const first = await readFile(path.join(dir, 'royalchain-products.jsonl'), 'utf8');
    await generateRoyalChainPlan(opts);
    expect(await readFile(path.join(dir, 'royalchain-products.jsonl'), 'utf8')).toBe(first);
    expect(first.trim().split('\n')).toHaveLength(2);
    expect((await readFile(path.join(dir, 'royalchain-products.csv'), 'utf8')).trim().split('\n')).toHaveLength(4);
    const firstProduct = JSON.parse(first.split('\n')[0]!);
    expect(firstProduct.files).toHaveLength(3);
    expect(firstProduct.ebay.eligible).toBe(true);
    expect(firstProduct.tags).not.toContain('ebay');
  });
});
