import { createHash } from 'node:crypto';
import { parseCsv } from '../jewelryCsv.js';

export const ROYALCHAIN_EXPECTED_PRODUCTS = 32;
export const ROYALCHAIN_EXPECTED_VARIANTS = 93;
export const ROYALCHAIN_MINIMUM_IMAGES = 3;
export const ROYALCHAIN_VENDOR = 'Laura Milman New York';
export const ROYALCHAIN_ONLINE_STORE = 'Online Store';
const SUPPLIER_PATTERN = /royal[\s._-]*chain(?:\.com)?/i;

export type Availability = Map<string, boolean>;

export interface PlanVariant {
  sku?: string;
  price?: string | number;
  inventoryPolicy?: string;
  inventoryItem?: {
    tracked?: boolean;
    cost?: string | number;
    measurement?: { weight?: { value?: number; unit?: string } };
  };
}

export interface PlanProduct {
  handle?: string;
  title?: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  category?: string;
  status?: string;
  tags?: string[];
  seo?: { title?: string; description?: string };
  metafields?: Array<{ namespace?: string; key?: string; value?: string }>;
  variants?: PlanVariant[];
}

export interface LiveVariant {
  id?: string;
  sku?: string | null;
  price?: string | null;
  inventoryQuantity?: number | null;
  inventoryPolicy?: string | null;
  inventoryItem?: {
    id?: string;
    tracked?: boolean | null;
    unitCost?: { amount?: string | null } | null;
    measurement?: { weight?: { value?: number | null; unit?: string | null } | null } | null;
  } | null;
}

export interface LiveProduct {
  id?: string;
  handle?: string | null;
  title?: string | null;
  descriptionHtml?: string | null;
  vendor?: string | null;
  productType?: string | null;
  category?: { id?: string | null } | null;
  status?: string | null;
  tags?: string[] | null;
  seo?: { title?: string | null; description?: string | null } | null;
  resourcePublications?: { nodes?: Array<{ isPublished?: boolean; publication?: { name?: string } }> } | null;
  metafields?: { nodes?: Array<{ namespace?: string; key?: string; value?: string }> } | null;
  media?: { nodes?: Array<{ status?: string; mediaContentType?: string; alt?: string | null; image?: { url?: string | null } | null }> } | null;
  variants?: { nodes?: LiveVariant[] } | null;
}

export interface Blocker {
  code: string;
  message: string;
  handle?: string;
  sku?: string;
}

export function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Stable JSON is used for snapshot hashes so key insertion order cannot change a checksum. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}

export function parsePlanJsonl(text: string): PlanProduct[] {
  const products: PlanProduct[] = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let product: unknown;
    try {
      product = JSON.parse(line);
    } catch {
      throw new Error(`invalid plan JSONL at line ${index + 1}`);
    }
    if (!product || typeof product !== 'object') throw new Error(`invalid plan object at line ${index + 1}`);
    products.push(product as PlanProduct);
  }
  return products;
}

export function parseAvailabilityCsv(text: string): Availability {
  const rows = parseCsv(text);
  const header = rows[0] ?? [];
  const skuIndex = header.indexOf('child_sku');
  const availableIndex = header.indexOf('available');
  if (skuIndex < 0 || availableIndex < 0) throw new Error('availability CSV must contain child_sku,available columns');
  const result: Availability = new Map();
  rows.slice(1).forEach((row, index) => {
    const sku = (row[skuIndex] ?? '').trim();
    const raw = (row[availableIndex] ?? '').trim().toLowerCase();
    if (!sku) throw new Error(`availability CSV row ${index + 2} has no child_sku`);
    if (result.has(sku)) throw new Error(`duplicate availability SKU ${sku}`);
    if (!['true', 'false', 'yes', 'no', '1', '0'].includes(raw)) {
      throw new Error(`availability CSV row ${index + 2} has non-boolean availability for ${sku}`);
    }
    result.set(sku, raw === 'true' || raw === 'yes' || raw === '1');
  });
  return result;
}

function stringsIn(value: unknown, path: string, out: string[]): void {
  if (typeof value === 'string') {
    if (SUPPLIER_PATTERN.test(value)) out.push(path);
    return;
  }
  if (Array.isArray(value)) value.forEach((item, i) => stringsIn(item, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => stringsIn(item, `${path}.${key}`, out));
}

export function supplierScrubViolations(value: unknown): string[] {
  const paths: string[] = [];
  stringsIn(value, '$', paths);
  return paths;
}

function metafield(product: PlanProduct | LiveProduct, key: string): string | null {
  const fields = Array.isArray((product as PlanProduct).metafields)
    ? (product as PlanProduct).metafields
    : ((product as LiveProduct).metafields?.nodes ?? []);
  const field = fields?.find((item) => item.namespace === 'custom' && item.key === key);
  return field?.value ?? null;
}

function planVariants(product: PlanProduct): PlanVariant[] {
  return product.variants ?? [];
}

function liveVariants(product: LiveProduct): LiveVariant[] {
  return product.variants?.nodes ?? [];
}

function categoryFor(type: string): string {
  return type === 'Bracelets' ? 'gid://shopify/TaxonomyCategory/aa-6-3' : 'gid://shopify/TaxonomyCategory/aa-6-8';
}

function money(value: string | number | null | undefined): string {
  return value == null ? '' : Number(value).toFixed(2);
}

function planPublicExpected(product: PlanProduct) {
  return {
    handle: product.handle ?? '',
    title: product.title ?? '',
    descriptionHtml: product.descriptionHtml ?? '',
    vendor: product.vendor ?? '',
    productType: product.productType ?? '',
    category: product.category ?? '',
    seo: product.seo ?? { title: '', description: '' },
    tags: [...(product.tags ?? [])].sort(),
    metafields: (product.metafields ?? []).filter((m) => m.namespace === 'custom').map((m) => ({ key: m.key ?? '', value: m.value ?? '' })).sort((a, b) => a.key.localeCompare(b.key)),
    variants: planVariants(product).map((variant) => ({
      sku: variant.sku ?? '', price: money(variant.price), inventoryPolicy: variant.inventoryPolicy ?? '', tracked: variant.inventoryItem?.tracked === true,
      weight: variant.inventoryItem?.measurement?.weight?.value ?? null,
      weightUnit: variant.inventoryItem?.measurement?.weight?.unit ?? '',
      costPresent: variant.inventoryItem?.cost != null && String(variant.inventoryItem.cost).trim() !== '',
    })).sort((a, b) => a.sku.localeCompare(b.sku)),
  };
}

export function validatePlan(products: PlanProduct[], availability?: Availability): { blockers: Blocker[]; skus: string[] } {
  const blockers: Blocker[] = [];
  if (products.length !== ROYALCHAIN_EXPECTED_PRODUCTS) blockers.push({ code: 'product-count', message: `expected ${ROYALCHAIN_EXPECTED_PRODUCTS} products, received ${products.length}` });
  const skus = products.flatMap((product) => planVariants(product).map((variant) => String(variant.sku ?? '').trim())).filter(Boolean);
  if (skus.length !== ROYALCHAIN_EXPECTED_VARIANTS) blockers.push({ code: 'variant-count', message: `expected ${ROYALCHAIN_EXPECTED_VARIANTS} variants, received ${skus.length}` });
  const seenHandles = new Set<string>();
  const seenSkus = new Set<string>();
  for (const product of products) {
    const handle = product.handle ?? '';
    if (!handle || seenHandles.has(handle)) blockers.push({ code: 'duplicate-handle', message: `missing or duplicate handle ${handle || '(blank)'}`, handle });
    seenHandles.add(handle);
    if (product.status !== 'DRAFT') blockers.push({ code: 'plan-status', message: 'source plan must remain DRAFT until person review', handle });
    if (product.vendor !== ROYALCHAIN_VENDOR) blockers.push({ code: 'vendor', message: `vendor must be ${ROYALCHAIN_VENDOR}`, handle });
    if (!['Necklaces', 'Bracelets'].includes(product.productType ?? '')) blockers.push({ code: 'product-type', message: 'product type must be Necklaces or Bracelets', handle });
    if (product.category !== categoryFor(product.productType ?? '')) blockers.push({ code: 'category', message: 'taxonomy category does not match product type', handle });
    if ((product.tags ?? []).includes('ebay')) blockers.push({ code: 'premature-ebay-tag', message: 'ebay tag is forbidden before person review', handle });
    if (!(product.tags ?? []).includes('media-missing')) blockers.push({ code: 'media-gate', message: 'source plan must retain media-missing until Shopify media is independently verified', handle });
    if (metafield(product, 'condition') !== 'New' || metafield(product, 'ebay_condition') !== '1500') blockers.push({ code: 'condition', message: 'source plan must carry custom.condition=New and custom.ebay_condition=1500', handle });
    // The source plan may retain supplier URLs for provenance. Only inspect
    // the fields that can become public Shopify data; raw source URLs are not
    // copied into the storefront or eBay listing.
    for (const path of supplierScrubViolations(planPublicExpected(product))) blockers.push({ code: 'supplier-scrub', message: `supplier name found at ${path}`, handle });
    for (const variant of planVariants(product)) {
      const sku = String(variant.sku ?? '').trim();
      if (!sku || seenSkus.has(sku)) blockers.push({ code: 'sku', message: 'missing or duplicate child SKU', handle, sku: sku || undefined });
      seenSkus.add(sku);
      if (!variant.price || !variant.inventoryItem?.cost || variant.inventoryItem.measurement?.weight?.value == null) blockers.push({ code: 'variant-facts', message: 'variant is missing price, private cost, or gram weight', handle, sku });
      if (variant.inventoryPolicy !== 'DENY' || variant.inventoryItem?.tracked !== true) blockers.push({ code: 'inventory-policy', message: 'variant must be tracked with DENY policy', handle, sku });
    }
  }
  if (availability) {
    const sourceSet = new Set(skus);
    for (const sku of skus) if (!availability.has(sku)) blockers.push({ code: 'availability-missing', message: 'source availability is required; quantity cannot be proposed without it', sku });
    for (const sku of availability.keys()) if (!sourceSet.has(sku)) blockers.push({ code: 'availability-extra', message: 'availability manifest contains a SKU outside the exact plan', sku });
    if (availability.size !== skus.length) blockers.push({ code: 'availability-count', message: `availability manifest must contain exactly ${skus.length} unique child SKUs` });
  } else blockers.push({ code: 'availability-missing', message: 'availability manifest is required; quantity cannot be proposed without it' });
  return { blockers, skus };
}

function livePublicExpected(product: LiveProduct) {
  return {
    handle: product.handle ?? '', title: product.title ?? '', descriptionHtml: product.descriptionHtml ?? '', vendor: product.vendor ?? '',
    productType: product.productType ?? '', category: product.category?.id ?? '', seo: product.seo ?? { title: '', description: '' },
    tags: [...(product.tags ?? [])].sort(), metafields: (product.metafields?.nodes ?? []).filter((m) => m.namespace === 'custom').map((m) => ({ key: m.key ?? '', value: m.value ?? '' })).sort((a, b) => a.key.localeCompare(b.key)),
    variants: liveVariants(product).map((variant) => ({ sku: variant.sku ?? '', price: money(variant.price), inventoryPolicy: variant.inventoryPolicy ?? '', tracked: variant.inventoryItem?.tracked === true, weight: variant.inventoryItem?.measurement?.weight?.value ?? null, weightUnit: variant.inventoryItem?.measurement?.weight?.unit ?? '', costPresent: variant.inventoryItem?.unitCost?.amount != null })).sort((a, b) => a.sku.localeCompare(b.sku)),
  };
}

export interface ActivationSnapshot {
  schemaVersion: 1;
  mode: 'plan-only';
  generatedAt: string;
  sourcePlanSha256: string;
  availabilitySha256: string | null;
  liveReadSha256: string;
  snapshotSha256: string;
  targetProducts: number;
  targetVariants: number;
  activationReady: false;
  blockers: Blocker[];
  targets: Array<{ handle: string; productId: string | null; publicExpected: ReturnType<typeof planPublicExpected>; sourceAvailable: Record<string, boolean>; live: ReturnType<typeof livePublicExpected> | null }>;
}

export function buildActivationSnapshot(args: { plan: PlanProduct[]; planText: string; availability?: Availability; availabilityText?: string; liveProducts: LiveProduct[]; generatedAt?: string }): ActivationSnapshot {
  const check = validatePlan(args.plan, args.availability);
  const byHandle = new Map((args.liveProducts ?? []).map((product) => [product.handle ?? '', product]));
  const liveRelevant = args.liveProducts.filter((product) => check.skus.some((sku) => liveVariants(product).some((variant) => variant.sku === sku)) || args.plan.some((planned) => planned.handle === product.handle));
  const blockers = [...check.blockers];
  if (liveRelevant.length !== args.plan.length) blockers.push({ code: 'live-scope', message: `fresh Shopify read found ${liveRelevant.length} matching products; expected ${args.plan.length}` });
  const targets = args.plan.map((product) => {
    const live = byHandle.get(product.handle ?? '') ?? null;
    const available: Record<string, boolean> = {};
    for (const variant of planVariants(product)) {
      const sku = String(variant.sku ?? '').trim();
      if (sku && args.availability?.has(sku)) available[sku] = args.availability.get(sku) === true;
    }
    if (!live) blockers.push({ code: 'live-missing', message: 'fresh Shopify read did not find planned handle', handle: product.handle });
    return { handle: product.handle ?? '', productId: live?.id ?? null, publicExpected: planPublicExpected(product), sourceAvailable: available, live: live ? livePublicExpected(live) : null };
  });
  const unsigned = { schemaVersion: 1 as const, mode: 'plan-only' as const, generatedAt: args.generatedAt ?? new Date().toISOString(), sourcePlanSha256: sha256Text(args.planText), availabilitySha256: args.availabilityText == null ? null : sha256Text(args.availabilityText), liveReadSha256: sha256Text(canonicalJson(liveRelevant)), targetProducts: args.plan.length, targetVariants: check.skus.length, activationReady: false as const, blockers, targets };
  return { ...unsigned, snapshotSha256: sha256Text(canonicalJson(unsigned)) };
}

export function verifySnapshotChecksum(snapshot: ActivationSnapshot): boolean {
  const { snapshotSha256, ...unsigned } = snapshot;
  return snapshotSha256 === sha256Text(canonicalJson(unsigned));
}

export function verifyFinalState(snapshot: ActivationSnapshot, liveProducts: LiveProduct[]): { blockers: Blocker[]; checkedProducts: number; checkedVariants: number } {
  const blockers: Blocker[] = [];
  if (!verifySnapshotChecksum(snapshot)) blockers.push({ code: 'snapshot-checksum', message: 'reviewed snapshot checksum does not match its contents' });
  const byHandle = new Map(liveProducts.map((product) => [product.handle ?? '', product]));
  let checkedVariants = 0;
  for (const target of snapshot.targets) {
    const live = byHandle.get(target.handle);
    if (!live) { blockers.push({ code: 'live-missing', message: 'final verification read did not find handle', handle: target.handle }); continue; }
    if (live.status !== 'ACTIVE') blockers.push({ code: 'status', message: 'person must set product ACTIVE after review', handle: target.handle });
    const published = live.resourcePublications?.nodes?.some((p) => p.isPublished && p.publication?.name === ROYALCHAIN_ONLINE_STORE) === true;
    if (!published) blockers.push({ code: 'online-store', message: 'person must publish product to Online Store', handle: target.handle });
    if (!(live.tags ?? []).includes('ebay')) blockers.push({ code: 'ebay-tag', message: 'person must add ebay tag after review', handle: target.handle });
    if ((live.tags ?? []).includes('media-missing')) blockers.push({ code: 'media-missing', message: 'media-missing must be removed only after media verification', handle: target.handle });
    const expectedTags = [...target.publicExpected.tags.filter((tag) => tag !== 'media-missing'), 'ebay'].sort();
    if (canonicalJson([...(live.tags ?? [])].sort()) !== canonicalJson(expectedTags)) blockers.push({ code: 'tags', message: 'final tags do not match the reviewed tag set plus ebay', handle: target.handle });
    if (live.vendor !== target.publicExpected.vendor || live.productType !== target.publicExpected.productType || live.category?.id !== target.publicExpected.category || live.title !== target.publicExpected.title || live.descriptionHtml !== target.publicExpected.descriptionHtml) blockers.push({ code: 'public-copy', message: 'vendor, type, category, title, or body differs from reviewed plan', handle: target.handle });
    if (live.seo?.title !== target.publicExpected.seo.title || live.seo?.description !== target.publicExpected.seo.description) blockers.push({ code: 'seo', message: 'SEO differs from reviewed plan', handle: target.handle });
    if (metafield(live, 'condition') !== 'New' || metafield(live, 'ebay_condition') !== '1500') blockers.push({ code: 'condition', message: 'condition metafields differ from reviewed plan', handle: target.handle });
    const images = (live.media?.nodes ?? []).filter((m) => m.mediaContentType === 'IMAGE' && m.status === 'READY');
    if (images.length < ROYALCHAIN_MINIMUM_IMAGES) blockers.push({ code: 'media-count', message: `requires at least ${ROYALCHAIN_MINIMUM_IMAGES} READY images`, handle: target.handle });
    for (const path of supplierScrubViolations(live)) blockers.push({ code: 'supplier-scrub', message: `supplier name found at ${path}`, handle: target.handle });
    const bySku = new Map(liveVariants(live).map((variant) => [variant.sku ?? '', variant]));
    for (const expected of target.publicExpected.variants) {
      const variant = bySku.get(expected.sku);
      checkedVariants += 1;
      if (!variant) { blockers.push({ code: 'sku', message: 'final verification read did not find child SKU', handle: target.handle, sku: expected.sku }); continue; }
      if (money(variant.price) !== expected.price || variant.inventoryPolicy !== expected.inventoryPolicy || variant.inventoryItem?.tracked !== expected.tracked || variant.inventoryItem?.measurement?.weight?.value !== expected.weight) blockers.push({ code: 'variant-facts', message: 'variant SKU, price, policy, tracking, or weight differs from reviewed plan', handle: target.handle, sku: expected.sku });
      if (!(expected.sku in target.sourceAvailable)) { blockers.push({ code: 'availability-missing', message: 'no reviewed source availability exists for this child SKU', handle: target.handle, sku: expected.sku }); continue; }
      const shouldBeOne = target.sourceAvailable[expected.sku] === true;
      if (shouldBeOne && variant.inventoryQuantity !== 1) blockers.push({ code: 'inventory-quantity', message: 'available source variant must have quantity 1', handle: target.handle, sku: expected.sku });
      if (!shouldBeOne && variant.inventoryQuantity !== 0) blockers.push({ code: 'inventory-quantity', message: 'unavailable source variant must have quantity 0', handle: target.handle, sku: expected.sku });
    }
  }
  if (liveProducts.length !== snapshot.targetProducts) blockers.push({ code: 'live-scope', message: `final verification read returned ${liveProducts.length} target products; expected ${snapshot.targetProducts}` });
  return { blockers, checkedProducts: snapshot.targets.length, checkedVariants };
}

export function activationChecklist(snapshot: ActivationSnapshot): string {
  return [
    '# Royal Chain person-run activation checklist',
    '',
    `Reviewed snapshot: \`${snapshot.snapshotSha256}\``,
    `Scope: ${snapshot.targetProducts} products / ${snapshot.targetVariants} child SKUs`,
    '',
    'This worker is read-only. A person must complete and independently verify each final visibility decision:',
    '',
    '1. Review every product copy, price, variant weight, condition, and image set in Shopify admin.',
    '2. Confirm at least three READY Shopify CDN images per product and confirm no supplier name appears in public fields, media alt text, or filenames.',
    '3. After review, set each product ACTIVE, publish it to Online Store, remove `media-missing`, and add `ebay`.',
    '4. Confirm inventory is tracked with DENY policy; set quantity 1 only for source-available child SKUs and 0 for unavailable ones.',
    '5. Confirm `custom.condition=New` and `custom.ebay_condition=1500`.',
    '6. Review Marketplace Connect mapping separately; this worker never configures or submits Marketplace Connect listings.',
    '7. Run the final independent verifier against this exact snapshot and resolve every reported blocker before calling the batch complete.',
    '',
    'No job in this repository changes ACTIVE status, publication, or the eBay tag.',
    '',
  ].join('\n');
}

export const ROYALCHAIN_CATALOG_QUERY = `query RoyalChainActivationCatalog {\n  products(first: 250, query: "vendor:'Laura Milman New York'") {\n    nodes {\n      id handle title descriptionHtml vendor productType status\n      category { id }\n      tags\n      seo { title description }\n      resourcePublications(first: 30) { nodes { isPublished publication { name } } }\n      metafields(first: 30, namespace: "custom") { nodes { namespace key value } }\n      media(first: 100) { nodes { status mediaContentType alt ... on MediaImage { image { url } } } }\n      variants(first: 100) { nodes { id sku price inventoryQuantity inventoryPolicy inventoryItem { id tracked unitCost { amount } measurement { weight { value unit } } } } }\n    }\n  }\n}`;
