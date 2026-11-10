import { sanitizeHandle } from './product.js';
import type { ShopifyClient } from '../shopify.js';

/**
 * Merchant listings: Back Vault pieces the merchant listed by hand before the
 * sync existed (handle = the supplier's own handle, no `bv-` prefix, title
 * "Pre-Owned …"). Merchant decision 2026-11-04:
 *
 *  - the merchant's listing is the one that stays: its title, description,
 *    price and SEO are never written by the sync;
 *  - the sync must not create or keep a `bv-` copy of a piece the merchant
 *    already lists (the copy is archived and its URL redirected to the
 *    merchant's listing);
 *  - when the supplier no longer has the piece in stock, the merchant's
 *    listing moves to DRAFT, never ARCHIVED or deleted, so it can be switched
 *    back by hand if the piece returns.
 *
 * The sync never activates a merchant listing (docs/seo/jewelry-activation-gate.md).
 */

export interface MerchantListing {
  id: string;
  handle: string;
  status: string;
}

/** Supplier availability by its own handle, read from the full products.json. */
export type SupplierAvailability = Map<string, boolean>;

/** A merchant listing whose handle ends in a supplier stock number (RR9205, J10171, A71154). */
const STOCK_SUFFIX = /-(rr|j|a)\d+$/;

/** Most merchant listings one run may move to draft before it refuses and reports. */
export const MAX_MERCHANT_DRAFTS_PER_RUN = 20;

/**
 * Below this many rows the full-catalog read is treated as incomplete and no
 * merchant listing is drafted: an empty or truncated read would otherwise look
 * like every piece sold at once.
 */
export const MIN_FULL_CATALOG_ROWS = 500;

export interface MerchantListingPlan {
  /** `bv-` handles the sync must not create or keep, mapped to the merchant listing's handle. */
  suppressed: Map<string, string>;
  /** ACTIVE merchant listings the supplier no longer has in stock. */
  toDraft: MerchantListing[];
  /** ACTIVE merchant listings the supplier still has. */
  inStock: number;
  /** Set when drafting was skipped for safety; the report says why. */
  draftsHeld?: string;
}

/** Any variant available, keyed by the supplier handle, from raw products.json rows. */
export function supplierAvailability(rows: unknown[]): SupplierAvailability {
  const out: SupplierAvailability = new Map();
  for (const row of rows) {
    const r = row as { handle?: unknown; variants?: Array<{ available?: unknown }> };
    if (typeof r.handle !== 'string' || !Array.isArray(r.variants)) continue;
    out.set(sanitizeHandle(r.handle), r.variants.some((v) => v.available === true));
  }
  return out;
}

/**
 * Pure: decide which `bv-` copies to suppress and which merchant listings to
 * draft. `availability` is null when the full catalog could not be read; then
 * copies are still suppressed (that needs no supplier data) but nothing is
 * drafted.
 */
export function planMerchantListings(
  listings: MerchantListing[],
  availability: SupplierAvailability | null,
  fullCatalogRows: number,
  maxDrafts = MAX_MERCHANT_DRAFTS_PER_RUN,
): MerchantListingPlan {
  const suppressed = new Map<string, string>();
  const toDraft: MerchantListing[] = [];
  let inStock = 0;
  for (const listing of listings) {
    if (listing.status !== 'ACTIVE') continue;
    const key = sanitizeHandle(listing.handle);
    suppressed.set(`bv-${key}`, listing.handle);
    if (!availability) continue;
    const available = availability.get(key);
    if (available === true) {
      inStock += 1;
      continue;
    }
    // Listed but unavailable is sold. Missing from the catalog is removed, but
    // only trusted for a handle that carries a supplier stock number, so an
    // unrelated listing that happens to share the tag is never touched.
    if (available === false || STOCK_SUFFIX.test(key)) toDraft.push(listing);
  }
  const plan: MerchantListingPlan = { suppressed, toDraft, inStock };
  if (toDraft.length === 0) return plan;
  if (fullCatalogRows < MIN_FULL_CATALOG_ROWS) {
    plan.toDraft = [];
    plan.draftsHeld = `full catalog returned ${fullCatalogRows} rows (< ${MIN_FULL_CATALOG_ROWS}); no merchant listing drafted`;
  } else if (toDraft.length > maxDrafts) {
    plan.toDraft = [];
    plan.draftsHeld =
      `${toDraft.length} merchant listings look sold (> ${maxDrafts} per run); none drafted — ` +
      `review: ${toDraft.map((l) => l.handle).join(', ')}`;
  }
  return plan;
}

/**
 * ACTIVE and DRAFT pre-owned listings the sync does not own: tagged Pre-Owned,
 * not tagged backvault-feed, and not a Belgium Dia watch (`w-` handles).
 */
export async function fetchMerchantListings(client: ShopifyClient): Promise<MerchantListing[]> {
  const out: MerchantListing[] = [];
  let after: string | null = null;
  do {
    const data: {
      products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: MerchantListing[] };
    } = await client.gql(
      `query MerchantListings($after: String) {
        products(first: 100, after: $after, query: "tag:'Pre-Owned' AND -tag:'backvault-feed'") {
          pageInfo { hasNextPage endCursor }
          nodes { id handle status }
        }
      }`,
      { after },
    );
    for (const node of data.products.nodes) {
      if (node.handle.startsWith('w-') || node.handle.startsWith('bv-')) continue;
      out.push(node);
    }
    after = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (after);
  return out;
}
