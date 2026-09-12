import { createHash } from 'node:crypto';
import { parseCsv } from '../jewelryCsv.js';
import { shopifyCdnMediaUrlsAfterImport } from './listing.js';

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

export interface ActivationGap extends Blocker {}

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

function exactWeight(value: number | null | undefined, unit: string | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && unit === 'GRAMS';
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
      cost: money(variant.inventoryItem?.cost),
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
      if (!variant.price || !variant.inventoryItem?.cost || !Number.isFinite(Number(variant.inventoryItem.cost)) || !exactWeight(variant.inventoryItem.measurement?.weight?.value, variant.inventoryItem.measurement?.weight?.unit)) blockers.push({ code: 'variant-facts', message: 'variant is missing exact price, private cost, or positive gram weight in GRAMS', handle, sku });
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
    variants: liveVariants(product).map((variant) => ({ sku: variant.sku ?? '', price: money(variant.price), inventoryPolicy: variant.inventoryPolicy ?? '', tracked: variant.inventoryItem?.tracked === true, weight: variant.inventoryItem?.measurement?.weight?.value ?? null, weightUnit: variant.inventoryItem?.measurement?.weight?.unit ?? '', cost: money(variant.inventoryItem?.unitCost?.amount) })).sort((a, b) => a.sku.localeCompare(b.sku)),
  };
}

function compareExactVariants(
  expected: ReturnType<typeof planPublicExpected>,
  live: ReturnType<typeof livePublicExpected>,
  handle: string,
): Blocker[] {
  const blockers: Blocker[] = [];
  const expectedSkus = expected.variants.map((variant) => variant.sku);
  const liveSkus = live.variants.map((variant) => variant.sku);
  if (expected.variants.length !== live.variants.length) blockers.push({ code: 'variant-count', message: `expected ${expected.variants.length} variants but Shopify has ${live.variants.length}`, handle });
  if (new Set(expectedSkus).size !== expectedSkus.length || expectedSkus.some((sku) => !sku)) blockers.push({ code: 'plan-variant-duplicates', message: 'reviewed plan has blank or duplicate child SKUs', handle });
  if (new Set(liveSkus).size !== liveSkus.length || liveSkus.some((sku) => !sku)) blockers.push({ code: 'live-variant-duplicates', message: 'Shopify has blank or duplicate child SKUs', handle });
  const expectedBySku = new Map(expected.variants.map((variant) => [variant.sku, variant]));
  const liveBySku = new Map(live.variants.map((variant) => [variant.sku, variant]));
  for (const sku of new Set([...expectedSkus, ...liveSkus])) {
    const want = expectedBySku.get(sku);
    const got = liveBySku.get(sku);
    if (!want || !got) { blockers.push({ code: 'variant-set', message: want ? 'reviewed child SKU is missing from Shopify' : 'Shopify has an unreviewed child SKU', handle, sku }); continue; }
    if (got.price !== want.price || got.cost !== want.cost || got.inventoryPolicy !== want.inventoryPolicy || got.tracked !== want.tracked || got.weight !== want.weight || got.weightUnit !== 'GRAMS' || want.weightUnit !== 'GRAMS') {
      blockers.push({ code: 'variant-facts', message: 'SKU price, cost, policy, tracking, gram weight, or weight unit differs from the reviewed plan', handle, sku });
    }
  }
  return blockers;
}

function readyMediaBlockers(product: LiveProduct, handle: string): Blocker[] {
  const readyImages = (product.media?.nodes ?? []).filter((media) => media.mediaContentType === 'IMAGE' && media.status === 'READY');
  const urls = readyImages.map((media) => media.image?.url ?? '');
  const cdnUrls = shopifyCdnMediaUrlsAfterImport(urls);
  const blockers: Blocker[] = [];
  if (cdnUrls.length < ROYALCHAIN_MINIMUM_IMAGES) blockers.push({ code: 'media-count', message: `requires at least ${ROYALCHAIN_MINIMUM_IMAGES} READY images with Shopify CDN URLs`, handle });
  readyImages.forEach((media, index) => {
    const url = urls[index] ?? '';
    if (!/^https:\/\/cdn\.shopify\.com\//i.test(url)) blockers.push({ code: 'media-url', message: 'READY image must have a nonempty https://cdn.shopify.com URL', handle });
    if (!media.alt?.trim()) blockers.push({ code: 'media-alt', message: 'READY image must have nonempty alt text', handle });
  });
  return blockers;
}

function compareLiveContent(target: ActivationSnapshot['targets'][number], live: LiveProduct): Blocker[] {
  const handle = target.handle;
  const observed = livePublicExpected(live);
  const blockers: Blocker[] = [];
  if (live.vendor !== target.publicExpected.vendor || live.productType !== target.publicExpected.productType || live.category?.id !== target.publicExpected.category || live.title !== target.publicExpected.title || live.descriptionHtml !== target.publicExpected.descriptionHtml) blockers.push({ code: 'public-copy', message: 'vendor, type, category, title, or body differs from reviewed plan', handle });
  if (live.seo?.title !== target.publicExpected.seo.title || live.seo?.description !== target.publicExpected.seo.description) blockers.push({ code: 'seo', message: 'SEO differs from reviewed plan', handle });
  const expectedMetafields = target.publicExpected.metafields;
  const observedMetafields = observed.metafields;
  if (expectedMetafields.some((expected) => !observedMetafields.some((actual) => actual.key === expected.key && actual.value === expected.value))) blockers.push({ code: 'metafields', message: 'expected custom metafield values differ from Shopify', handle });
  if (metafield(live, 'condition') !== 'New' || metafield(live, 'ebay_condition') !== '1500') blockers.push({ code: 'condition', message: 'condition metafields differ from reviewed plan', handle });
  blockers.push(...compareExactVariants(target.publicExpected, observed, handle));
  blockers.push(...readyMediaBlockers(live, handle));
  for (const path of supplierScrubViolations(live)) blockers.push({ code: 'supplier-scrub', message: `supplier name found at ${path}`, handle });
  return blockers;
}

function activationGapsForTarget(target: ActivationSnapshot['targets'][number], live: LiveProduct): ActivationGap[] {
  const gaps: ActivationGap[] = [];
  const handle = target.handle;
  if (live.status !== 'ACTIVE') gaps.push({ code: 'status', message: 'person must set product ACTIVE after review', handle });
  const published = live.resourcePublications?.nodes?.some((p) => p.isPublished && p.publication?.name === ROYALCHAIN_ONLINE_STORE) === true;
  if (!published) gaps.push({ code: 'online-store', message: 'person must publish product to Online Store', handle });
  if (!(live.tags ?? []).includes('ebay')) gaps.push({ code: 'ebay-tag', message: 'person must add ebay tag after review', handle });
  const bySku = new Map(liveVariants(live).map((variant) => [variant.sku ?? '', variant]));
  for (const expected of target.publicExpected.variants) {
    const variant = bySku.get(expected.sku);
    if (!variant) continue;
    const quantity = target.sourceAvailable[expected.sku] === true ? 1 : 0;
    if (variant.inventoryQuantity !== quantity) gaps.push({ code: 'inventory-quantity', message: `person must set inventory quantity ${quantity} for this source availability state`, handle, sku: expected.sku });
  }
  return gaps;
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
  activationGaps: ActivationGap[];
  targets: Array<{ handle: string; productId: string | null; publicExpected: ReturnType<typeof planPublicExpected>; sourceAvailable: Record<string, boolean>; live: ReturnType<typeof livePublicExpected> | null }>;
}

export function buildActivationSnapshot(args: { plan: PlanProduct[]; planText: string; availability?: Availability; availabilityText?: string; liveProducts: LiveProduct[]; generatedAt?: string }): ActivationSnapshot {
  const check = validatePlan(args.plan, args.availability);
  const byHandle = new Map((args.liveProducts ?? []).map((product) => [product.handle ?? '', product]));
  const liveRelevant = args.liveProducts.filter((product) => check.skus.some((sku) => liveVariants(product).some((variant) => variant.sku === sku)) || args.plan.some((planned) => planned.handle === product.handle));
  const blockers = [...check.blockers];
  const activationGaps: ActivationGap[] = [];
  if (liveRelevant.length !== args.plan.length) blockers.push({ code: 'live-scope', message: `fresh Shopify read found ${liveRelevant.length} matching products; expected ${args.plan.length}` });
  const targets = args.plan.map((product) => {
    const live = byHandle.get(product.handle ?? '') ?? null;
    const available: Record<string, boolean> = {};
    for (const variant of planVariants(product)) {
      const sku = String(variant.sku ?? '').trim();
      if (sku && args.availability?.has(sku)) available[sku] = args.availability.get(sku) === true;
    }
    if (!live) blockers.push({ code: 'live-missing', message: 'fresh Shopify read did not find planned handle', handle: product.handle });
    else {
      const target = { handle: product.handle ?? '', productId: live.id ?? null, publicExpected: planPublicExpected(product), sourceAvailable: available, live: livePublicExpected(live) };
      blockers.push(...compareLiveContent(target, live));
      if (canonicalJson(target.live?.tags ?? []) !== canonicalJson(target.publicExpected.tags)) blockers.push({ code: 'tags', message: 'tags differ from the reviewed pre-activation plan', handle: target.handle });
      activationGaps.push(...activationGapsForTarget(target, live));
    }
    return { handle: product.handle ?? '', productId: live?.id ?? null, publicExpected: planPublicExpected(product), sourceAvailable: available, live: live ? livePublicExpected(live) : null };
  });
  const unsigned = { schemaVersion: 1 as const, mode: 'plan-only' as const, generatedAt: args.generatedAt ?? new Date().toISOString(), sourcePlanSha256: sha256Text(args.planText), availabilitySha256: args.availabilityText == null ? null : sha256Text(args.availabilityText), liveReadSha256: sha256Text(canonicalJson(liveRelevant)), targetProducts: args.plan.length, targetVariants: check.skus.length, activationReady: false as const, blockers, activationGaps, targets };
  return { ...unsigned, snapshotSha256: sha256Text(canonicalJson(unsigned)) };
}

export function verifySnapshotChecksum(snapshot: ActivationSnapshot): boolean {
  const { snapshotSha256, ...unsigned } = snapshot;
  return snapshotSha256 === sha256Text(canonicalJson(unsigned));
}

/** Validate the reviewed artifact before a verifier is allowed to query Shopify. */
export function validateReviewedSnapshot(snapshot: ActivationSnapshot): Blocker[] {
  const blockers: Blocker[] = [];
  if (!verifySnapshotChecksum(snapshot)) blockers.push({ code: 'snapshot-checksum', message: 'reviewed snapshot checksum does not match its contents' });
  if (snapshot.targetProducts !== ROYALCHAIN_EXPECTED_PRODUCTS || snapshot.targets.length !== ROYALCHAIN_EXPECTED_PRODUCTS) blockers.push({ code: 'snapshot-product-scope', message: `reviewed snapshot must contain exactly ${ROYALCHAIN_EXPECTED_PRODUCTS} target products` });
  if (snapshot.targetVariants !== ROYALCHAIN_EXPECTED_VARIANTS) blockers.push({ code: 'snapshot-variant-scope', message: `reviewed snapshot must declare exactly ${ROYALCHAIN_EXPECTED_VARIANTS} variants` });
  if (!snapshot.availabilitySha256) blockers.push({ code: 'snapshot-availability', message: 'reviewed snapshot must bind a source availability manifest' });
  if (snapshot.blockers.length !== 0) blockers.push({ code: 'snapshot-original-blockers', message: 'reviewed snapshot contains unresolved original blockers' });
  if (snapshot.activationReady !== false || snapshot.mode !== 'plan-only' || snapshot.schemaVersion !== 1) blockers.push({ code: 'snapshot-invariants', message: 'reviewed snapshot has invalid mode, schema, or activation state' });
  const handles = snapshot.targets.map((target) => target.handle);
  if (handles.some((handle) => !handle) || new Set(handles).size !== handles.length) blockers.push({ code: 'snapshot-handle-set', message: 'reviewed snapshot handles must be nonempty and unique' });
  const expectedVariants = snapshot.targets.flatMap((target) => target.publicExpected.variants);
  const skus = expectedVariants.map((variant) => variant.sku);
  if (skus.length !== ROYALCHAIN_EXPECTED_VARIANTS || skus.some((sku) => !sku) || new Set(skus).size !== skus.length) blockers.push({ code: 'snapshot-sku-set', message: 'reviewed snapshot must contain exactly 93 unique nonempty child SKUs' });
  const expectedSkuSet = new Set(skus);
  for (const target of snapshot.targets) {
    if (target.publicExpected.handle !== target.handle || target.publicExpected.vendor !== ROYALCHAIN_VENDOR || !['Necklaces', 'Bracelets'].includes(target.publicExpected.productType) || target.publicExpected.category !== categoryFor(target.publicExpected.productType)) blockers.push({ code: 'snapshot-target-invariants', message: 'reviewed target has invalid handle, vendor, type, or category', handle: target.handle });
    const expectedCondition = target.publicExpected.metafields.find((field) => field.key === 'condition')?.value;
    const expectedEbayCondition = target.publicExpected.metafields.find((field) => field.key === 'ebay_condition')?.value;
    if (expectedCondition !== 'New' || expectedEbayCondition !== '1500') blockers.push({ code: 'snapshot-condition', message: 'reviewed target must bind New / 1500 condition values', handle: target.handle });
    const targetSkus = target.publicExpected.variants.map((variant) => variant.sku);
    if (new Set(targetSkus).size !== targetSkus.length || targetSkus.some((sku) => !sku)) blockers.push({ code: 'snapshot-target-variants', message: 'reviewed target has blank or duplicate child SKUs', handle: target.handle });
    if (Object.keys(target.sourceAvailable).length !== targetSkus.length || Object.keys(target.sourceAvailable).some((sku) => !expectedSkuSet.has(sku))) blockers.push({ code: 'snapshot-target-availability', message: 'reviewed target availability keys do not exactly match its variants', handle: target.handle });
    for (const variant of target.publicExpected.variants) if (!variant.price || !variant.cost || !exactWeight(variant.weight, variant.weightUnit)) blockers.push({ code: 'snapshot-variant-facts', message: 'reviewed target lacks exact price, cost, or GRAMS weight', handle: target.handle, sku: variant.sku });
  }
  return blockers;
}

export function verifyFinalState(snapshot: ActivationSnapshot, liveProducts: LiveProduct[]): { blockers: Blocker[]; activationGaps: ActivationGap[]; checkedProducts: number; checkedVariants: number } {
  const blockers: Blocker[] = [];
  const activationOnly: ActivationGap[] = [];
  blockers.push(...validateReviewedSnapshot(snapshot));
  const byHandle = new Map(liveProducts.map((product) => [product.handle ?? '', product]));
  let checkedVariants = 0;
  for (const target of snapshot.targets) {
    const live = byHandle.get(target.handle);
    if (!live) { blockers.push({ code: 'live-missing', message: 'final verification read did not find handle', handle: target.handle }); continue; }
    blockers.push(...compareLiveContent(target, live));
    const contentTags = target.publicExpected.tags;
    const expectedTags = [...contentTags.filter((tag) => tag !== 'media-missing'), 'ebay'].sort();
    if (canonicalJson([...(live.tags ?? [])].sort()) !== canonicalJson(expectedTags)) blockers.push({ code: 'tags', message: 'final tags do not match the reviewed tag set plus ebay', handle: target.handle });
    activationOnly.push(...activationGapsForTarget(target, live));
    checkedVariants += target.publicExpected.variants.length;
  }
  if (liveProducts.length !== snapshot.targetProducts) blockers.push({ code: 'live-scope', message: `final verification read returned ${liveProducts.length} target products; expected ${snapshot.targetProducts}` });
  return { blockers, activationGaps: activationOnly, checkedProducts: snapshot.targets.length, checkedVariants };
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
