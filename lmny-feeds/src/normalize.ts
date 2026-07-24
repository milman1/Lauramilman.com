import { STONE_GATES, WATCH_BRANDS } from '../config/pricing.js';
import type { FeedItem, Hold, Kind, StoneItem, WatchItem } from './types.js';

/** Best → worst. Grades past the configured floor are held. */
const COLOR_ORDER = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
const CLARITY_ORDER = ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'SI3', 'I1', 'I2', 'I3'];

const WATCH_BRAND_SET = new Set(WATCH_BRANDS.map((b) => b.toLowerCase()));

type Raw = Record<string, unknown>;

/** First non-empty value among candidate keys (case-insensitive key match). */
export function pick(raw: Raw, keys: string[]): unknown {
  const lower = new Map(Object.keys(raw).map((k) => [k.toLowerCase(), k]));
  for (const key of keys) {
    const actual = lower.get(key.toLowerCase());
    if (actual === undefined) continue;
    const v = raw[actual];
    if (v !== null && v !== undefined && v !== '') return v;
  }
  return undefined;
}

function str(raw: Raw, keys: string[]): string | undefined {
  const v = pick(raw, keys);
  if (v === undefined) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}

function num(raw: Raw, keys: string[]): number | undefined {
  const v = pick(raw, keys);
  if (v === undefined) return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function bool(raw: Raw, keys: string[]): boolean {
  const v = pick(raw, keys);
  if (v === undefined) return false;
  if (typeof v === 'boolean') return v;
  return /^(1|true|yes|y)$/i.test(String(v).trim());
}

function urls(raw: Raw, keys: string[]): string[] {
  const v = pick(raw, keys);
  if (v === undefined) return [];
  const list = Array.isArray(v) ? v : String(v).split(/[,|\n]/);
  return list
    .map((u) => String(u).trim())
    .filter((u) => /^https?:\/\//i.test(u));
}

export function normalizeColorGrade(s: string): string {
  return s.trim().toUpperCase();
}

export function normalizeClarityGrade(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '');
}

export function passesColorGate(color: string): boolean {
  const idx = COLOR_ORDER.indexOf(normalizeColorGrade(color));
  const floor = COLOR_ORDER.indexOf(STONE_GATES.worstColor);
  return idx !== -1 && idx <= floor;
}

export function passesClarityGate(clarity: string): boolean {
  const idx = CLARITY_ORDER.indexOf(normalizeClarityGrade(clarity));
  const floor = CLARITY_ORDER.indexOf(STONE_GATES.worstClarity);
  return idx !== -1 && idx <= floor;
}

export function isCuratedWatchBrand(brand: string): boolean {
  return WATCH_BRAND_SET.has(brand.trim().toLowerCase());
}

export interface NormalizeResult {
  items: FeedItem[];
  holds: Hold[];
}

export function normalizeStones(rows: Raw[], kind: 'natural' | 'lab'): NormalizeResult {
  const items: FeedItem[] = [];
  const holds: Hold[] = [];
  for (const raw of rows) {
    const stockRef = str(raw, ['stock_ref', 'stockref', 'stock_no', 'stock_number', 'stock', 'stone_id', 'sku', 'ref', 'id']);
    if (!stockRef) {
      holds.push({ kind, stockRef: '(unknown)', reason: 'missing_stock_ref' });
      continue;
    }
    const carat = num(raw, ['carat', 'carats', 'weight', 'carat_weight', 'size']);
    const shape = str(raw, ['shape', 'cut_shape', 'stone_shape']);
    const color = str(raw, ['color', 'colour', 'color_grade']);
    const clarity = str(raw, ['clarity', 'clarity_grade']);
    const lab = str(raw, ['lab', 'cert_lab', 'certificate_lab', 'grading_lab', 'cert']);
    const costUsd = num(raw, ['cost', 'cost_usd', 'price', 'price_usd', 'total_price', 'net_price', 'amount']);
    if (!carat || !shape || !color || !clarity || !lab) {
      holds.push({ kind, stockRef, reason: 'missing_grading_fields' });
      continue;
    }
    if (!costUsd) {
      holds.push({ kind, stockRef, reason: 'missing_cost' });
      continue;
    }
    if (!passesColorGate(color)) {
      holds.push({ kind, stockRef, reason: 'color_below_floor', detail: color });
      continue;
    }
    if (!passesClarityGate(clarity)) {
      holds.push({ kind, stockRef, reason: 'clarity_below_floor', detail: clarity });
      continue;
    }
    const item: StoneItem = {
      kind,
      stockRef,
      shape,
      carat,
      color: normalizeColorGrade(color),
      clarity: normalizeClarityGrade(clarity),
      cut: str(raw, ['cut', 'cut_grade', 'make']),
      polish: str(raw, ['polish']),
      symmetry: str(raw, ['symmetry', 'sym']),
      fluorescence: str(raw, ['fluorescence', 'fluor', 'fl']),
      lab: lab.toUpperCase(),
      certNumber: str(raw, ['cert_number', 'certificate_number', 'cert_no', 'report_number', 'report_no']),
      certUrl: str(raw, ['cert_url', 'certificate_url', 'report_url', 'cert_link']),
      measurements: str(raw, ['measurements', 'measurement', 'dimensions']),
      costUsd,
      rapPriceUsd: num(raw, ['rap_price', 'rap', 'rapaport', 'rap_total', 'rap_price_total', 'list_price']),
      imageUrls: urls(raw, ['image', 'image_url', 'images', 'img', 'photo', 'photos', 'picture', 'diamond_image']),
      videoUrls: urls(raw, ['video', 'video_url', 'videos', 'v360', 'video_link', 'diamond_video']),
    };
    items.push(item);
  }
  return { items, holds };
}

export function normalizeWatches(rows: Raw[]): NormalizeResult {
  const items: FeedItem[] = [];
  const holds: Hold[] = [];
  const kind: Kind = 'watch';
  for (const raw of rows) {
    const stockRef = str(raw, ['stock_ref', 'stockref', 'stock_no', 'stock_number', 'stock', 'watch_id', 'sku', 'ref', 'id']);
    if (!stockRef) {
      holds.push({ kind, stockRef: '(unknown)', reason: 'missing_stock_ref' });
      continue;
    }
    const brand = str(raw, ['brand', 'make', 'manufacturer']);
    const model = str(raw, ['model', 'model_name', 'collection']);
    const reference = str(raw, ['reference', 'reference_number', 'ref_no', 'model_ref', 'model_number']);
    const costUsd = num(raw, ['cost', 'cost_usd', 'price', 'price_usd', 'total_price', 'net_price', 'amount']);
    if (!brand || !model || !reference) {
      holds.push({ kind, stockRef, reason: 'missing_watch_fields' });
      continue;
    }
    if (!costUsd) {
      holds.push({ kind, stockRef, reason: 'missing_cost' });
      continue;
    }
    if (!isCuratedWatchBrand(brand)) {
      holds.push({ kind, stockRef, reason: 'watch_brand_not_curated', detail: brand });
      continue;
    }
    const box = bool(raw, ['box', 'has_box', 'with_box', 'original_box']);
    const papers = bool(raw, ['papers', 'has_papers', 'with_papers', 'original_papers', 'card']);
    const item: WatchItem = {
      kind,
      stockRef,
      brand,
      model,
      reference,
      year: str(raw, ['year', 'production_year', 'year_of_production']),
      condition: str(raw, ['condition', 'condition_grade', 'state']),
      box,
      papers,
      isNaked: !box && !papers,
      costUsd,
      imageUrls: urls(raw, ['image', 'image_url', 'images', 'img', 'photo', 'photos', 'picture']),
      videoUrls: urls(raw, ['video', 'video_url', 'videos', 'video_link']),
    };
    items.push(item);
  }
  return { items, holds };
}
