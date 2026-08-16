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
 * - in catalog, not in feed            → archive (never delete; URLs persist),
 *   but only for kinds whose feed fetch succeeded — a dead feed must not
 *   archive its whole catalog segment
 *
 * Archiving carries two very different causes, and `present` splits them.
 * A stock ref absent from this run's feed is gone — sold, most likely
 * (`left_feed`). One the feed still lists but that this run refused to price
 * is not gone at all (`held_in_feed`): it is off the storefront until the
 * numbers work, and may be back next hour. Both archive — an unpriceable item
 * must not stay buyable — but only `left_feed` earns the permanent URL
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
    if (have.status === 'ARCHIVED') {
      decisions.push({ handle: have.handle, action: 'skip', reason: 'already_archived', productId: have.id });
    } else {
      decisions.push({
        handle: have.handle,
        action: 'archive',
        reason: present.has(have.handle) ? 'held_in_feed' : 'left_feed',
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
