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
 * Qualifying Belgium Dia watches (`w-` handles) get `uploadify_active` true.
 * Anything else is not written here — `uploadifyActiveDeletesExcept` removes
 * the metafield. Rows with no Shopify id yet are counted and not written.
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
    if (!row.desired || kindForHandle(row.handle) !== 'watch') continue;
    if (row.current === true) continue;
    if (!row.ownerId) {
      missingOwner += 1;
      continue;
    }
    writes.push({ ownerId: row.ownerId, ...uploadifyActiveMetafield(true) });
  }
  return { writes, missingOwner };
}

/**
 * Handles allowed to keep `uploadify_active`: qualifying Belgium Dia
 * (ROMAN) watches, plus TLV Watches. Any handle that is not a `w-` watch
 * is dropped even if it was passed in.
 */
export function uploadifyKeepHandles(
  belgiumQualifying: Iterable<string>,
  tlvHandles: Iterable<string>,
): Set<string> {
  const keep = new Set<string>();
  for (const handle of [...belgiumQualifying, ...tlvHandles]) {
    if (kindForHandle(handle) === 'watch') keep.add(handle);
  }
  return keep;
}

/**
 * Delete `uploadify_active` from every product whose handle is not in
 * `keepHandles`. `keepHandles` may only retain `w-` handles; any other
 * handle is removed even if it was listed by mistake.
 */
export function uploadifyActiveDeletesExcept(
  owners: Array<{ id: string; handle: string }>,
  keepHandles: ReadonlySet<string>,
): MetafieldIdentifier[] {
  const out: MetafieldIdentifier[] = [];
  const seen = new Set<string>();
  for (const owner of owners) {
    if (keepHandles.has(owner.handle) && kindForHandle(owner.handle) === 'watch') continue;
    if (seen.has(owner.id)) continue;
    seen.add(owner.id);
    out.push({
      ownerId: owner.id,
      namespace: UPLOADIFY_PRODUCT_NAMESPACE,
      key: UPLOADIFY_ACTIVE_KEY,
    });
  }
  return out;
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
