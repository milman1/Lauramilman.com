/**
 * Weekly vendor catalog sync: decide, without touching Shopify, what each
 * imported product needs (src/vendors/sync.ts writes it).
 *
 * A product of ours matches a vendor product by its `source-product-<id>`
 * tag, else through its variants: SKU `${skuPrefix}${vendor variant id}`, the
 * vendor's own SKU, or the only variant on both sides. Prices follow the
 * vendor (config/pricing.ts VENDOR_CATALOG_SYNC); a product the vendor no
 * longer lists, or lists with nothing available, is drafted.
 */
import { VENDOR_CATALOG_SYNC, type VendorCatalogConfig } from '../../config/pricing.js';

export interface VendorVariant {
  id: number | string;
  sku?: string | null;
  price: string;
  available?: boolean;
}

export interface VendorProduct {
  id: number | string;
  title: string;
  handle: string;
  variants: VendorVariant[];
}

export interface OurVariant {
  id: string;
  sku: string | null;
  price: string;
}

export interface OurProduct {
  id: string;
  handle: string;
  title: string;
  status: string;
  tags: string[];
  variants: OurVariant[];
  /** True when the product has more variants than were read. */
  variantsTruncated?: boolean;
}

export interface PriceChange {
  productId: string;
  handle: string;
  variantId: string;
  sku: string | null;
  from: number;
  to: number;
}

export interface VendorPlan {
  vendor: string;
  vendorProducts: number;
  ours: number;
  oursActive: number;
  matched: number;
  priceUpdates: PriceChange[];
  /** Price moves larger than maxPriceChangeShare, not written. */
  priceHeld: PriceChange[];
  /** Variants whose vendor price is 0 or unreadable ("contact for pricing"). */
  noVendorPrice: Array<{ handle: string; sku: string | null }>;
  /** ACTIVE products the vendor no longer lists or has nothing available for. */
  drafts: Array<{ productId: string; handle: string; reason: 'not_in_vendor_catalog' | 'sold_out_at_vendor' }>;
  /** True when drafts exceeded the brake; drafts is then left unapplied. */
  draftBrake: boolean;
  draftLimit: number;
  /** DRAFT products the sync withdrew earlier that the vendor has available again. */
  availableAgain: string[];
  unmatchedVariants: Array<{ handle: string; sku: string | null }>;
  skipped: Array<{ handle: string; reason: string }>;
}

export const WITHDRAWN_TAG = 'vendor-sync-withdrawn';
const SOURCE_TAG = /^source-product-(\d+)$/;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Products of ours that belong to this vendor: its import tag, or a legacy SKU. */
export function belongsToVendor(p: OurProduct, vendor: VendorCatalogConfig): boolean {
  if (p.tags.includes(vendor.importTag)) return true;
  const legacy = new Set(vendor.legacySkus ?? []);
  return legacy.size > 0 && p.variants.some((v) => v.sku !== null && legacy.has(v.sku));
}

export function planVendor(
  vendor: VendorCatalogConfig,
  vendorProducts: VendorProduct[],
  ourProducts: OurProduct[],
  limits = VENDOR_CATALOG_SYNC,
): VendorPlan {
  const byId = new Map<string, VendorProduct>();
  const variantById = new Map<string, { product: VendorProduct; variant: VendorVariant }>();
  const variantBySku = new Map<string, { product: VendorProduct; variant: VendorVariant } | null>();
  for (const product of vendorProducts) {
    byId.set(String(product.id), product);
    for (const variant of product.variants) {
      variantById.set(String(variant.id), { product, variant });
      const sku = variant.sku?.trim();
      // A SKU on two vendor variants is ambiguous: never price from it.
      if (sku) variantBySku.set(sku, variantBySku.has(sku) ? null : { product, variant });
    }
  }

  const mine = ourProducts.filter((p) => belongsToVendor(p, vendor));
  const plan: VendorPlan = {
    vendor: vendor.name,
    vendorProducts: vendorProducts.length,
    ours: mine.length,
    oursActive: mine.filter((p) => p.status === 'ACTIVE').length,
    matched: 0,
    priceUpdates: [],
    priceHeld: [],
    noVendorPrice: [],
    drafts: [],
    draftBrake: false,
    draftLimit: 0,
    availableAgain: [],
    unmatchedVariants: [],
    skipped: [],
  };

  for (const p of mine) {
    if (p.status === 'ARCHIVED') continue;
    if (p.variantsTruncated) {
      plan.skipped.push({ handle: p.handle, reason: 'more variants than were read' });
      continue;
    }

    const resolveVariant = (v: OurVariant) => {
      const sku = v.sku?.trim() ?? '';
      if (vendor.skuPrefix && sku.startsWith(vendor.skuPrefix)) {
        return variantById.get(sku.slice(vendor.skuPrefix.length)) ?? null;
      }
      return sku ? variantBySku.get(sku) ?? null : null;
    };

    // Two vendor variants share this SKU: never guess, and never draft on it.
    const ambiguous = p.variants.some((v) => {
      const sku = v.sku?.trim() ?? '';
      return !(vendor.skuPrefix && sku.startsWith(vendor.skuPrefix)) && variantBySku.get(sku) === null;
    });
    if (ambiguous) {
      plan.skipped.push({ handle: p.handle, reason: 'SKU appears on more than one vendor variant' });
      continue;
    }

    const sourceTag = p.tags.map((t) => SOURCE_TAG.exec(t)?.[1]).find(Boolean);
    let product = sourceTag ? byId.get(sourceTag) : undefined;
    const pairs = p.variants.map((v) => ({ ours: v, theirs: resolveVariant(v) }));
    if (!product) product = pairs.find((x) => x.theirs)?.theirs?.product;
    // One variant on each side with no SKU to go on (vendor SKUs can be blank).
    if (product && pairs.length === 1 && !pairs[0]!.theirs && product.variants.length === 1) {
      pairs[0]!.theirs = { product, variant: product.variants[0]! };
    }

    if (!product) {
      if (p.status === 'ACTIVE') plan.drafts.push({ productId: p.id, handle: p.handle, reason: 'not_in_vendor_catalog' });
      continue;
    }
    plan.matched += 1;

    const anyAvailable = product.variants.some((v) => v.available !== false);
    if (!anyAvailable && p.status === 'ACTIVE') {
      plan.drafts.push({ productId: p.id, handle: p.handle, reason: 'sold_out_at_vendor' });
    }
    if (anyAvailable && p.status === 'DRAFT' && p.tags.includes(WITHDRAWN_TAG)) plan.availableAgain.push(p.handle);

    for (const { ours, theirs } of pairs) {
      if (!theirs || theirs.product !== product) {
        plan.unmatchedVariants.push({ handle: p.handle, sku: ours.sku });
        continue;
      }
      const vendorPrice = Number(theirs.variant.price);
      if (!Number.isFinite(vendorPrice) || vendorPrice <= 0) {
        plan.noVendorPrice.push({ handle: p.handle, sku: ours.sku });
        continue;
      }
      const to = round2(vendorPrice * vendor.priceFactor);
      const from = Number(ours.price);
      if (Math.abs(to - from) < 0.005) continue;
      const change: PriceChange = { productId: p.id, handle: p.handle, variantId: ours.id, sku: ours.sku, from, to };
      if (from > 0 && Math.abs(to - from) / from > limits.maxPriceChangeShare) plan.priceHeld.push(change);
      else plan.priceUpdates.push(change);
    }
  }

  // A broken or truncated vendor feed looks like everything selling at once.
  plan.draftLimit = Math.max(limits.minDraftBrake, Math.floor(plan.oursActive * limits.maxDraftShare));
  plan.draftBrake = plan.drafts.length > plan.draftLimit;
  return plan;
}
