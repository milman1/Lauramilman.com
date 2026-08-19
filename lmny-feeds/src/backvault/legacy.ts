import { FEED_TAG as DIAMOND_FEED_TAG } from '../product.js';
import { FEED_TAG as BACKVAULT_FEED_TAG, sanitizeHandle } from './product.js';
import type { BackVaultItem } from './types.js';

/** Handles owned by other LMNY feed pipelines — never archive these as "old vintage". */
const OTHER_FEED_PREFIXES = ['bv-', 'nd-', 'lg-', 'w-'] as const;

export interface LegacyProduct {
  id: string;
  handle: string;
  status: string;
  tags: string[];
}

export interface LegacyArchiveClient {
  findProductByHandle(handle: string): Promise<LegacyProduct | null>;
  archiveProduct(id: string): Promise<string[]>;
  upsertUrlRedirect(path: string, target: string): Promise<string[]>;
}

export interface LegacyArchiveResult {
  action: 'archived' | 'planned' | 'skipped';
  handle?: string;
  reason: string;
  errors: string[];
}

/**
 * The May–July 2026 CSV import used The Back Vault source handle as the
 * Shopify handle. The weekly sync creates `bv-<sourceHandle>` beside that
 * row instead of replacing it.
 */
export function legacyHandleFromBvHandle(bvHandle: string): string | null {
  if (!bvHandle.startsWith('bv-')) return null;
  const legacy = bvHandle.slice('bv-'.length);
  return legacy.length > 0 ? legacy : null;
}

export function legacyHandleFor(item: BackVaultItem): string {
  return sanitizeHandle(item.sourceHandle);
}

/**
 * Archive only the old CSV row for the same source handle. Leave unique
 * vintage pieces that never got a `bv-` twin, diamond/watch feed products,
 * and anything already archived.
 */
export function shouldArchiveLegacyProduct(
  legacy: LegacyProduct | null,
  replacementHandle: string,
): boolean {
  if (!legacy) return false;
  if (legacy.status === 'ARCHIVED') return false;
  if (legacy.handle === replacementHandle) return false;
  if (OTHER_FEED_PREFIXES.some((prefix) => legacy.handle.startsWith(prefix))) return false;
  if (legacy.tags.includes(BACKVAULT_FEED_TAG)) return false;
  if (legacy.tags.includes(DIAMOND_FEED_TAG)) return false;
  return true;
}

export function legacyRedirectTarget(replacementHandle: string, replacementArchived: boolean): string {
  return replacementArchived ? '/collections/all' : `/products/${replacementHandle}`;
}

/**
 * If Shopify still has the pre-`bv-` handle for this source SKU, archive it
 * and point the old URL at the new listing (or `/collections/all` when the
 * replacement itself has left the feed).
 */
export async function archiveLegacyDuplicate(
  client: LegacyArchiveClient,
  opts: { bvHandle: string; replacementArchived: boolean; dryRun: boolean },
): Promise<LegacyArchiveResult> {
  const handle = legacyHandleFromBvHandle(opts.bvHandle);
  if (!handle) return { action: 'skipped', reason: 'not_bv_handle', errors: [] };

  const legacy = await client.findProductByHandle(handle);
  if (!shouldArchiveLegacyProduct(legacy, opts.bvHandle)) {
    return { action: 'skipped', handle, reason: legacy ? 'not_replaceable' : 'not_found', errors: [] };
  }

  const target = legacyRedirectTarget(opts.bvHandle, opts.replacementArchived);
  if (opts.dryRun) {
    return { action: 'planned', handle, reason: 'csv_duplicate', errors: [] };
  }

  const errors: string[] = [];
  const archiveErrors = await client.archiveProduct(legacy!.id);
  errors.push(...archiveErrors);
  const redirectErrors = await client.upsertUrlRedirect(`/products/${handle}`, target);
  errors.push(...redirectErrors);
  return { action: 'archived', handle, reason: 'csv_duplicate', errors };
}
