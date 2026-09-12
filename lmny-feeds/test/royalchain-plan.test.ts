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
      existingHandle: 'lmny-cuban-4',
      style: 'Cuban',
      widthMm: '4',
      closure: 'Lobster',
      finish: 'Polished',
      construction: 'Semi-solid',
      imageUrl: 'https://supplier.invalid/hero.jpg',
      imageUrls: [
        'https://supplier.invalid/hero.jpg',
        'https://supplier.invalid/detail.jpg',
        'https://supplier.invalid/on-body.jpg',
      ],
      shopifyCdnImageUrls: [
        'https://cdn.shopify.com/s/files/1/1/files/hero.jpg',
        'https://cdn.shopify.com/s/files/1/1/files/detail.jpg',
        'https://cdn.shopify.com/s/files/1/1/files/onbody.jpg',
      ],
      condition: { state: 'new', evidence: 'Source product record expressly states new.', originalPackagingEvidence: 'Source record expressly confirms original retail packaging.' },
      variants: [
        { label: '14K Yellow:18in', costUsd: 100, sku: 'CUBAN-4-18', weightGrams: 11.2, available: true },
        { label: '14K Yellow:20in', costUsd: 101, sku: 'CUBAN-4-20', weightGrams: 12.7, available: true },
      ],
    }) as Record<string, any>;

    // One prose paragraph; every spec lives in the theme's Specifications grid instead.
    expect(product.descriptionHtml).toBe(
      '<p>This 4mm cuban chain necklace is crafted in 14K Yellow Gold and offered by Laura Milman New York. Finished polished and closed with a lobster clasp.</p>',
    );
    expect(product.descriptionHtml).not.toMatch(/<h2>|<ul>|<li>|Details/i);
    expect(product.metafields).toEqual([
      { namespace: 'custom', key: 'metal', type: 'single_line_text_field', value: '14K Yellow Gold' },
      { namespace: 'custom', key: 'link', type: 'single_line_text_field', value: 'Cuban' },
      { namespace: 'custom', key: 'width', type: 'single_line_text_field', value: '4 mm' },
      { namespace: 'custom', key: 'length', type: 'single_line_text_field', value: '18, 20 in' },
      { namespace: 'custom', key: 'clasp', type: 'single_line_text_field', value: 'Lobster' },
      { namespace: 'custom', key: 'finish', type: 'single_line_text_field', value: 'Polished' },
      { namespace: 'custom', key: 'condition', type: 'single_line_text_field', value: 'New' },
      { namespace: 'custom', key: 'ebay_condition', type: 'single_line_text_field', value: '1000' },
    ]);
    expect(JSON.stringify(product.metafields)).not.toMatch(/metal_type|measurements/);
    expect(product.seo.description).toBe(
      'Shop the 4mm cuban chain necklace in 14K Yellow Gold, available in 18 to 20 in, from Laura Milman New York.',
    );
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
        Closure: 'Lobster',
        Finish: 'Polished',
        Construction: 'Semi-solid',
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
    expect(products.map((product) => product.handle)).toEqual(['lmny-mixed-bracelet', 'lmny-mixed']);
    expect(products.map((product) => product.productType)).toEqual(['Bracelets', 'Necklaces']);
    expect(products.map((product) => product.ebay.itemSpecifics.Type)).toEqual(['Bracelet', 'Necklace']);
    expect(products[0]!.descriptionHtml).toMatch(/curb chain bracelet/i);
    expect(products[1]!.descriptionHtml).toMatch(/curb chain necklace/i);
  });

  it('fails closed for eBay until all image, content, and condition gates are met', () => {
    const product = buildRoyalChainProduct({
      itemNumber: 'BASIC-2',
      style: 'Box',
      widthMm: '2',
      imageUrls: ['https://supplier.invalid/one.jpg', 'https://supplier.invalid/two.jpg', 'https://supplier.invalid/three.jpg'],
      variants: [{ label: '14K Rose:18in', costUsd: 10 }],
    }) as Record<string, any>;

    expect(product.status).toBe('DRAFT');
    expect(product.tags).toContain('media-missing');
    expect(product.ebay.eligible).toBe(false);
    expect(product.ebay.blockers).toEqual(expect.arrayContaining([
      'requires 3 successfully imported Shopify CDN images',
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

  it('uses reviewed source width overrides and fails closed on an unresolved width', () => {
    const corrected = buildRoyalChainProduct({ itemNumber: 'PCLIP095', style: 'Paperclip', widthMm: '4', variants: [{ label: '14K Yellow:18in', costUsd: 10 }] });
    expect(corrected.title).toContain('4.1mm');
    expect(() => buildRoyalChainProduct({ itemNumber: 'UNKNOWN', style: 'Box', widthMm: 'about four', variants: [{ label: '14K Yellow:18in', costUsd: 10 }] })).toThrow(/width mismatch/);
  });

  it('generates an idempotent reviewed-size plan without Shopify writes', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'royal-plan-'));
    const shortlist = path.join(dir, 'shortlist.csv');
    const privateFile = path.join(dir, 'private.csv');
    await writeFile(shortlist, 'style,item_number,existing_handle,width_mm,url,image_url,image_urls,condition,condition_evidence\nCuban,A1,lmny-a1,4,https://example.test/a,https://supplier.invalid/a.jpg,https://supplier.invalid/a.jpg;https://supplier.invalid/a-detail.jpg;https://supplier.invalid/a-on-body.jpg,new,Source record states new.\nBox,B2,lmny-b2,2,https://example.test/b,https://supplier.invalid/b.jpg,,,\n');
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
    expect(firstProduct.ebay.eligible).toBe(false);
    expect(firstProduct.tags).not.toContain('ebay');
  });

  it('keeps the live necklace handle and gives only its split bracelet a new handle', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'royal-handles-'));
    const shortlist = path.join(dir, 'shortlist.csv');
    const privateFile = path.join(dir, 'private.csv');
    await writeFile(shortlist, 'style,item_number,existing_handle,width_mm,url\nSnake,OVSN260,lmny-snake-2-6-mm-ovsn260,2.6,https://example.test/a\n');
    await writeFile(privateFile, 'item_number,url,cost,retail,lengths_karats,error\nOVSN260,https://example.test/a,10,30,14K Yellow:10in=$10|OVSN260-10|4|yes;14K Yellow:18in=$11|OVSN260-18|6|yes,\n');
    await generateRoyalChainPlan({ shortlistPath: shortlist, privatePath: privateFile, outputDir: dir, expectedProducts: 2, expectedVariants: 2 });
    const handles = (await readFile(path.join(dir, 'royalchain-products.jsonl'), 'utf8')).trim().split('\n').map((line) => JSON.parse(line).handle);
    expect(handles).toEqual(['lmny-snake-2-6-mm-ovsn260-bracelet', 'lmny-snake-2-6-mm-ovsn260']);
    expect(new Set(handles).size).toBe(handles.length);
  });
});
