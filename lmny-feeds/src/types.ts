export type Kind = 'natural' | 'lab' | 'watch';

export interface StoneItem {
  kind: 'natural' | 'lab';
  stockRef: string;
  shape: string;
  carat: number;
  color: string;
  clarity: string;
  cut?: string;
  polish?: string;
  symmetry?: string;
  fluorescence?: string;
  lab: string;
  certNumber?: string;
  certUrl?: string;
  measurements?: string;
  /** Table and depth as percentages. Belgium Dia often omits both. */
  tablePct?: number;
  depthPct?: number;
  /**
   * Total supplier cost in USD. For lab, this is Buy_Price × carat (Belgium Dia
   * Buy_Price is per-carat). For natural, Buy_Price/Rap-derived total.
   */
  costUsd: number;
  /** Lab only: raw Buy_Price interpreted as USD per carat. */
  pricePerCaratUsd?: number;
  /** Rapaport list total (USD) — required to price naturals. */
  rapPriceUsd?: number;
  imageUrls: string[];
  videoUrls: string[];
}

export interface WatchItem {
  kind: 'watch';
  stockRef: string;
  brand: string;
  model: string;
  reference: string;
  year?: string;
  condition?: string;
  box: boolean;
  papers: boolean;
  /** No box and no papers. */
  isNaked: boolean;
  /** Case size in mm from the feed `MM` field. */
  caseSizeMm?: string;
  metal?: string;
  dial?: string;
  bezel?: string;
  bracelet?: string;
  /**
   * Extra bracelet links from the feed `Links` field (API name is plural).
   * Kept as a string so values like "-5" are preserved, not forced numeric.
   */
  link?: string;
  comment?: string;
  costUsd: number;
  imageUrls: string[];
  videoUrls: string[];
}

export type FeedItem = StoneItem | WatchItem;

export interface Priced {
  retailUsd: number;
  /** (retail − cost) / retail */
  marginPct: number;
}

export interface Hold {
  kind: Kind;
  stockRef: string;
  reason: string;
  detail?: string;
}

export interface Publishable {
  item: FeedItem;
  priced: Priced;
}

export interface CatalogEntry {
  id: string;
  handle: string;
  status: string;
  contentHash: string | null;
  tags: string[];
  /** READY media of any type. Zero means the product shows no picture at all. */
  mediaCount: number;
  /**
   * READY images only. An update re-sends `files` when the product holds
   * fewer images than the feed supplies, which is how products stuck at the
   * one image the old single-key media parse produced get the rest.
   */
  imageCount: number;
  /**
   * Attached videos, counting ones still processing — Shopify takes minutes
   * to transcode, and re-uploading a video mid-transcode duplicates it.
   */
  videoCount: number;
  /**
   * First variant's inventory tracking flag. Missing when the catalog row
   * predates this field or the product has no variant line in the bulk file.
   * Uploadify treats untracked (and qty 0) watches as out of stock.
   */
  inventoryTracked?: boolean;
  /** First variant's inventory item GID — used to zero stock on archive. */
  inventoryItemId?: string;
  /** Shopify's summed available quantity across locations (may be 0 if untracked). */
  inventoryQuantity?: number;
}

export interface DesiredEntry {
  handle: string;
  contentHash: string;
}

export type Action = 'create' | 'update' | 'archive' | 'delete' | 'skip';

export interface Decision {
  handle: string;
  action: Action;
  reason: string;
  productId?: string;
}

/** A product whose images all failed to process (or that has none at all). */
export interface BrokenMedia {
  id: string;
  handle: string;
  status: string;
  tags: string[];
  failedMediaIds: string[];
}
