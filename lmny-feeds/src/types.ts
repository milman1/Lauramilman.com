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
  costUsd: number;
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
  costUsd: number;
  imageUrls: string[];
  videoUrls: string[];
}

export type FeedItem = StoneItem | WatchItem;

export interface Priced {
  retailUsd: number;
  /** (retail − cost) / retail */
  marginPct: number;
  compMidUsd?: number;
  compAsOf?: string;
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
  /** Drives whether an update re-attaches media or leaves what's already there. */
  mediaCount: number;
}

export interface DesiredEntry {
  handle: string;
  contentHash: string;
}

export type Action = 'create' | 'update' | 'archive' | 'skip';

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
