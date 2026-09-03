import { kindForHandle } from './diff.js';
import type { CatalogEntry } from './types.js';

/**
 * Namespaces the Uploadify Shopify app writes. `uploadify_product.uploadify_active`
 * is the listing switch Daniil described; other keys in these namespaces are
 * listing state. Loose diamonds must not keep any of them.
 */
export const UPLOADIFY_METAFIELD_NAMESPACES = ['uploadify', 'uploadify_product'] as const;

export const UPLOADIFY_ACTIVE_KEY = 'uploadify_active';

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
