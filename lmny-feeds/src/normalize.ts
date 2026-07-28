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

/**
 * Coerce a feed URL to something Shopify's `url` metafield type accepts.
 * The feed emits scheme-less values (e.g. `dnalinks.in/cert/123.pdf`), which
 * Shopify rejects outright — one such record failed an entire live run.
 * Returns undefined when the value can't be made into a plausible URL.
 */
export function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (v === '' || v === '-' || v === 'N/A') return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  // Protocol-relative (//host/path) or bare host/path → assume https.
  const candidate = v.startsWith('//') ? `https:${v}` : `https://${v.replace(/^\/+/, '')}`;
  try {
    const u = new URL(candidate);
    // Require a dotted host so we don't turn junk like "pending" into a URL.
    return u.hostname.includes('.') ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Belgium Dia reports shape as a trade code, and inconsistently cased
 * ("Round" and "ROUND" both appear). Left raw they can't drive a shape filter:
 * SQCU, LCU and CUSHION are one shape to a shopper, and "SQCU" means nothing
 * on a button. Map to the ten canonical shapes the filter shows; the finer
 * distinction (long vs square cushion) isn't something we merchandise on.
 *
 * Codes observed in the live natural feed: ROUND, MRB, RMB, PRINCESS, CUSHION,
 * LCU, SQCU, EMERALD, OVAL, OVR, RADIANT, LRAD, ASSCHER, MARQUISE, HEART,
 * PEAR, TRISTPR. The rest are standard RapNet codes, mapped pre-emptively so a
 * new shape appearing in the feed doesn't surface as a code.
 */
const SHAPE_CODES: Record<string, string> = {
  RD: 'Round', RB: 'Round', RBC: 'Round', BR: 'Round', ROUND: 'Round', MRB: 'Round', RMB: 'Round',
  PR: 'Princess', PRIN: 'Princess', PRINCESS: 'Princess',
  CU: 'Cushion', CUSH: 'Cushion', CUSHION: 'Cushion', LCU: 'Cushion', SQCU: 'Cushion', CMB: 'Cushion',
  EM: 'Emerald', EC: 'Emerald', EMER: 'Emerald', EMERALD: 'Emerald', SQEM: 'Emerald',
  OV: 'Oval', OVR: 'Oval', OVAL: 'Oval',
  RA: 'Radiant', RAD: 'Radiant', LRAD: 'Radiant', SQRAD: 'Radiant', RADIANT: 'Radiant',
  AS: 'Asscher', ASC: 'Asscher', ASSCHER: 'Asscher',
  MQ: 'Marquise', MRQ: 'Marquise', MARQ: 'Marquise', MARQUISE: 'Marquise',
  HS: 'Heart', HT: 'Heart', HEART: 'Heart',
  PS: 'Pear', PE: 'Pear', PEAR: 'Pear',
  TR: 'Trilliant', TRI: 'Trilliant', TRIL: 'Trilliant', TRISTPR: 'Trilliant', TRILLIANT: 'Trilliant',
  BAG: 'Baguette', BGT: 'Baguette', BAGUETTE: 'Baguette',
};

/** The shapes the filter offers a button for, best-seller order (PD's order). */
export const CANONICAL_SHAPES = [
  'Round', 'Princess', 'Cushion', 'Emerald', 'Oval',
  'Radiant', 'Asscher', 'Marquise', 'Heart', 'Pear',
] as const;

export function normalizeShape(s: string): string {
  const key = s.trim().toUpperCase().replace(/[\s._-]+/g, '');
  return SHAPE_CODES[key] ?? titleCase(s);
}

/**
 * Cut, polish and symmetry share the GIA scale and arrive as codes. Left raw,
 * a Good cut becomes the tag "G" — indistinguishable from colour G.
 */
const GRADE_CODES: Record<string, string> = {
  ID: 'Ideal', IDEAL: 'Ideal',
  EX: 'Excellent', EXC: 'Excellent', XX: 'Excellent', EXCELLENT: 'Excellent',
  VG: 'Very Good', VGD: 'Very Good', VERYGOOD: 'Very Good',
  G: 'Good', GD: 'Good', GOOD: 'Good',
  F: 'Fair', FR: 'Fair', FAIR: 'Fair',
  P: 'Poor', PR: 'Poor', POOR: 'Poor',
};

export function normalizeCutGrade(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const key = s.trim().toUpperCase().replace(/[\s._-]+/g, '');
  if (key === '') return undefined;
  return GRADE_CODES[key] ?? titleCase(s);
}

const FLUORESCENCE_CODES: Record<string, string> = {
  NON: 'None', N: 'None', NONE: 'None', NIL: 'None',
  FNT: 'Faint', F: 'Faint', FAINT: 'Faint',
  MED: 'Medium', M: 'Medium', MEDIUM: 'Medium',
  STG: 'Strong', ST: 'Strong', S: 'Strong', STRONG: 'Strong',
  VST: 'Very Strong', VSTG: 'Very Strong', VS: 'Very Strong', VERYSTRONG: 'Very Strong',
};

export function normalizeFluorescence(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const key = s.trim().toUpperCase().replace(/[\s._-]+/g, '');
  if (key === '') return undefined;
  return FLUORESCENCE_CODES[key] ?? titleCase(s);
}

function titleCase(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
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

/**
 * LMNY's cost for a stone. Belgium Dia reports the supplier Buy_Price and,
 * commonly, a Buy_Price_Discount_PER (a negative % off Rapaport). When
 * Buy_Price is 0 but a Rap price and discount exist, cost = Rap × (1 + disc/100).
 */
function stoneCost(raw: Raw, rapPriceUsd: number | undefined): number | undefined {
  const buy = num(raw, ['buy_price', 'cost', 'cost_usd', 'net_price', 'price', 'price_usd', 'total_price', 'amount', 'memo_price']);
  if (buy) return buy;
  const discRaw = pick(raw, ['buy_price_discount_per', 'buy_discount', 'buy_price_discount', 'memo_discount_per']);
  const disc = discRaw === undefined ? Number.NaN : Number(String(discRaw).replace(/[%\s]/g, ''));
  if (rapPriceUsd && Number.isFinite(disc)) {
    const c = rapPriceUsd * (1 + disc / 100);
    if (c > 0) return Math.round(c);
  }
  return undefined;
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
    // Field names follow the Belgium Dia developer API (PascalCase_underscore);
    // pick() is case-insensitive so lowercase candidates match.
    const carat = num(raw, ['carat', 'carats', 'weight', 'carat_weight', 'size']);
    const shape = str(raw, ['shape', 'cut_shape', 'stone_shape']);
    const color = str(raw, ['color', 'colour', 'color_grade']);
    const clarity = str(raw, ['clarity', 'clarity_grade']);
    const lab = str(raw, ['lab', 'cert_lab', 'certificate_lab', 'grading_lab', 'cert']);
    const rapPriceUsd = num(raw, ['rap_price', 'rap', 'rapaport', 'rap_total', 'rap_price_total', 'list_price']);
    const costUsd = stoneCost(raw, rapPriceUsd);
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
      shape: normalizeShape(shape),
      carat,
      color: normalizeColorGrade(color),
      clarity: normalizeClarityGrade(clarity),
      cut: normalizeCutGrade(str(raw, ['cut', 'cut_grade', 'make'])),
      polish: normalizeCutGrade(str(raw, ['polish'])),
      symmetry: normalizeCutGrade(str(raw, ['symmetry', 'sym'])),
      fluorescence: normalizeFluorescence(str(raw, ['fluorescence_intensity', 'fluorescence', 'fluor', 'fl'])),
      lab: lab.toUpperCase(),
      certNumber: str(raw, ['cert_number', 'certificate_number', 'cert_no', 'report_number', 'report_no', 'certificate']),
      certUrl: normalizeUrl(str(raw, ['cert_url', 'certificate_url', 'report_url', 'cert_link', 'certificatelink'])),
      measurements: str(raw, ['measurements', 'measurement', 'dimensions']),
      costUsd,
      rapPriceUsd,
      imageUrls: urls(raw, ['imagelink', 'imagelink1', 'imagelink2', 'image', 'image_url', 'images', 'img', 'photo', 'photos', 'picture', 'diamond_image']),
      videoUrls: urls(raw, ['videolink', 'video_html', 'video', 'video_url', 'videos', 'v360', 'video_link', 'diamond_video']),
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
    const costUsd = num(raw, ['price', 'cost', 'cost_usd', 'price_usd', 'total_price', 'net_price', 'amount']);
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
    const papers = bool(raw, ['paper', 'papers', 'has_papers', 'with_papers', 'original_papers', 'card']);
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
      imageUrls: urls(raw, ['imagelink', 'imagelink1', 'imagelink2', 'image', 'image_url', 'images', 'img', 'photo', 'photos', 'picture']),
      videoUrls: urls(raw, ['videolink', 'video', 'video_url', 'videos', 'video_link']),
    };
    items.push(item);
  }
  return { items, holds };
}
