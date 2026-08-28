/**
 * Shopify Standard Product Taxonomy IDs written to productSet `category`.
 * Source: https://github.com/Shopify/product-taxonomy (Apparel & Accessories).
 *
 * Admin "Category" is this field — not the custom Product type string.
 * Uploadify / Google / marketplaces read Category; leaving it blank is why
 * API watches showed an empty category in Shopify.
 */
export interface TaxonomyCategory {
  id: string;
  gid: string;
  breadcrumb: string;
}

function cat(id: string, breadcrumb: string): TaxonomyCategory {
  return { id, gid: `gid://shopify/TaxonomyCategory/${id}`, breadcrumb };
}

export const TAXONOMY = {
  jewelry: cat('aa-6', 'Apparel & Accessories > Jewelry'),
  anklets: cat('aa-6-1', 'Apparel & Accessories > Jewelry > Anklets'),
  bracelets: cat('aa-6-3', 'Apparel & Accessories > Jewelry > Bracelets'),
  brooches: cat('aa-6-4-1', 'Apparel & Accessories > Jewelry > Brooches & Lapel Pins > Brooches'),
  pendants: cat('aa-6-5-1', 'Apparel & Accessories > Jewelry > Charms & Pendants > Pendants'),
  earrings: cat('aa-6-6', 'Apparel & Accessories > Jewelry > Earrings'),
  jewelrySets: cat('aa-6-7', 'Apparel & Accessories > Jewelry > Jewelry Sets'),
  necklaces: cat('aa-6-8', 'Apparel & Accessories > Jewelry > Necklaces'),
  rings: cat('aa-6-9', 'Apparel & Accessories > Jewelry > Rings'),
  watches: cat('aa-6-11', 'Apparel & Accessories > Jewelry > Watches'),
  cufflinks: cat('aa-2-10', 'Apparel & Accessories > Clothing Accessories > Cufflinks'),
} as const;

export type FeedKind = 'natural' | 'lab' | 'watch';

/** Loose diamonds have no dedicated Jewelry leaf — use the Jewelry parent. */
export function taxonomyForFeedKind(kind: FeedKind): TaxonomyCategory {
  return kind === 'watch' ? TAXONOMY.watches : TAXONOMY.jewelry;
}

/**
 * Map a Shopify product type (Back Vault / jewelry CSV `Type` column)
 * onto the closest standard category.
 */
export function taxonomyForProductType(productType: string | undefined | null): TaxonomyCategory {
  const folded = (productType ?? '').trim().toLowerCase();
  if (!folded) return TAXONOMY.jewelry;
  if (/\bcuff\s*links?\b/.test(folded) || folded === 'cufflinks') return TAXONOMY.cufflinks;
  if (/\bearrings?\b|\bearclips?\b/.test(folded)) return TAXONOMY.earrings;
  if (/\bbrooches?\b|\bbrooch\b/.test(folded)) return TAXONOMY.brooches;
  if (/\bpendants?\b/.test(folded)) return TAXONOMY.pendants;
  if (/\bnecklaces?\b|\bchoker\b/.test(folded)) return TAXONOMY.necklaces;
  if (/\bbracelets?\b|\bbangles?\b|\bcuff\b|\btennis\b/.test(folded)) return TAXONOMY.bracelets;
  if (/\bwatch(?:es)?\b|\btimepiece\b/.test(folded)) return TAXONOMY.watches;
  if (/\brings?\b|\bband\b/.test(folded)) return TAXONOMY.rings;
  if (/\banklets?\b/.test(folded)) return TAXONOMY.anklets;
  if (/\bsets?\b/.test(folded)) return TAXONOMY.jewelrySets;
  return TAXONOMY.jewelry;
}

export function taxonomyGidForFeedKind(kind: FeedKind): string {
  return taxonomyForFeedKind(kind).gid;
}

export function taxonomyGidForProductType(productType: string | undefined | null): string {
  return taxonomyForProductType(productType).gid;
}

/** True when a CSV Product Category cell matches a known jewelry/watch category. */
export function isRecognizedJewelryCategory(value: string): boolean {
  const raw = value.trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  const compact = lower.replace(/[^a-z0-9]+/g, '');
  for (const entry of Object.values(TAXONOMY)) {
    if (raw === entry.gid || raw === entry.id) return true;
    if (lower === entry.breadcrumb.toLowerCase()) return true;
    if (compact.includes(entry.id.replace(/-/g, ''))) return true;
  }
  return /jewelry|watch/.test(lower);
}
