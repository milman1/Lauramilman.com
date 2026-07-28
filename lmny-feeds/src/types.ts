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
