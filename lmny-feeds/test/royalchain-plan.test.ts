import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildRoyalChainProduct, ROYALCHAIN_CATEGORY } from '../src/royalchain/listing.js';
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
  });

  it('generates an idempotent reviewed-size plan without Shopify writes', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'royal-plan-'));
    const shortlist = path.join(dir, 'shortlist.csv');
    const privateFile = path.join(dir, 'private.csv');
    await writeFile(shortlist, 'style,item_number,width_mm,url,image_url\nCuban,A1,4,https://example.test/a,https://supplier.invalid/a.jpg\nBox,B2,2,https://example.test/b,https://supplier.invalid/b.jpg\n');
    await writeFile(privateFile, 'item_number,url,cost,retail,lengths_karats,error\nA1,https://example.test/a,10.00,30.00,14K Yellow:18in=$10.00;14K Yellow:20in=$11.00,\nB2,https://example.test/b,20.01,65.00,14K Rose:18in=$20.01,\n');
    const opts = { shortlistPath: shortlist, privatePath: privateFile, outputDir: dir, expectedProducts: 2, expectedVariants: 3 };
    await expect(generateRoyalChainPlan(opts)).resolves.toEqual({ products: 2, variants: 3 });
    const first = await readFile(path.join(dir, 'royalchain-products.jsonl'), 'utf8');
    await generateRoyalChainPlan(opts);
    expect(await readFile(path.join(dir, 'royalchain-products.jsonl'), 'utf8')).toBe(first);
    expect(first.trim().split('\n')).toHaveLength(2);
    expect((await readFile(path.join(dir, 'royalchain-products.csv'), 'utf8')).trim().split('\n')).toHaveLength(4);
  });
});
