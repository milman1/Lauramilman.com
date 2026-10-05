import { createHash } from 'node:crypto';
import { labGrownJewelryRetailFromCost, settingOnlyRetailFromCost, supplierRetailFromCost } from '../config/pricing.js';

export const POLICY = 'Free insured shipping and 7-day returns.';
export const SPEC_KEYS = ['diamond_shape', 'carat_weight', 'color', 'clarity', 'metal', 'setting_style'] as const;
export const REVIEW_CHECKS = ['sourceFactsAndScope', 'copyAndSpecsAcrossVariants', 'weightBasisAndOrigin', 'categoryAndSkuMapping', 'mediaMatchesProduct', 'shippingReturnsApply', 'desktopAndMobilePreview', 'productOfferSchemaAndCanonical', 'availabilityAndPrice', 'salesChannelsAndMarketplace'] as const;
export type Kind = 'lab-grown' | 'setting' | 'royal-chain' | 'house';
type Connection<T> = { nodes: T[]; pageInfo: { hasNextPage: boolean } };
export interface GateVariant {
  id: string; sku: string | null; price: string; inventoryQuantity: number | null; inventoryPolicy: string;
  selectedOptions: Array<{ name: string; value: string }>;
  inventoryItem: { tracked: boolean; unitCost: { amount: string; currencyCode: string } | null };
}
export interface GateProduct {
  id: string; handle: string; status: string; updatedAt: string; title: string; descriptionHtml: string;
  productType: string; vendor: string; tags: string[]; templateSuffix: string | null;
  category: { id: string; fullName: string } | null;
  seo: { title: string | null; description: string | null };
  variants: Connection<GateVariant>;
  media: Connection<{ id: string; alt: string | null; mediaContentType: string; status: string }>;
  metafields: Connection<{ namespace: string; key: string; value: string; type: string }>;
  resourcePublicationsV2: Connection<{ publication: { id: string } }>;
}
export interface Review {
  version: 1; productId: string; snapshotSha256: string; kind: Kind | '';
  source: 'skylab' | 'royal-chain' | 'house' | 'other' | '';
  sourceEvidence: string; reviewedBy: string; expiresAt: string;
  checks: Record<typeof REVIEW_CHECKS[number], string>;
  madeToOrder: Record<string, string>;
  merchantAuthorization: string;
}
export interface Snapshot { shopId: string; currencyCode: string; product: GateProduct }
export interface GateClient { gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> }

/** Safe creation preflight; complete media/semantic review follows on the saved draft. */
export function validateDraftInput(input: Record<string, unknown>): string[] {
  const issues: string[] = [];
  if (input.id != null) issues.push('Draft creation cannot update an existing product');
  if (input.status !== 'DRAFT') issues.push('New products must explicitly use status DRAFT');
  if (typeof input.handle !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.handle)) issues.push('Explicit URL-safe handle required');
  const seo = input.seo as GateProduct['seo'] | undefined;
  issues.push(...copyIssues(String(input.title ?? ''), String(input.descriptionHtml ?? ''), seo ?? { title: null, description: null }));
  if (typeof input.productType !== 'string' || !input.productType.trim()) issues.push('Specific productType required');
  if (typeof input.category !== 'string' || !input.category.startsWith('gid://shopify/TaxonomyCategory/')) issues.push('Shopify category required');
  const tags = Array.isArray(input.tags) ? input.tags : [];
  if (tags.some(t => String(t).toLowerCase() === 'ebay')) issues.push('No ebay tag on drafts');
  if (/\b(watches?|timepieces?|estate|vintage|pre[ -]?owned|loose)\b/i.test(`${input.productType} ${input.title} ${tags.join(' ')}`) || /^(natural|lab[ -]grown) diamond$/i.test(String(input.productType))) issues.push('Excluded category: use its separate workflow');
  const fields = Array.isArray(input.metafields) ? input.metafields as Array<{ namespace: string; key: string; value: string }> : [];
  if (!fields.some(m => m.namespace === 'custom' && m.key === 'metal' && m.value?.trim())) issues.push('Verified custom.metal required');
  const publicText = [input.vendor, input.handle, ...tags, ...fields.filter(m => m.namespace === 'custom').map(m => `${m.key} ${m.value}`)].join(' ');
  if (/skylab|sky[ -]lab|royal[ -]?chain|peaceful diamonds|back[ -]?vault|wholesale|cost[_ ]|invoice/i.test(publicText)) issues.push('Supplier or cost information in public fields');
  const variants = Array.isArray(input.variants) ? input.variants as Array<{ sku?: string; price?: string }> : [];
  if (!variants.length) issues.push('Variants required');
  const skus = new Set<string>();
  for (const v of variants) {
    if (!v.sku?.trim() || skus.has(v.sku.trim())) issues.push('Every variant requires a unique SKU');
    if (v.sku) skus.add(v.sku.trim());
    if (!(Number.isFinite(Number(v.price)) && Number(v.price) > 0)) issues.push('Every variant requires a positive confirmed retail price');
  }
  return issues;
}

export const SNAPSHOT_QUERY = `query JewelryGateSnapshot($id: ID!) {
  shop { id currencyCode }
  product(id: $id) {
    id handle status updatedAt title descriptionHtml productType vendor tags templateSuffix
    category { id fullName } seo { title description }
    variants(first: 250) { nodes {
      id sku price inventoryQuantity inventoryPolicy selectedOptions { name value }
      inventoryItem { tracked unitCost { amount currencyCode } }
    } pageInfo { hasNextPage } }
    media(first: 250) { nodes { id alt mediaContentType status } pageInfo { hasNextPage } }
    metafields(first: 250) { nodes { namespace key value type } pageInfo { hasNextPage } }
    resourcePublicationsV2(first: 250, onlyPublished: false) { nodes { publication { id } } pageInfo { hasNextPage } }
  }
}`;
export const STATUS_MUTATION = `mutation JewelryGateStatus($product: ProductUpdateInput!) {
  productUpdate(product: $product) { product { id status } userErrors { field message } }
}`;

// Sort object keys, preserve array order (media order and variant options matter).
export function digest(value: unknown): string {
  function canonical(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(canonical);
    if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)]));
    return v;
  }
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export async function readSnapshot(client: GateClient, id: string): Promise<Snapshot> {
  if (!/^gid:\/\/shopify\/Product\/\d+$/.test(id)) throw new Error('Exact Shopify product ID required');
  const data = await client.gql<{ shop: { id: string; currencyCode: string }; product: GateProduct | null }>(SNAPSHOT_QUERY, { id });
  if (!data.product || data.product.id !== id) throw new Error('Product not found');
  return { shopId: data.shop.id, currencyCode: data.shop.currencyCode, product: data.product };
}
export function reviewTemplate(snapshot: Snapshot, now = Date.now()): Review {
  return { version: 1, productId: snapshot.product.id, snapshotSha256: digest(snapshot), kind: '', source: '', sourceEvidence: '', reviewedBy: '', expiresAt: new Date(now + 24 * 3600000).toISOString(), checks: Object.fromEntries(REVIEW_CHECKS.map(k => [k, ''])) as Review['checks'], madeToOrder: {}, merchantAuthorization: '' };
}
export function copyIssues(title: string, body: string, seo: GateProduct['seo']): string[] {
  const issues: string[] = [];
  if (!title.trim()) issues.push('Title missing');
  if (!seo.title?.trim() || [...seo.title].length > 60) issues.push('SEO title must be 1–60 characters');
  if (!seo.description?.trim() || [...seo.description].length > 160 || !seo.description.endsWith(POLICY) || seo.description.trim() === POLICY) issues.push('SEO description must identify the product, end with the policy closer, and fit 160 characters');
  if (!/^<p>[^<>]+<\/p>$/.test(body.trim())) issues.push('Body must be one text-only HTML paragraph');
  const copy = [title, body, seo.title, seo.description].join(' ');
  if (/\b(stunning|must[ -]have|breathtaking|beautiful|exquisite|killer|exceptional|spectacular|elegant|luxury|ethical|sustainable)\b/i.test(copy)) issues.push('Prohibited marketing language');
  if (/skylab|sky[ -]lab|royal[ -]?chain|peaceful diamonds|back[ -]?vault|wholesale|invoice cost|cost per item/i.test(copy)) issues.push('Supplier or cost language in public copy');
  return issues;
}
const evidence = (v: unknown): boolean => typeof v === 'string' && v.trim().length >= 8;
export function validateActivation(snapshot: Snapshot, review: Review, now = Date.now()): string[] {
  const p = snapshot.product;
  const issues = copyIssues(p.title, p.descriptionHtml, p.seo);
  if (p.status !== 'DRAFT') issues.push('Only DRAFT products may enter this activation gate');
  if (snapshot.currencyCode !== 'USD') issues.push('Pricing rules require USD');
  if (review.version !== 1 || review.productId !== p.id || review.snapshotSha256 !== digest(snapshot)) issues.push('Review does not match this exact fresh shop/product snapshot');
  const expiry = Date.parse(review.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now || expiry > now + 24 * 3600000) issues.push('Review must expire within 24 hours and be unexpired');
  if (!['lab-grown', 'setting', 'royal-chain', 'house'].includes(review.kind)) issues.push('Confirmed in-scope classification required');
  if (!['skylab', 'royal-chain', 'house', 'other'].includes(review.source)) issues.push('Confirmed source required');
  if ((review.kind === 'royal-chain' && review.source !== 'royal-chain') || (review.source === 'royal-chain' && review.kind === 'house')) issues.push('Royal Chain source and pricing classification disagree');
  for (const field of ['sourceEvidence', 'reviewedBy', 'merchantAuthorization'] as const) if (!evidence(review[field])) issues.push(`Review evidence required: ${field}`);
  for (const key of REVIEW_CHECKS) if (!evidence(review.checks?.[key])) issues.push(`Review evidence required: ${key}`);
  const identity = [p.productType, p.title, p.handle, ...p.tags].join(' ');
  if (/\b(watches?|timepieces?|vintage|estate|pre[ -]?owned|loose)\b|backvault|^(?:nd|lg|bv|w)-/i.test(identity) || /^(natural|lab[ -]grown) diamond$/i.test(p.productType)) issues.push('Excluded category: use its separate workflow');
  if (!p.productType.trim() || /^(jewelry|other)$/i.test(p.productType)) issues.push('Specific product type required');
  if (!p.category || !/Jewelry|Cufflinks/.test(p.category.fullName) || /Watches/.test(p.category.fullName)) issues.push('Jewelry category required');
  const lab = /lab[ -]?(grown|created)/i.test([p.title, p.descriptionHtml, ...p.tags].join(' '));
  const setting = /ring[ -]setting|setting[ -]only/i.test(identity);
  if (setting !== (review.kind === 'setting')) issues.push('Setting classification disagrees with listing');
  if (!setting && lab !== (review.kind === 'lab-grown')) issues.push('Diamond-origin classification disagrees with listing');
  if (review.kind === 'lab-grown' && [p.title, p.seo.title, p.descriptionHtml].some(x => !/lab[ -]?(grown|created)/i.test(x ?? ''))) issues.push('Lab-grown identity required in title, SEO title, and body');
  for (const key of ['variants', 'media', 'metafields', 'resourcePublicationsV2'] as const) if (p[key].pageInfo.hasNextPage) issues.push(`Incomplete ${key}: split or extend the reader; never approve a partial snapshot`);
  const custom = Object.fromEntries(p.metafields.nodes.filter(m => m.namespace === 'custom').map(m => [m.key, m.value]));
  if (!custom.metal?.trim()) issues.push('Verified custom.metal required');
  if (/mixed shape/i.test(custom.diamond_shape ?? '')) issues.push('Mixed shape is not a diamond shape');
  for (const [primary, alias] of [['metal', 'metal_type'], ['carat_weight', 'diamond_weight']]) {
    if (custom[primary!] && custom[alias!] && custom[primary!] !== custom[alias!]) issues.push(`Conflicting ${primary}/${alias}: reconcile and review`);
  }
  const publicText = [p.vendor, p.handle, ...p.tags, ...p.media.nodes.map(m => m.alt), ...p.metafields.nodes.filter(m => m.namespace === 'custom').map(m => `${m.key} ${m.value}`)].join(' ');
  if (/skylab|sky[ -]lab|royal[ -]?chain|peaceful diamonds|back[ -]?vault|wholesale|cost[_ ]|invoice/i.test(publicText)) issues.push('Supplier or cost information in public fields');
  if (p.tags.some(t => t.toLowerCase() === 'ebay')) issues.push('Remove ebay tag from draft before review');
  const images = p.media.nodes.filter(m => m.mediaContentType === 'IMAGE');
  if (images.length < 3) issues.push('At least three product images required');
  if (p.media.nodes.some(m => m.status !== 'READY' || !m.alt?.trim())) issues.push('All media must be READY with descriptive alt text');
  const videos = p.media.nodes.filter(m => ['VIDEO', 'EXTERNAL_VIDEO'].includes(m.mediaContentType));
  if (review.source === 'skylab' && !videos.length) issues.push('Skylab product video required');
  if (videos.length && !['VIDEO', 'EXTERNAL_VIDEO'].includes(p.media.nodes[0]?.mediaContentType ?? '')) issues.push('Video must be first in gallery');
  if (!p.variants.nodes.length) issues.push('At least one variant required');
  const skus = new Set<string>();
  for (const v of p.variants.nodes) {
    if (!v.sku?.trim() || skus.has(v.sku.trim())) issues.push(`Missing or duplicate SKU: ${v.id}`);
    if (v.sku) skus.add(v.sku.trim());
    const retail = Number(v.price);
    if (!Number.isFinite(retail) || retail <= 0) issues.push(`Invalid price: ${v.id}`);
    if (!(v.inventoryItem.tracked && (v.inventoryQuantity ?? 0) > 0 && v.inventoryPolicy === 'DENY')) {
      if (!evidence(review.madeToOrder?.[v.id]) || (v.inventoryItem.tracked && v.inventoryPolicy !== 'CONTINUE')) issues.push(`Stock or documented made-to-order setup required: ${v.id}`);
    }
    if (review.kind !== 'house') {
      const cost = Number(v.inventoryItem.unitCost?.amount);
      if (!(cost > 0 && Number.isFinite(cost)) || v.inventoryItem.unitCost?.currencyCode !== 'USD') issues.push(`Verified USD cost required: ${v.id}`);
      else {
        const expected = review.kind === 'setting' ? settingOnlyRetailFromCost(cost) : review.kind === 'royal-chain' ? supplierRetailFromCost(cost) : labGrownJewelryRetailFromCost(cost);
        if (Math.round(retail * 100) !== Math.round(expected * 100)) issues.push(`Price does not match source rule: ${v.id}`);
      }
    }
  }
  return issues;
}

/** Exact one-product mutation. No publication, marketplace tags, price, or copy writes. */
export async function activateReviewed(client: GateClient, review: Review, now = Date.now()): Promise<void> {
  const before = await readSnapshot(client, review.productId);
  const issues = validateActivation(before, review, now);
  if (issues.length) throw new Error(issues.join('\n'));
  const result = await client.gql<{ productUpdate: { product: { id: string; status: string } | null; userErrors: Array<{ message: string }> } }>(STATUS_MUTATION, { product: { id: review.productId, status: 'ACTIVE' } });
  if (result.productUpdate.userErrors.length || result.productUpdate.product?.id !== review.productId || result.productUpdate.product.status !== 'ACTIVE') throw new Error('Activation mutation failed; read live state before retrying');
  const after = await readSnapshot(client, review.productId);
  const normalized = { ...after, product: { ...after.product, status: before.product.status, updatedAt: before.product.updatedAt } };
  if (after.product.status !== 'ACTIVE' || digest(normalized) !== digest(before)) throw new Error('Activation readback mismatch; product may be ACTIVE. Stop, inspect, and do not publish');
}
