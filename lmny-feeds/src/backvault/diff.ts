import type { BackVaultCatalogEntry } from './catalog.js';

export type Action = 'create' | 'update' | 'archive' | 'skip' | 'publish';

export interface Decision {
  handle: string;
  action: Action;
  reason: string;
  productId?: string;
}

export interface DesiredEntry {
  handle: string;
  contentHash: string;
  /** Retail this run would write. Only the competitor-unavailable guard reads it. */
  priceUsd?: number;
}

/** Reason on a skip held back by the competitor-unavailable guard. */
export const HELD_PRICE_DROP_REASON = 'competitor-unavailable-would-lower-price';

export interface DiffOptions {
  /**
   * True only when the competitor FETCH FAILED this run. An empty competitor
   * index is a legitimate zero-match result and must not set this: the two
   * cases are indistinguishable from the index alone, so the caller passes
   * the fact through.
   */
  competitorUnavailable?: boolean;
}

/**
 * Diff this run's feed against the catalog of everything tagged
 * 'backvault-feed'. Same create/update/skip/archive shape as the Belgium
 * Dia sync's diffCatalog (src/diff.ts), simplified: there's only one feed
 * here, so every handle tagged backvault-feed but missing from `desired`
 * unambiguously left the supplier's new-arrivals/in-stock set — sold,
 * pulled, or no longer a top-designer match — and archives. Never deleted:
 * archived products keep their URL (redirected to the designer's
 * collection, same as the diamond/watch sync).
 *
 * When `options.competitorUnavailable` is set, any update that would LOWER a
 * live price is held back (skip / HELD_PRICE_DROP_REASON). Retail is
 * max((cost + competitor) / 2, cost + markup), so a piece matched on the
 * competitor sits at or above the flat markup; with the competitor fetch
 * failed every one of those would silently drop to the flat price this run
 * and be raised again by the next successful run. That churn on a live
 * storefront is worse than a week of stale pricing. Price rises and
 * unchanged prices are written as normal, and a successful competitor fetch
 * leaves behaviour exactly as it was.
 */
export function diffBackVaultCatalog(
  desired: DesiredEntry[],
  catalog: BackVaultCatalogEntry[],
  options: DiffOptions = {},
): Decision[] {
  const decisions: Decision[] = [];
  const catalogByHandle = new Map(catalog.map((c) => [c.handle, c]));
  const desiredHandles = new Set(desired.map((d) => d.handle));

  for (const want of desired) {
    const have = catalogByHandle.get(want.handle);
    if (!have) {
      decisions.push({ handle: want.handle, action: 'create', reason: 'new' });
    } else if (have.contentHash !== want.contentHash) {
      if (wouldLowerPrice(options, want, have)) {
        decisions.push({ handle: want.handle, action: 'skip', reason: HELD_PRICE_DROP_REASON, productId: have.id });
      } else {
        decisions.push({ handle: want.handle, action: 'update', reason: 'hash_changed', productId: have.id });
      }
    } else if (have.status !== 'ACTIVE') {
      decisions.push({ handle: want.handle, action: 'update', reason: 'reactivate', productId: have.id });
    } else if (have.missingChannels.length > 0) {
      // productSet does not publish anything. The first live run created 741
      // ACTIVE products that 404 on the storefront until this fires, and since
      // 2026-09-10 the same decision also covers a piece that is on the Online
      // Store but missing one of the other channels in config/channels.ts.
      decisions.push({ handle: want.handle, action: 'publish', reason: 'unpublished', productId: have.id });
    } else {
      decisions.push({ handle: want.handle, action: 'skip', reason: 'unchanged', productId: have.id });
    }
  }

  for (const have of catalog) {
    if (desiredHandles.has(have.handle)) continue;
    if (have.status === 'ARCHIVED') {
      decisions.push({ handle: have.handle, action: 'skip', reason: 'already_archived', productId: have.id });
    } else {
      decisions.push({ handle: have.handle, action: 'archive', reason: 'left_feed', productId: have.id });
    }
  }

  return decisions;
}

/**
 * True when this run has no competitor prices and the update would write a
 * strictly lower ticket than the one on the store.
 */
function wouldLowerPrice(options: DiffOptions, want: DesiredEntry, have: BackVaultCatalogEntry): boolean {
  if (!options.competitorUnavailable) return false;
  if (typeof want.priceUsd !== 'number' || typeof have.price !== 'number') return false;
  return want.priceUsd < have.price;
}

/** How many decisions the competitor-unavailable guard held back. */
export function heldForCompetitorUnavailable(decisions: Decision[]): number {
  return decisions.filter((d) => d.action === 'skip' && d.reason === HELD_PRICE_DROP_REASON).length;
}

/** Re-open hash-skips that still report untracked / qty 0 to Admin apps. */
export function promoteBackVaultInventoryUpdates(
  decisions: Decision[],
  catalog: BackVaultCatalogEntry[],
): number {
  const catalogByHandle = new Map(catalog.map((c) => [c.handle, c]));
  let promoted = 0;
  for (const d of decisions) {
    if (d.action !== 'skip' || d.reason !== 'unchanged') continue;
    const have = catalogByHandle.get(d.handle);
    if (!have || have.inventoryTracked === true) continue;
    d.action = 'update';
    d.reason = 'inventory_untracked';
    promoted += 1;
  }
  return promoted;
}
