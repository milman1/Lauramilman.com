import type { BackVaultCatalogEntry } from './catalog.js';
import { backVaultRetail } from './pricing.js';
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

/** How long a remembered competitor comparison may be used before it expires. */
export const COMPETITOR_MEMORY_DAYS = 90;
/**
 * Rewrite a matched piece's remembered comparison once it is this old, even
 * when nothing else about the piece changed. Without it the memory is only
 * refreshed when some other field moves, and a piece that matches every week
 * but is otherwise static would let its own memory expire and drop to the flat
 * markup on the next incomplete run — the churn this whole rule prevents.
 */
export const COMPETITOR_MEMORY_REFRESH_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CompetitorMemoryStats {
  /** Unmatched pieces priced from a remembered comparison instead of the flat rule. */
  pricedFromMemory: number;
  /** Which ones, so the report can name them instead of just counting them. */
  memoryHandles: string[];
  /** Unmatched pieces whose remembered comparison was too old to use. */
  expired: number;
  /** Unmatched pieces with no remembered comparison at all. */
  unremembered: number;
}

/** Age of an ISO timestamp in days, or null when it cannot be read. */
function ageInDays(readAt: string | null, now: number): number | null {
  if (!readAt) return null;
  const at = Date.parse(readAt);
  if (!Number.isFinite(at)) return null;
  return (now - at) / DAY_MS;
}

/**
 * Price an unmatched piece from what the last matching run remembered about it.
 *
 * The competitor's catalogue is larger than the page-based pagination its
 * endpoint allows (src/backvault/competitor.ts), so a COMPLETE index is not
 * reachable and some run will always fail to match a piece that is really
 * there. Pricing that piece flat would cut its ticket this week and the next
 * good match would raise it again — the churn the whole competitor rule exists
 * to avoid.
 *
 * So each matched piece remembers the competitor price and the date it was
 * read (`backvault_feed.competitor_price` / `competitor_price_at`), and on a
 * run whose index is incomplete an unmatched piece is handled by that memory:
 *
 *  - Remembered, and no older than COMPETITOR_MEMORY_DAYS: the remembered
 *    price becomes this run's `competitorPriceUsd` and the ORDINARY pricing
 *    rule computes the midpoint against the CURRENT cost. A supplier markdown
 *    therefore still reaches the storefront, at the same midpoint premium, and
 *    the price is stable week to week because the content hash already carries
 *    `competitorPrice`.
 *  - Nothing remembered, or the memory has expired: flat, cost + markup —
 *    exactly what the rule says for a piece that is not on the competitor.
 *    Nothing is protected and nothing is frozen.
 *
 * A complete index always wins over memory: with the whole catalogue read, an
 * unmatched piece is genuinely unmatched. A fresh match always wins too, and
 * refreshes both the value and the date.
 *
 * Mutates the items in place, and must run BEFORE the content hashes are
 * computed so the hash matches the price actually written.
 */
export function applyRememberedCompetitorPrices(
  items: BackVaultItem[],
  catalog: BackVaultCatalogEntry[],
  options: { indexComplete: boolean; now?: number; maxAgeDays?: number } = { indexComplete: false },
): CompetitorMemoryStats {
  const now = options.now ?? Date.now();
  const maxAgeDays = options.maxAgeDays ?? COMPETITOR_MEMORY_DAYS;
  const catalogByHandle = new Map(catalog.map((c) => [c.handle, c]));
  const stats: CompetitorMemoryStats = { pricedFromMemory: 0, memoryHandles: [], expired: 0, unremembered: 0 };
  const nowIso = new Date(now).toISOString();
  for (const item of items) {
    // Matched this run: stamp today's date so the memory written to the
    // product is this comparison, not the one it replaces.
    if (typeof item.competitorPriceUsd === 'number') {
      item.competitorPriceReadAt = nowIso;
      continue;
    }
    if (options.indexComplete) continue; // a whole catalogue was read: unmatched means unmatched
    const have = catalogByHandle.get(handleFor(item));
    const remembered = have?.rememberedCompetitorPrice ?? null;
    if (remembered === null) {
      if (have) stats.unremembered += 1;
      continue;
    }
    const age = ageInDays(have?.rememberedCompetitorPriceAt ?? null, now);
    if (age === null || age > maxAgeDays) {
      stats.expired += 1;
      continue;
    }
    item.competitorPriceUsd = remembered;
    item.competitorPriceReadAt = have!.rememberedCompetitorPriceAt!;
    item.priceUsd = backVaultRetail(item.costUsd, remembered);
    stats.pricedFromMemory += 1;
    stats.memoryHandles.push(handleFor(item));
  }
  return stats;
}

/**
 * Promote a piece that matched the competitor this run from 'skip' to
 * 'update' when its remembered comparison is missing or stale.
 *
 * The diff is driven by the content hash, and the read date is deliberately
 * not in it, so a piece that matches every week but is otherwise unchanged is
 * never rewritten and its memory ages out. This is the one thing that keeps
 * the memory current, at a cost of one write per piece per
 * COMPETITOR_MEMORY_REFRESH_DAYS. Same shape as
 * promoteBackVaultInventoryUpdates below.
 *
 * `pricedFromMemory` names the pieces whose price CAME from the memory: they
 * have a `competitorPriceUsd` like a matched piece, but rewriting them would
 * store the same value under the same old date, week after week, forever.
 * Only a piece that really matched the competitor this run has anything new
 * to record.
 */
export function promoteBackVaultCompetitorMemory(
  decisions: Decision[],
  items: BackVaultItem[],
  catalog: BackVaultCatalogEntry[],
  options: { now?: number; refreshAfterDays?: number; pricedFromMemory?: Iterable<string> } = {},
): number {
  const now = options.now ?? Date.now();
  const refreshAfterDays = options.refreshAfterDays ?? COMPETITOR_MEMORY_REFRESH_DAYS;
  const fromMemory = new Set(options.pricedFromMemory ?? []);
  const itemByHandle = new Map(items.map((i) => [handleFor(i), i]));
  const catalogByHandle = new Map(catalog.map((c) => [c.handle, c]));
  let promoted = 0;
  for (const decision of decisions) {
    if (decision.action !== 'skip' || decision.reason !== 'unchanged') continue;
    if (fromMemory.has(decision.handle)) continue; // nothing new to record
    const item = itemByHandle.get(decision.handle);
    if (!item || typeof item.competitorPriceUsd !== 'number') continue;
    const have = catalogByHandle.get(decision.handle);
    if (!have) continue;
    const age = ageInDays(have.rememberedCompetitorPriceAt, now);
    const sameValue =
      typeof have.rememberedCompetitorPrice === 'number' &&
      Math.abs(have.rememberedCompetitorPrice - item.competitorPriceUsd) < 0.005;
    if (sameValue && age !== null && age <= refreshAfterDays) continue;
    decision.action = 'update';
    decision.reason = 'competitor_memory_refresh';
    promoted += 1;
  }
  return promoted;
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
 * Nothing here knows about competitor pricing: an incomplete competitor index
 * is handled upstream by applyRememberedCompetitorPrices, which changes the
 * price the run writes, never whether it writes. A piece is never held out of
 * an update for a pricing reason — doing that also withheld its reactivation,
 * its missing sales channels, and that week's images.
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
