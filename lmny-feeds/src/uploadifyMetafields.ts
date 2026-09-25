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

/** Uploadify's Vendor SKU. The app sends this as the eBay Custom Label. */
export const UPLOADIFY_VENDOR_SKU_KEY = 'vendor_sku';

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

export interface UploadifyVendorSkuWrite {
  ownerId: string;
  namespace: string;
  key: string;
  type: 'single_line_text_field';
  value: string;
}

/**
 * Qualifying watches get `uploadify_product.vendor_sku` equal to the feed
 * stock number (the same value written as the Shopify variant SKU). Uploadify
 * matches an eBay listing by that Custom Label. A blank stock number is not
 * written. A value that already matches is left alone.
 */
export function uploadifyVendorSkuWrites(
  rows: Array<{
    handle: string;
    ownerId: string | null;
    desired: boolean;
    stockRef: string;
    current: string | null | undefined;
  }>,
): { writes: UploadifyVendorSkuWrite[]; missingOwner: number } {
  const writes: UploadifyVendorSkuWrite[] = [];
  let missingOwner = 0;
  for (const row of rows) {
    if (!row.desired || kindForHandle(row.handle) !== 'watch') continue;
    const stockRef = row.stockRef.trim();
    if (!stockRef) continue;
    if ((row.current ?? '').trim() === stockRef) continue;
    if (!row.ownerId) {
      missingOwner += 1;
      continue;
    }
    writes.push({
      ownerId: row.ownerId,
      namespace: UPLOADIFY_PRODUCT_NAMESPACE,
      key: UPLOADIFY_VENDOR_SKU_KEY,
      type: 'single_line_text_field',
      value: stockRef,
    });
  }
  return { writes, missingOwner };
}

/**
 * Same owners that lose `uploadify_active` also lose `vendor_sku`. A missing
 * metafield delete is ignored by the client, so this is safe when the field
 * was never set.
 */
export function uploadifyVendorSkuDeletesFor(clears: MetafieldIdentifier[]): MetafieldIdentifier[] {
  return clears
    .filter((id) => id.namespace === UPLOADIFY_PRODUCT_NAMESPACE && id.key === UPLOADIFY_ACTIVE_KEY)
    .map((id) => ({ ...id, key: UPLOADIFY_VENDOR_SKU_KEY }));
}

/**
 * Handles allowed to keep `uploadify_active`: qualifying Belgium Watch and
 * TLV watches. Any handle that is not a `w-` watch is dropped even if it
 * was passed in. Pass TLV handles in either list.
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
