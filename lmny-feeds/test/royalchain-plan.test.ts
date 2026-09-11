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
    const product = buildRoyalChainProduct({ itemNumber: 'ABC1', style: 'Cuban', widthMm: '4', imageUrl: 'https://supplier.invalid/a.jpg', variants: [{ label: '14K Yellow:18in', costUsd: 100.01 }] });
    expect(product).toMatchObject({ status: 'DRAFT', vendor: 'Laura Milman New York', productType: 'Necklaces', category: ROYALCHAIN_CATEGORY });
    expect(product.tags).toContain('media-missing');
    expect(product.tags).not.toContain('ebay');
    const publicCopy = JSON.stringify({ title: product.title, body: product.descriptionHtml, seo: product.seo, tags: product.tags });
    expect(publicCopy).not.toMatch(/royal\s*chain/i);
    expect(JSON.stringify(product)).not.toMatch(/authenticated/i);
    expect(String((product.seo as { title: string }).title).length).toBeLessThanOrEqual(60);
    expect(String((product.seo as { description: string }).description).length).toBeLessThanOrEqual(160);
    expect(product.descriptionHtml).not.toMatch(/\$|price|cost/i);
    expect(product.variants).toEqual([expect.objectContaining({ price: '305.00', sku: 'ABC1', inventoryItem: expect.objectContaining({ tracked: true, cost: '100.01' }) })]);
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
      condition: { state: 'new', evidence: 'Source product record expressly states new.' },
      variants: [
        { label: '14K Yellow:18in', costUsd: 100 },
        { label: '14K Yellow:20in', costUsd: 101 },
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
    await writeFile(privateFile, 'item_number,url,cost,retail,lengths_karats,error\nA1,https://example.test/a,10.00,30.00,14K Yellow:18in=$10.00;14K Yellow:20in=$11.00,\nB2,https://example.test/b,20.01,65.00,14K Rose:18in=$20.01,\n');
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
