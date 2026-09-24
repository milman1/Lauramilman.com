import { kindForHandle } from './diff.js';
import type { CatalogEntry } from './types.js';

/**
 * Namespaces the Uploadify Shopify app writes. `uploadify_product.uploadify_active`
 * is the listing switch Daniil described; other keys in these namespaces are
 * listing state. Loose diamonds must not keep any of them.
 */
export const UPLOADIFY_METAFIELD_NAMESPACES = ['uploadify', 'uploadify_product'] as const;

export const UPLOADIFY_PRODUCT_NAMESPACE = 'uploadify_product';

export const UPLOADIFY_ACTIVE_KEY = 'uploadify_active';

export interface UploadifyActiveWrite {
  ownerId: string;
  namespace: string;
  key: string;
  type: 'boolean';
  value: 'true' | 'false';
}

/** Boolean metafield Uploadify reads as the listing switch. */
export function uploadifyActiveMetafield(active: boolean): Omit<UploadifyActiveWrite, 'ownerId'> {
  return {
    namespace: UPLOADIFY_PRODUCT_NAMESPACE,
    key: UPLOADIFY_ACTIVE_KEY,
    type: 'boolean',
    value: active ? 'true' : 'false',
  };
}

/**
 * Watches that should list get `uploadify_active` true. A product that
 * already holds the desired value is skipped. False is written only to
 * clear a flag that would keep an unqualified watch listed. Rows with no
 * Shopify id yet are counted and not written.
 */
export function uploadifyActiveWrites(
  rows: Array<{
    handle: string;
    ownerId: string | null;
    current: boolean | null | undefined;
    desired: boolean;
  }>,
): { writes: UploadifyActiveWrite[]; missingOwner: number } {
  const writes: UploadifyActiveWrite[] = [];
  let missingOwner = 0;
  for (const row of rows) {
    if (kindForHandle(row.handle) !== 'watch') continue;
    const needsWrite = row.desired ? row.current !== true : row.current === true;
    if (!needsWrite) continue;
    if (!row.ownerId) {
      missingOwner += 1;
      continue;
    }
    writes.push({ ownerId: row.ownerId, ...uploadifyActiveMetafield(row.desired) });
  }
  return { writes, missingOwner };
}

export interface MetafieldIdentifier {
  ownerId: string;
  namespace: string;
  key: string;
}

export function isUploadifyNamespace(namespace: string): boolean {
  return (UPLOADIFY_METAFIELD_NAMESPACES as readonly string[]).includes(namespace);
}

/** Identifiers to delete on natural/lab diamonds only. Watches are left alone. */
export function uploadifyMetafieldDeletesForDiamonds(catalog: CatalogEntry[]): MetafieldIdentifier[] {
  const out: MetafieldIdentifier[] = [];
  for (const entry of catalog) {
    const kind = kindForHandle(entry.handle);
    if (kind !== 'natural' && kind !== 'lab') continue;
    const seen = new Set<string>();
    for (const mf of entry.uploadifyMetafields ?? []) {
      if (!isUploadifyNamespace(mf.namespace) || !mf.key) continue;
      const id = `${mf.namespace}.${mf.key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ ownerId: entry.id, namespace: mf.namespace, key: mf.key });
    }
  }
  return out;
}
