/**
 * Shopify Standard Product Taxonomy + unique-item inventory.
 *
 * Category GIDs are from Shopify's published taxonomy
 * (https://github.com/Shopify/product-taxonomy dist/en/categories.txt).
 * The Admin "Category" field is `ProductSetInput.category` /
 * `ProductUpdateInput.category`.
 *
 * Loose diamonds have no jewelry-vertical leaf (craft "Loose Stones" is
 * bead-and-cabochon material, not GIA/IGI diamonds), so they use the
 * Jewelry parent. Watches and jewelry types use the matching leaf.
 */

export const TAXONOMY_CATEGORY = {
  jewelry: 'gid://shopify/TaxonomyCategory/aa-6',
  bracelets: 'gid://shopify/TaxonomyCategory/aa-6-3',
  brooches: 'gid://shopify/TaxonomyCategory/aa-6-4-1',
  pendants: 'gid://shopify/TaxonomyCategory/aa-6-5-1',
  earrings: 'gid://shopify/TaxonomyCategory/aa-6-6',
  necklaces: 'gid://shopify/TaxonomyCategory/aa-6-8',
  rings: 'gid://shopify/TaxonomyCategory/aa-6-9',
  watches: 'gid://shopify/TaxonomyCategory/aa-6-11',
  cufflinks: 'gid://shopify/TaxonomyCategory/aa-2-10',
} as const;

export type TaxonomyCategoryGid = (typeof TAXONOMY_CATEGORY)[keyof typeof TAXONOMY_CATEGORY];

/** Every active unique piece (diamond, watch, jewelry) is stocked as qty 1. */
export const UNIQUE_QUANTITY = 1;

const PRODUCT_TYPE_CATEGORY: Record<string, TaxonomyCategoryGid> = {
  'natural diamond': TAXONOMY_CATEGORY.jewelry,
  'lab-grown diamond': TAXONOMY_CATEGORY.jewelry,
  'lab grown diamond': TAXONOMY_CATEGORY.jewelry,
  diamond: TAXONOMY_CATEGORY.jewelry,
  diamonds: TAXONOMY_CATEGORY.jewelry,
  watch: TAXONOMY_CATEGORY.watches,
  watches: TAXONOMY_CATEGORY.watches,
  timepiece: TAXONOMY_CATEGORY.watches,
  timepieces: TAXONOMY_CATEGORY.watches,
  ring: TAXONOMY_CATEGORY.rings,
  rings: TAXONOMY_CATEGORY.rings,
  band: TAXONOMY_CATEGORY.rings,
  bands: TAXONOMY_CATEGORY.rings,
  bracelet: TAXONOMY_CATEGORY.bracelets,
  bracelets: TAXONOMY_CATEGORY.bracelets,
  bangle: TAXONOMY_CATEGORY.bracelets,
  bangles: TAXONOMY_CATEGORY.bracelets,
  necklace: TAXONOMY_CATEGORY.necklaces,
  necklaces: TAXONOMY_CATEGORY.necklaces,
  choker: TAXONOMY_CATEGORY.necklaces,
  chokers: TAXONOMY_CATEGORY.necklaces,
  earring: TAXONOMY_CATEGORY.earrings,
  earrings: TAXONOMY_CATEGORY.earrings,
  pendant: TAXONOMY_CATEGORY.pendants,
  pendants: TAXONOMY_CATEGORY.pendants,
  brooch: TAXONOMY_CATEGORY.brooches,
  brooches: TAXONOMY_CATEGORY.brooches,
  pin: TAXONOMY_CATEGORY.brooches,
  pins: TAXONOMY_CATEGORY.brooches,
  cufflink: TAXONOMY_CATEGORY.cufflinks,
  cufflinks: TAXONOMY_CATEGORY.cufflinks,
  jewelry: TAXONOMY_CATEGORY.jewelry,
  jewellery: TAXONOMY_CATEGORY.jewelry,
};

export interface CategoryHint {
  kind?: 'natural' | 'lab' | 'watch';
  productType?: string | null;
  handle?: string | null;
  title?: string | null;
}

export function categoryGidFor(hint: CategoryHint): TaxonomyCategoryGid {
  if (hint.kind === 'watch') return TAXONOMY_CATEGORY.watches;
  if (hint.kind === 'natural' || hint.kind === 'lab') return TAXONOMY_CATEGORY.jewelry;

  const fromType = categoryFromProductType(hint.productType);
  if (fromType) return fromType;

  const handle = (hint.handle ?? '').trim().toLowerCase();
  if (handle.startsWith('w-')) return TAXONOMY_CATEGORY.watches;
  if (handle.startsWith('nd-') || handle.startsWith('lg-')) return TAXONOMY_CATEGORY.jewelry;

  const fromTitle = categoryFromTitle(hint.title);
  if (fromTitle) return fromTitle;

  return TAXONOMY_CATEGORY.jewelry;
}

function foldType(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function categoryFromProductType(raw: string | null | undefined): TaxonomyCategoryGid | null {
  if (!raw || !raw.trim()) return null;
  const folded = foldType(raw);
  if (PRODUCT_TYPE_CATEGORY[folded]) return PRODUCT_TYPE_CATEGORY[folded];
  const compact = folded.replace(/[^a-z0-9]+/g, '');
  const byCompact: Record<string, TaxonomyCategoryGid> = {
    naturaldiamond: TAXONOMY_CATEGORY.jewelry,
    labgrowndiamond: TAXONOMY_CATEGORY.jewelry,
    labdiamond: TAXONOMY_CATEGORY.jewelry,
  };
  return byCompact[compact] ?? null;
}

function categoryFromTitle(raw: string | null | undefined): TaxonomyCategoryGid | null {
  if (!raw) return null;
  const folded = foldType(raw);
  if (/\b(lab[- ]grown|[0-9.]+\s*ct)\b.*\bdiamonds?\b|\bdiamonds?\b.*\b(gia|igi|hrd|ags)\b/.test(folded)) {
    return TAXONOMY_CATEGORY.jewelry;
  }
  if (/\bcuff\s*links?\b/.test(folded)) return TAXONOMY_CATEGORY.cufflinks;
  if (/\bearrings?\b|\bear\s*clips?\b/.test(folded)) return TAXONOMY_CATEGORY.earrings;
  if (/\bbrooches?\b|\bbrooch\b/.test(folded)) return TAXONOMY_CATEGORY.brooches;
  if (/\bpendants?\b/.test(folded)) return TAXONOMY_CATEGORY.pendants;
  if (/\bnecklaces?\b|\bchoker\b/.test(folded)) return TAXONOMY_CATEGORY.necklaces;
  if (/\bbracelets?\b|\bbangles?\b|\btennis bracelet\b/.test(folded)) return TAXONOMY_CATEGORY.bracelets;
  if (/\bwatches?\b|\btimepiece\b|\brolex\b|\bpatek\b|\baudemars\b/.test(folded)) {
    return TAXONOMY_CATEGORY.watches;
  }
  if (/\brings?\b|\bwedding band\b|\bengagement ring\b/.test(folded)) return TAXONOMY_CATEGORY.rings;
  if (/\bdiamonds?\b/.test(folded)) return TAXONOMY_CATEGORY.jewelry;
  return null;
}

/**
 * Variant inventory fields for a one-of-a-kind piece.
 * Omit `locationId` to leave quantities off the payload (category-only writes).
 */
export function uniqueVariantInventory(
  locationId: string | undefined,
  extras?: { cost?: string },
): Record<string, unknown> {
  const inventoryItem: Record<string, unknown> = {
    tracked: Boolean(locationId),
    requiresShipping: true,
  };
  if (extras?.cost !== undefined) inventoryItem.cost = extras.cost;

  const fields: Record<string, unknown> = {
    inventoryPolicy: 'DENY',
    inventoryItem,
  };
  if (locationId) {
    fields.inventoryQuantities = [
      { locationId, name: 'available', quantity: UNIQUE_QUANTITY },
    ];
  }
  return fields;
}

/**
 * Whether an active variant should be set to qty 1.
 *
 * Untracked (today's API/manual default) currently appears in-stock forever.
 * Tracked with 0 is treated as sold and left alone. Tracked with any other
 * available count is normalized to 1.
 */
export function shouldSetUniqueQuantity(args: {
  tracked: boolean;
  available: number | null | undefined;
}): boolean {
  if (!args.tracked) return true;
  if (args.available === 0) return false;
  return args.available !== UNIQUE_QUANTITY;
}
