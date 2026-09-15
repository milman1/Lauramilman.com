/**
 * Jacob & Co. memo 20260018395 (24 Aug 2026) → Shopify ProductSet payloads.
 *
 * Manual boutique inventory — not Belgium Dia. Handles use `jc-<itemNumber>`
 * so the feed sync never archives them. Watches go ACTIVE with `media-missing`
 * until photos land; accessories stay DRAFT.
 */

import { MEDIA_MISSING_TAG } from './product.js';
import { buildWatchListing, type WatchFeedRecord } from './watchListingBuilder.js';

export const JACOB_VENDOR = 'Jacob & Co.';
export const JACOB_MEMO_NUMBER = '20260018395';
export const JACOB_MEMO_TAG = `memo-${JACOB_MEMO_NUMBER}`;
/** Merchant-stated condition for this memo. Not Pre-Owned/Unworn — those two stay reserved for the API watch map. */
export const NEW_VINTAGE = 'New Vintage';
/** Selling price is this fraction off Jacob retail (the highest price on the memo). */
export const RETAIL_DISCOUNT = 0.3;
export const JACOB_COLLECTION_TITLE = 'Jacob & Co. Watches';
export const JACOB_COLLECTION_HANDLE = 'jacob-co-watches';
/** Already live with photos — do not create a second imageless product. */
export const ALREADY_LIVE_WITH_PHOTOS = new Set(['90712192']);

const CATEGORY = {
  watches: 'gid://shopify/TaxonomyCategory/aa-6-11',
  watchAccessories: 'gid://shopify/TaxonomyCategory/aa-6-10',
  watchParts: 'gid://shopify/TaxonomyCategory/aa-6-10-5',
} as const;

export type JacobMemoKind = 'watch' | 'accessory' | 'part';

export interface JacobMemoItem {
  itemNumber: string;
  kind: JacobMemoKind;
  titleModel: string;
  reference: string;
  serial?: string;
  metal?: string;
  caseSizeMm?: string;
  dial?: string;
  bezel?: string;
  bracelet?: string;
  comment?: string;
  diamondWeight?: string;
  productType: string;
  category: string;
  /** Jacob & Co. retail (compare-at). */
  jacobRetailUsd: number;
  /** Memo charge — LMNY cost. */
  costUsd: number;
}

export const JACOB_MEMO_ITEMS: JacobMemoItem[] = [
  {
    itemNumber: '90607870',
    kind: 'watch',
    titleModel: 'Five Time Zone',
    reference: 'JC-4',
    serial: 'J2259',
    metal: 'Stainless Steel',
    caseSizeMm: '47',
    dial: 'Black Enamel Outer Circle with Shiny White Center',
    bezel: 'Plain',
    comment: 'Primary-color geometric time zones. Swiss quartz movement.',
    productType: 'Watch',
    category: CATEGORY.watches,
    jacobRetailUsd: 7100,
    costUsd: 2485,
  },
  {
    itemNumber: '90607874',
    kind: 'watch',
    titleModel: 'Five Time Zone',
    reference: 'JCM-11',
    serial: 'H2303',
    metal: 'Stainless Steel',
    caseSizeMm: '40',
    dial: 'Black Enamel with Primary Colored Time Zones',
    bezel: 'Plain Stainless Steel',
    comment: 'Swiss quartz movement.',
    productType: 'Watch',
    category: CATEGORY.watches,
    jacobRetailUsd: 6490,
    costUsd: 2271.5,
  },
  {
    itemNumber: '90814519',
    kind: 'watch',
    titleModel: 'Epic I',
    reference: 'Q2B',
    serial: '330',
    metal: 'Black Stainless Steel',
    caseSizeMm: '51.2',
    dial: 'Multi-Tiered Six Layer PVD and Black Carbon Fiber',
    comment:
      'Black PVD titanium and carbon fiber case with a skeleton back. Jacob & Co. 2121 automatic chronograph, 27 jewels, 28,000 vph, Incabloc. Functions: chronograph (30 minutes, 12 hours), center seconds, date.',
    productType: 'Watch',
    category: CATEGORY.watches,
    jacobRetailUsd: 16800,
    costUsd: 5880,
  },
  {
    itemNumber: '90916186',
    kind: 'watch',
    titleModel: 'Epic II',
    reference: 'E2SS',
    serial: '1345',
    metal: 'Stainless Steel',
    caseSizeMm: '46.4',
    dial: 'Black Carbon Fiber Multi-Tiered Six-Layer',
    bezel: 'Stainless Steel',
    comment:
      'Skeleton back. Jacob & Co. 2121 automatic chronograph, 27 jewels, 28,000 vph, Incabloc. Functions: chronograph (30 minutes, 12 hours), center seconds, date.',
    productType: 'Watch',
    category: CATEGORY.watches,
    jacobRetailUsd: 16800,
    costUsd: 5880,
  },
  {
    itemNumber: '90712192',
    kind: 'watch',
    titleModel: 'Five Time Zone',
    reference: 'H-24 SSSL',
    serial: '0796/1800',
    metal: 'Stainless Steel',
    caseSizeMm: '47.5',
    dial: 'Silver Discs on Slate Guilloche',
    comment: 'Limited edition (0796/1800). Swiss automatic movement.',
    productType: 'Watch',
    category: CATEGORY.watches,
    jacobRetailUsd: 19800,
    costUsd: 6930,
  },
  {
    itemNumber: '90608232',
    kind: 'watch',
    titleModel: 'Automatic Chronograph',
    reference: 'AC-6',
    serial: '0353',
    metal: 'Stainless Steel',
    caseSizeMm: '47',
    dial: 'White Enamel with White Time Zones',
    bezel: 'Plain Stainless Steel',
    comment: 'Swiss automatic movement.',
    productType: 'Watch',
    category: CATEGORY.watches,
    jacobRetailUsd: 7500,
    costUsd: 2625,
  },
  {
    itemNumber: '91944889',
    kind: 'watch',
    titleModel: 'Ghost',
    reference: 'GH100.11.RP.PB.ANA4D',
    serial: '01749',
    metal: 'Black PVD and Stainless Steel',
    caseSizeMm: '47',
    bezel: '3.48ct One Row Diamond (105 Stones)',
    bracelet: 'Black Rubber Strap',
    diamondWeight: '3.48',
    comment:
      'Ghost Collection digital watch. Red aluminium push buttons, quartz digital LCD, black PVD buckle. Swiss quartz movement.',
    productType: 'Watch',
    category: CATEGORY.watches,
    jacobRetailUsd: 17500,
    costUsd: 6125,
  },
  {
    itemNumber: '91739578',
    kind: 'accessory',
    titleModel: 'USB Charger for Ghost Watch',
    reference: 'Ghost USB Charger',
    productType: 'Watch Accessories',
    category: CATEGORY.watchAccessories,
    jacobRetailUsd: 150,
    costUsd: 52.5,
    comment: 'USB charger for the Jacob & Co. Ghost watch.',
  },
  {
    itemNumber: '91328626',
    kind: 'part',
    titleModel: 'Full Size Diamond Bezel',
    reference: 'Full Size 3.25ct Diamond Bezel',
    metal: 'Stainless Steel',
    caseSizeMm: '47',
    diamondWeight: '3.25',
    productType: 'Watch Accessories',
    category: CATEGORY.watchParts,
    jacobRetailUsd: 9900,
    costUsd: 3465,
    comment: 'Full size 3.25ct diamond bezel for a 47mm Jacob & Co. watch.',
  },
  {
    itemNumber: '91328623',
    kind: 'part',
    titleModel: 'Mid Size Diamond Bezel',
    reference: 'Mid Size 2.00ct Diamond Bezel',
    metal: 'Stainless Steel',
    caseSizeMm: '40',
    diamondWeight: '2.00',
    productType: 'Watch Accessories',
    category: CATEGORY.watchParts,
    jacobRetailUsd: 6800,
    costUsd: 2380,
    comment: 'Mid size 2.00ct diamond bezel for a 40mm Jacob & Co. watch.',
  },
];

export function handleForItem(item: JacobMemoItem): string {
  return `jc-${item.itemNumber}`;
}

export function statusForItem(item: JacobMemoItem): 'ACTIVE' | 'DRAFT' {
  return item.kind === 'watch' ? 'ACTIVE' : 'DRAFT';
}

export function isWatchItem(item: JacobMemoItem): boolean {
  return item.kind === 'watch';
}

/** Draft boutique Jacob watches — not accessories, not archived API feed items. */
export function isJacobWatchDraft(product: {
  status: string;
  productType: string;
  vendor: string;
  tags: string[];
  handle: string;
}): boolean {
  if (product.status !== 'DRAFT') return false;
  const vendor = product.vendor.toLowerCase();
  const type = product.productType.toLowerCase();
  const tags = product.tags.map((t) => t.toLowerCase());
  const handle = product.handle.toLowerCase();
  const jacob =
    vendor.includes('jacob') ||
    tags.some((t) => t.includes('jacob')) ||
    handle.startsWith('jc-');
  if (!jacob) return false;
  const accessory =
    type.includes('accessor') || type.includes('part') || tags.includes('watch accessories');
  if (accessory) return false;
  return type.includes('watch') || tags.some((t) => t.includes('watch'));
}

export function retailUsdForItem(item: JacobMemoItem): number {
  return Math.round(item.jacobRetailUsd * (1 - RETAIL_DISCOUNT) * 100) / 100;
}

function truncateAtWord(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

function fitWithSuffix(lead: string, suffix: string, maxLen: number): string {
  const available = maxLen - suffix.length - 1;
  return `${truncateAtWord(lead, available)} ${suffix}`.trim();
}

function accessoryListing(item: JacobMemoItem): {
  title: string;
  descriptionHtml: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  metafields: Array<{ namespace: string; key: string; type: string; value: string }>;
} {
  const title = `${JACOB_VENDOR} ${item.titleModel}`;
  const descriptionHtml = `<p>This ${NEW_VINTAGE} ${escapeHtml(title)} is offered by Laura Milman New York.</p>`;
  const seoTitle = truncateAtWord(`${JACOB_VENDOR} ${item.titleModel} | Watch Accessory`, 60);
  const seoDescription = truncateAtWord(
    `Shop this ${NEW_VINTAGE.toLowerCase()} ${title}. Authenticated by Laura Milman New York.`,
    160,
  );
  const metafields: Array<{ namespace: string; key: string; type: string; value: string }> = [
    { namespace: 'custom', key: 'brand', type: 'single_line_text_field', value: JACOB_VENDOR },
    { namespace: 'custom', key: 'condition', type: 'single_line_text_field', value: NEW_VINTAGE },
    { namespace: 'global', key: 'MPN', type: 'single_line_text_field', value: item.itemNumber },
  ];
  if (item.metal) metafields.push({ namespace: 'custom', key: 'metal', type: 'single_line_text_field', value: item.metal });
  if (item.caseSizeMm) {
    metafields.push({
      namespace: 'custom',
      key: 'case_size',
      type: 'single_line_text_field',
      value: `${item.caseSizeMm}mm`,
    });
  }
  if (item.diamondWeight) {
    metafields.push({
      namespace: 'custom',
      key: 'diamond_weight',
      type: 'single_line_text_field',
      value: `${item.diamondWeight}ct`,
    });
  }
  if (item.serial) {
    metafields.push({
      namespace: 'custom',
      key: 'stock_number',
      type: 'single_line_text_field',
      value: item.serial,
    });
  }
  return {
    title,
    descriptionHtml,
    seoTitle,
    seoDescription,
    tags: [JACOB_VENDOR, item.productType, NEW_VINTAGE, 'Jacob & Co'],
    metafields,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function watchRecord(item: JacobMemoItem): WatchFeedRecord {
  return {
    brand: JACOB_VENDOR,
    model: item.titleModel,
    reference: item.reference,
    conditionRaw: '',
    caseSizeMm: item.caseSizeMm,
    metal: item.metal,
    dial: item.dial,
    bezel: item.bezel,
    bracelet: item.bracelet,
    stockNumber: item.serial,
    comment: item.comment,
  };
}

function applyNewVintageWatchListing(listing: {
  title: string;
  descriptionHtml: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  metafields: Array<{ namespace: string; key: string; type: string; value: string }>;
}): typeof listing {
  const identity = listing.title.replace(/^(Pre-Owned|Unworn)\s+/i, '').trim();
  const title = `${NEW_VINTAGE} ${identity}`;
  const descriptionHtml = listing.descriptionHtml.replace(/<p>This (Pre-Owned |Unworn )?/i, `<p>This ${NEW_VINTAGE} `);
  const seoTitle = fitWithSuffix(identity, `– ${NEW_VINTAGE} Watch`, 60);
  const seoDescription = truncateAtWord(
    `Shop this ${NEW_VINTAGE.toLowerCase()} ${identity}. Authenticated by Laura Milman New York.`,
    160,
  );
  const metafields = listing.metafields
    .filter((m) => !(m.namespace === 'mm-google-shopping' && m.key === 'condition'))
    .map((m) => (m.namespace === 'custom' && m.key === 'condition' ? { ...m, value: NEW_VINTAGE } : m));
  if (!metafields.some((m) => m.namespace === 'custom' && m.key === 'condition')) {
    metafields.push({
      namespace: 'custom',
      key: 'condition',
      type: 'single_line_text_field',
      value: NEW_VINTAGE,
    });
  }
  const tags = [
    ...new Set(
      listing.tags
        .filter((t) => !/^(Pre-Owned|Unworn)(\s+Watches)?$/i.test(t))
        .concat([NEW_VINTAGE, `${NEW_VINTAGE} Watches`]),
    ),
  ];
  return { title, descriptionHtml, seoTitle, seoDescription, tags, metafields };
}

function uniqueVariantInventory(
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
    fields.inventoryQuantities = [{ locationId, name: 'available', quantity: 1 }];
  }
  return fields;
}

export interface JacobProductSetOptions {
  locationId?: string;
}

export function buildJacobMemoProductSetInput(
  item: JacobMemoItem,
  opts: JacobProductSetOptions = {},
): Record<string, unknown> {
  const builtListing =
    item.kind === 'watch'
      ? (() => {
          const built = buildWatchListing(watchRecord(item));
          if ('needsReview' in built) {
            throw new Error(`Watch listing needs review for ${item.itemNumber}: ${built.reason}`);
          }
          return applyNewVintageWatchListing(built);
        })()
      : accessoryListing(item);

  const extraMetafields = [...builtListing.metafields];
  if (item.kind === 'watch' && item.diamondWeight) {
    extraMetafields.push({
      namespace: 'custom',
      key: 'diamond_weight',
      type: 'single_line_text_field',
      value: `${item.diamondWeight}ct`,
    });
  }

  const tags = [...new Set([...builtListing.tags, JACOB_MEMO_TAG, MEDIA_MISSING_TAG, 'Jacob & Co', NEW_VINTAGE])].sort();
  const price = retailUsdForItem(item).toFixed(2);
  const compareAt = item.jacobRetailUsd.toFixed(2);

  return {
    handle: handleForItem(item),
    title: builtListing.title,
    descriptionHtml: builtListing.descriptionHtml,
    vendor: JACOB_VENDOR,
    productType: item.productType,
    category: item.category,
    status: statusForItem(item),
    tags,
    metafields: extraMetafields,
    seo: { title: builtListing.seoTitle, description: builtListing.seoDescription },
    productOptions: [{ name: 'Title', values: [{ name: 'Default Title' }] }],
    variants: [
      {
        optionValues: [{ optionName: 'Title', name: 'Default Title' }],
        price,
        compareAtPrice: compareAt,
        sku: item.itemNumber,
        taxable: true,
        ...uniqueVariantInventory(opts.locationId, { cost: item.costUsd.toFixed(2) }),
      },
    ],
  };
}

export function jacobCoWatchesCollectionInput(): Record<string, unknown> {
  return {
    title: JACOB_COLLECTION_TITLE,
    handle: JACOB_COLLECTION_HANDLE,
    ruleSet: {
      appliedDisjunctively: false,
      rules: [
        { column: 'TYPE', relation: 'EQUALS', condition: 'Watch' },
        { column: 'VENDOR', relation: 'EQUALS', condition: JACOB_VENDOR },
      ],
    },
  };
}
