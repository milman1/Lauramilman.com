import { BACKVAULT } from '../../config/pricing.js';
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
  /** Which ones, so the report can name them instead of just counting them. */
  pinnedHandles: string[];
  /**
   * Pieces the check stood down on because they have more than one variant AND
   * whose first variant says the price would have fallen — the ones a reader
   * should look at, not every multi-variant piece in the run.
   */
  multiVariant: number;
}

/**
 * Price evidence: does this live ticket look like it came from a competitor
 * midpoint, or from the flat rule?
 *
 * Retail is max((cost + competitor) / 2, cost + markup), so a flat-priced piece
 * sits at EXACTLY cost + markup and a competitor-matched one sits above it.
 * With the cost already recorded on the product (Cost per item), the two are
 * told apart without storing the competitor price anywhere.
 */
function livePriceLooksLikeAMidpoint(livePrice: number, storedCost: number | null): boolean {
  if (typeof storedCost !== 'number' || !Number.isFinite(storedCost)) return false;
  // Strictly greater, with a cent of tolerance for the round-trip through
  // Shopify's decimal strings.
  return livePrice - (storedCost + BACKVAULT.markupUsd) > 0.005;
}

/**
 * Pin prices to the live ticket when the competitor index is missing or
 * INCOMPLETE this run — but only for the pieces that rule is meant to protect.
 *
 * Retail is max((cost + competitor) / 2, cost + markup), so a piece matched on
 * the competitor sits ABOVE the flat markup. With no competitor price for it
 * this run, it would recompute to the flat price, drop on the storefront this
 * week, and be raised again by the next good run — price churn on live
 * listings. So its computed price is replaced by the price already on the
 * store, and everything else about the piece (images, title, tags, cost,
 * specs, channels, status) is written exactly as normal. The pin happens
 * BEFORE the content hash is computed, so the hash matches what is actually
 * written and the piece does not stay dirty for every following run.
 *
 * THREE pieces are deliberately never pinned:
 *
 *  - One that DID match in the index we managed to read (`competitorPriceUsd`
 *    is set). Its competitor data is not missing, so its midpoint is written
 *    as normal, up or down. Without this the partial-index repair would throw
 *    away the very prices it exists to recover.
 *  - One whose live ticket equals its stored cost plus the markup: it was
 *    flat-priced, never matched, so a fall in the computed price is a genuine
 *    supplier markdown and must reach the storefront. This is what stops the
 *    pin becoming a one-way ratchet on a retailer whose catalogue is larger
 *    than its own pagination cap, where the index can never be complete and
 *    the pin would otherwise be armed on every run forever.
 *  - One whose stored cost cannot be read: with no cost there is no evidence
 *    of a midpoint, and inventing one would ratchet the same way.
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
  const stats: PricePinStats = { pinned: 0, pinnedHandles: [], multiVariant: 0 };
  for (const item of items) {
    const handle = handleFor(item);
    const have = catalogByHandle.get(handle);
    if (!have) continue; // a new piece has no live price to protect
    // Matched in whatever index we did read: nothing is missing for this piece.
    if (typeof item.competitorPriceUsd === 'number') continue;
    if (have.variantCount > 1) {
      // Only worth naming when the first variant says this piece would have
      // been pinned; a multi-variant piece whose price is rising or unchanged,
      // or that was flat-priced, was never in question.
      if (
        typeof have.firstVariantPrice === 'number' &&
        item.priceUsd < have.firstVariantPrice &&
        livePriceLooksLikeAMidpoint(have.firstVariantPrice, have.storedCost)
      ) {
        stats.multiVariant += 1;
      }
      continue;
    }
    if (typeof have.price !== 'number') continue;
    if (item.priceUsd >= have.price) continue; // a rise or no change is written as normal
    // Flat-priced today: this fall is a real markdown, not a lost match.
    if (!livePriceLooksLikeAMidpoint(have.price, have.storedCost)) continue;
    item.priceUsd = have.price;
    stats.pinned += 1;
    stats.pinnedHandles.push(handle);
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
