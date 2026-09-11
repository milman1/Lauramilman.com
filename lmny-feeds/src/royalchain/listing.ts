import { supplierRetailFromCost } from '../../config/pricing.js';
import { taxonomyGidForProductType } from '../taxonomy.js';

export const ROYALCHAIN_VENDOR = 'Laura Milman New York';
export const ROYALCHAIN_PRODUCT_TYPE = 'Necklaces';
export const ROYALCHAIN_CATEGORY = taxonomyGidForProductType(ROYALCHAIN_PRODUCT_TYPE);

export interface RoyalChainVariant {
  label: string;
  costUsd: number;
}

export interface RoyalChainSource {
  itemNumber: string;
  style: string;
  widthMm: string;
  imageUrl: string;
  variants: RoyalChainVariant[];
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function fitWithSuffix(lead: string, suffix: string, max: number): string {
  if (`${lead} ${suffix}`.length <= max) return `${lead} ${suffix}`;
  const room = max - suffix.length - 1;
  const cut = lead.slice(0, room + 1);
  const boundary = cut.lastIndexOf(' ');
  return `${(boundary > 0 ? cut.slice(0, boundary) : '').trim()} ${suffix}`.trim();
}

function assertNoSupplierName(fields: Record<string, string>): void {
  for (const [field, value] of Object.entries(fields)) {
    if (/royal\s*chain/i.test(value)) throw new Error(`supplier name is forbidden in ${field}`);
  }
}

export function buildRoyalChainProduct(source: RoyalChainSource): Record<string, unknown> {
  const itemNumber = clean(source.itemNumber);
  const style = clean(source.style);
  const width = clean(source.widthMm);
  if (!itemNumber || !style || !width || source.variants.length === 0) throw new Error('incomplete Royal Chain source row');
  const metals = [...new Set(source.variants.map((v) => clean(v.label.split(':')[0] ?? '')))].filter(Boolean);
  if (metals.length !== 1) throw new Error(`${itemNumber}: variants do not share one metal`);
  const metal = `${metals[0]} Gold`;
  const title = `${width}mm ${style} Chain in ${metal}`;
  const descriptionHtml = `<p>This ${escapeHtml(width)}mm ${escapeHtml(style.toLowerCase())} chain in ${escapeHtml(metal)} is offered by Laura Milman New York.</p>`;
  const seoTitle = fitWithSuffix(`${width}mm ${style} Chain in ${metal}`, '| Laura Milman', 60);
  const seoDescription = fitWithSuffix(`Shop this ${width}mm ${style.toLowerCase()} chain in ${metal}.`, 'Authenticated by Laura Milman New York.', 160);
  const handle = `lmny-${itemNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const alt = title;
  assertNoSupplierName({ handle, title, descriptionHtml, seoTitle, seoDescription, alt, vendor: ROYALCHAIN_VENDOR });
  const variants = source.variants.map((variant) => {
    const label = clean(variant.label);
    if (!/^14K (?:Yellow|Rose|White):\d+(?:\.\d+)?in$/i.test(label)) throw new Error(`${itemNumber}: invalid variant label`);
    const retail = supplierRetailFromCost(variant.costUsd);
    return {
      optionValues: [{ optionName: 'Metal / Length', name: label.replace(':', ' / ') }],
      price: retail.toFixed(2),
      sku: itemNumber,
      taxable: true,
      inventoryPolicy: 'DENY',
      inventoryItem: { tracked: false, requiresShipping: true, cost: variant.costUsd.toFixed(2) },
    };
  });
  return {
    handle,
    title,
    descriptionHtml,
    vendor: ROYALCHAIN_VENDOR,
    productType: ROYALCHAIN_PRODUCT_TYPE,
    category: ROYALCHAIN_CATEGORY,
    status: 'DRAFT',
    tags: [ROYALCHAIN_VENDOR, ROYALCHAIN_PRODUCT_TYPE, 'media-missing'],
    seo: { title: seoTitle, description: seoDescription },
    productOptions: [{ name: 'Metal / Length', values: source.variants.map((v) => ({ name: clean(v.label).replace(':', ' / ') })) }],
    variants,
    files: source.imageUrl ? [{ originalSource: source.imageUrl, contentType: 'IMAGE', alt }] : [],
  };
}
