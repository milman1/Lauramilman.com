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
