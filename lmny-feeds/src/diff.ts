import { MEDIA_MISSING_TAG } from './product.js';
import type { CatalogEntry, Decision, DesiredEntry, Kind } from './types.js';

const PREFIX_TO_KIND: Record<string, Kind> = { nd: 'natural', lg: 'lab', w: 'watch' };

export function kindForHandle(handle: string): Kind | null {
  const prefix = handle.split('-', 1)[0] ?? '';
  return PREFIX_TO_KIND[prefix] ?? null;
}

/**
 * Diff the desired feed state against the Shopify catalog by handle + content_hash.
 *
 * - in feed, not in catalog            → create
 * - in both, hash differs              → update
 * - in both, hash equal, not ACTIVE    → update (reactivate), unless the
 *   product is quarantined with the media-missing tag
 * - in both, hash equal, ACTIVE        → skip (API cost control)
 * - loose diamond in catalog, not in feed → delete, because unavailable
 *   supplier products must not remain in Shopify
 * - watch in catalog, not in feed       → archive (URLs persist)
 * - in catalog, still in feed but held → archive, so a temporary gate can
 *   reactivate it later
 * - destructive actions only apply to kinds whose feed fetch succeeded — a
 *   dead feed must not remove its whole catalog segment
 *
 * Archiving carries two very different causes, and `present` splits them.
 * A stock ref absent from this run's feed is gone — sold, most likely
 * (`left_feed`). One the feed still lists but that this run refused to price
 * is not gone at all (`held_in_feed`): it is off the storefront until the
 * numbers work, and may be back next hour. Held items archive; loose diamonds
 * that left the feed are deleted. Only `left_feed` earns the permanent URL
 * redirect that would otherwise strand the product page when it returns.
 * Without the split, "131 watches archived" reads as sold-out inventory when
 * it can equally be a pricing rule that moved.
 */
export function diffCatalog(
  desired: DesiredEntry[],
  catalog: CatalogEntry[],
  fetchedKinds: Set<Kind>,
  present: Set<string> = new Set(),
): Decision[] {
  const decisions: Decision[] = [];
  const catalogByHandle = new Map(catalog.map((c) => [c.handle, c]));
  const desiredHandles = new Set(desired.map((d) => d.handle));

  for (const want of desired) {
    const have = catalogByHandle.get(want.handle);
    if (!have) {
      decisions.push({ handle: want.handle, action: 'create', reason: 'new' });
    } else if (have.contentHash !== want.contentHash) {
      decisions.push({ handle: want.handle, action: 'update', reason: 'hash_changed', productId: have.id });
    } else if (have.status !== 'ACTIVE') {
      if (have.tags.includes(MEDIA_MISSING_TAG)) {
        decisions.push({ handle: want.handle, action: 'skip', reason: 'media_missing_quarantine', productId: have.id });
      } else {
        decisions.push({ handle: want.handle, action: 'update', reason: 'reactivate', productId: have.id });
      }
    } else {
      decisions.push({ handle: want.handle, action: 'skip', reason: 'unchanged', productId: have.id });
    }
  }

  for (const have of catalog) {
    if (desiredHandles.has(have.handle)) continue;
    const kind = kindForHandle(have.handle);
    if (kind === null) continue; // not one of ours
    if (!fetchedKinds.has(kind)) {
      decisions.push({ handle: have.handle, action: 'skip', reason: 'feed_unavailable', productId: have.id });
      continue;
    }
    const reason = present.has(have.handle) ? 'held_in_feed' : 'left_feed';
    if (reason === 'left_feed' && kind !== 'watch') {
      decisions.push({
        handle: have.handle,
        action: 'delete',
        reason,
        productId: have.id,
      });
      continue;
    }
    if (have.status === 'ARCHIVED') {
      decisions.push({ handle: have.handle, action: 'skip', reason: 'already_archived', productId: have.id });
    } else {
      decisions.push({
        handle: have.handle,
        action: 'archive',
        reason,
        productId: have.id,
      });
    }
  }

  return decisions;
}

/** Holds that must not archive or overwrite an existing Shopify price. */
export const PRICING_REVIEW_HOLD_REASONS = new Set(['watch_no_cost']);

/**
 * `no_cost` watches stay buyable at their current price.
 * Convert a would-be `held_in_feed` archive into a skip so sync can tag
 * `pricing-review` without touching the variant.
 */
export function skipPricingReviewArchives(decisions: Decision[], reviewHandles: Set<string>): void {
  for (const d of decisions) {
    if (d.action === 'archive' && reviewHandles.has(d.handle)) {
      d.action = 'skip';
      d.reason = 'pricing_review';
    }
  }
}

/**
 * Hash match skips the product even when Shopify still holds the single photo
 * the old ImageLink-only parse attached. productSet will re-send `files` only
 * on create/update, so promote those skips before the write loop.
 *
 * Watches only — a store-wide sweep would rewrite tens of thousands of stones.
 * Does not touch media-missing quarantine (those have no usable image and
 * go through the rescue path).
 */
export function promoteShortMediaUpdates(
  decisions: Decision[],
  catalog: CatalogEntry[],
  feedImageCountByHandle: Map<string, number>,
): number {
  const catalogByHandle = new Map(catalog.map((c) => [c.handle, c]));
  let promoted = 0;
  for (const d of decisions) {
    if (d.action !== 'skip' || d.reason !== 'unchanged') continue;
    if (kindForHandle(d.handle) !== 'watch') continue;
    const have = catalogByHandle.get(d.handle);
    const wantCount = feedImageCountByHandle.get(d.handle);
    if (!have || wantCount == null) continue;
    if (have.imageCount < wantCount) {
      d.action = 'update';
      d.reason = 'media_short';
      promoted += 1;
    }
  }
  return promoted;
}

/**
 * Hash match skips the product even when Shopify still reports untracked
 * inventory (qty 0 to Admin apps). Promote those feed products so productSet
 * can write tracked qty 1. Does not touch media-missing quarantine. Call
 * only when a location GID is available this run.
 *
 * `shouldTrack` limits the backfill to SKUs that should be written as
 * tracked inventory (watches at qty 1 and loose diamonds at qty 0).
 */
export function promoteUntrackedInventoryUpdates(
  decisions: Decision[],
  catalog: CatalogEntry[],
  shouldTrack?: (handle: string) => boolean,
): number {
  const catalogByHandle = new Map(catalog.map((c) => [c.handle, c]));
  let promoted = 0;
  for (const d of decisions) {
    if (d.action !== 'skip' || d.reason !== 'unchanged') continue;
    if (kindForHandle(d.handle) === null) continue;
    if (shouldTrack && !shouldTrack(d.handle)) continue;
    const have = catalogByHandle.get(d.handle);
    if (!have || have.inventoryTracked === true) continue;
    d.action = 'update';
    d.reason = 'inventory_untracked';
    promoted += 1;
  }
  return promoted;
}

/**
 * Hash-skipped diamonds (and any other handle) that still show tracked
 * qty > 0 must be rewritten to qty 0 so Uploadify delists them. productSet
 * writes tracked qty 0; CONTINUE keeps the Online Store selling.
 */
export function promoteUntrackNonMarketplaceInventory(
  decisions: Decision[],
  catalog: CatalogEntry[],
  shouldTrack: (handle: string) => boolean,
): number {
  const catalogByHandle = new Map(catalog.map((c) => [c.handle, c]));
  let promoted = 0;
  for (const d of decisions) {
    if (d.action !== 'skip' || d.reason !== 'unchanged') continue;
    if (kindForHandle(d.handle) === null) continue;
    if (shouldTrack(d.handle)) continue;
    const have = catalogByHandle.get(d.handle);
    if (!have || have.inventoryTracked !== true) continue;
    if ((have.inventoryQuantity ?? 0) <= 0) continue;
    d.action = 'update';
    d.reason = 'uploadify_qty_zero';
    promoted += 1;
  }
  return promoted;
}

/**
 * Hash-skipped watches (desired qty > 0) that Shopify still shows at a
 * different on-hand count. The diamond qty-0 pass can leave watches at 0
 * when productSet/inventoryActivate cannot set quantity on an already-active
 * location — Uploadify then delists them. Restore via inventorySetQuantities
 * without rewriting the product.
 */
export function promoteMarketplaceQuantityUpdates(
  decisions: Decision[],
  catalog: CatalogEntry[],
  desiredQtyByHandle: Map<string, number>,
): number {
  const catalogByHandle = new Map(catalog.map((c) => [c.handle, c]));
  let promoted = 0;
  for (const d of decisions) {
    if (d.action !== 'skip' || d.reason !== 'unchanged') continue;
    const desired = desiredQtyByHandle.get(d.handle);
    if (desired == null || desired <= 0) continue;
    const have = catalogByHandle.get(d.handle);
    if (!have || have.inventoryTracked !== true) continue;
    if ((have.inventoryQuantity ?? 0) === desired) continue;
    d.action = 'update';
    d.reason = 'uploadify_qty_restore';
    promoted += 1;
  }
  return promoted;
}

/** @deprecated Use promoteUntrackedInventoryUpdates */
export const promoteWatchInventoryUpdates = promoteUntrackedInventoryUpdates;

/**
 * Archive merchant-confirmed unavailable products even when they are not
 * Belgium `w-*` handles. Call after the hash/media pass so a denylisted
 * listing cannot be reopened as a gallery backfill.
 */
export function applyUnavailableArchives(
  decisions: Decision[],
  catalog: CatalogEntry[],
  isUnavailable: (handle: string) => boolean,
): number {
  const byHandle = new Map(decisions.map((d) => [d.handle, d]));
  let archived = 0;
  for (const have of catalog) {
    if (!isUnavailable(have.handle)) continue;
    if (have.status === 'ARCHIVED') continue;
    const existing = byHandle.get(have.handle);
    if (existing) {
      if (existing.action === 'archive') continue;
      existing.action = 'archive';
      existing.reason = 'merchant_unavailable';
      existing.productId = have.id;
    } else {
      decisions.push({
        handle: have.handle,
        action: 'archive',
        reason: 'merchant_unavailable',
        productId: have.id,
      });
    }
    archived += 1;
  }
  return archived;
}
