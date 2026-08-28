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
    } else if (!have.published) {
      // productSet does not publish to Online Store. The first live run created
      // 741 ACTIVE products that 404 on the storefront until this fires.
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
