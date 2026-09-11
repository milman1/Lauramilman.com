import type { BackVaultCatalogEntry } from './catalog.js';
import { handleFor } from './product.js';
import type { BackVaultItem } from './types.js';

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
}

export interface PricePinStats {
  /** Pieces whose computed price was replaced by the price already on the store. */
  pinned: number;
  /** Pieces skipped by the check because their live price cannot be read (multi-variant). */
  multiVariant: number;
}

/**
 * Pin prices to the live ticket when the competitor fetch FAILED this run.
 *
 * Retail is max((cost + competitor) / 2, cost + markup), so a piece matched on
 * the competitor sits at or above the flat markup. With no competitor prices
 * every matched piece would recompute to the flat price, drop on the storefront
 * this week, and be raised again by the next successful run — price churn on
 * live listings. So the computed price is replaced by the price already on the
 * store wherever it would fall, and everything else about the piece (images,
 * title, tags, cost, specs, channels, status) is written exactly as normal.
 * The pin happens BEFORE the content hash is computed, so the hash matches
 * what is actually written and the piece does not stay dirty for every
 * following run.
 *
 * Call this only when the fetch failed. An empty competitor index is a
 * legitimate zero-match result and must not trigger it: the two are
 * indistinguishable from the index alone, which is why the caller passes the
 * fact rather than guessing.
 *
 * A piece with more than one variant has no readable live price
 * (`variants(first: 1)` says nothing about the rest), so it stands down and is
 * counted separately rather than silently treated as unpriced.
 */
export function pinLivePricesWhenCompetitorUnavailable(
  items: BackVaultItem[],
  catalog: BackVaultCatalogEntry[],
): PricePinStats {
  const catalogByHandle = new Map(catalog.map((c) => [c.handle, c]));
  const stats: PricePinStats = { pinned: 0, multiVariant: 0 };
  for (const item of items) {
    const have = catalogByHandle.get(handleFor(item));
    if (!have) continue; // a new piece has no live price to protect
    if (have.variantCount > 1) {
      stats.multiVariant += 1;
      continue;
    }
    if (typeof have.price !== 'number') continue;
    if (item.priceUsd >= have.price) continue; // a rise or no change is written as normal
    item.priceUsd = have.price;
    stats.pinned += 1;
  }
  return stats;
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
 * Nothing here knows about competitor pricing: a missing competitor is
 * handled upstream by pinLivePricesWhenCompetitorUnavailable, which changes
 * the price the run writes, never whether it writes. A piece is never held
 * out of an update for a pricing reason — doing that also withheld its
 * reactivation, its missing sales channels, and that week's images.
 */
export function diffBackVaultCatalog(desired: DesiredEntry[], catalog: BackVaultCatalogEntry[]): Decision[] {
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
