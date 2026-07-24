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
 */
export function diffCatalog(
  desired: DesiredEntry[],
  catalog: CatalogEntry[],
  fetchedKinds: Set<Kind>,
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
      decisions.push({ handle: have.handle, action: 'archive', reason: 'left_feed_or_failed_gates', productId: have.id });
    }
  }

  return decisions;
}
