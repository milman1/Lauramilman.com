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

/** Key matching ignores case, separators and a trailing index: ImageLink2 → imagelink/2. */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Every media URL a row carries — not just the first field that matches.
 *
 * `pick()` returns one key's value and stops, so a feed that spreads photos
 * across `ImageLink` / `ImageLink2` / `ImageLink3` yielded exactly one image.
 * That is why every watch in Shopify had a single photo and no `stones` row
 * ever held more than one image or one video, despite both columns being
 * arrays and the feed supplying several of each.
 *
 * Matches a candidate key exactly **or** the same key with a numeric suffix
 * (`ImageLink2`, `image_3`, `Photo 4`), and still splits delimiter-joined
 * values inside a single field. Scheme-less values (`dnalinks.in/a.jpg`) are
 * coerced the same way cert URLs are. Ordered by candidate, then by index;
 * deduped so a URL repeated across fields attaches once.
 *
 * Watch extras that only exist on the DNA viewer (often `.jpeg` while the
 * API lists `.jpg` or nothing) are merged later by `enrichWatchGalleries`.
 */
export function collectUrls(raw: Raw, keys: string[]): string[] {
  const wanted = keys.map(normalizeKey);
  const matches: Array<{ rank: number; index: number; value: unknown }> = [];
  for (const actual of Object.keys(raw)) {
    const key = normalizeKey(actual);
    for (let rank = 0; rank < wanted.length; rank++) {
      const base = wanted[rank]!;
      if (!key.startsWith(base)) continue;
      const suffix = key.slice(base.length);
      // Anything but a bare index (…Type, …Alt, "videos" vs "video") is a
      // different field, so keep looking rather than claiming it here.
      if (suffix !== '' && !/^\d+$/.test(suffix)) continue;
      matches.push({ rank, index: suffix === '' ? 0 : Number(suffix), value: raw[actual] });
      break;
    }
  }
  matches.sort((a, b) => a.rank - b.rank || a.index - b.index);
  const out: string[] = [];
  for (const match of matches) {
    if (match.value === null || match.value === undefined) continue;
    const list = Array.isArray(match.value) ? match.value : String(match.value).split(/[,|\n]/);
    for (const entry of list) {
      const url = normalizeUrl(String(entry).trim());
      if (url && !out.includes(url)) out.push(url);
    }
  }
  return out;
}

/**
 * Media field candidates. Numbered siblings (ImageLink1, ImageLink2, …) are
 * matched by `collectUrls` itself, so only base names belong here.
 */
const IMAGE_KEYS = ['imagelink', 'image', 'image_url', 'images', 'img', 'photo', 'photos', 'picture', 'pictures', 'diamond_image'];
const VIDEO_KEYS = ['videolink', 'video_html', 'video', 'video_url', 'videos', 'v360', 'video_link', 'diamond_video'];

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
  // Bare "I" is IGI's Ideal — 4,677 lab rounds carry it. Without the mapping
  // it passed through as "I", indistinguishable from colour I.
  I: 'Ideal', ID: 'Ideal', IDEAL: 'Ideal',
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

/**
 * Recover a certificate number from the certificate URL when the feed's
 * Certificate field is empty — which it usually is: the live rows carry only
 * CertificateLink, so cert_number never populated and the PDP's certificate
 * row showed the lab with no number.
 *
 * Two shapes observed: report-check URLs (?reportno=2205551234) and hosted
 * PDFs whose filename IS the number (…/certificate_images/6455949159.pdf).
 * The filename path insists on digits only, so a URL like …/certificate.pdf
 * yields nothing rather than the word "certificate".
 */
export function certNumberFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    for (const key of ['reportno', 'reportNo', 'report_no', 'report']) {
      const v = u.searchParams.get(key);
      if (v && /^[A-Za-z0-9-]{5,}$/.test(v)) return v;
    }
    const base = u.pathname.split('/').filter(Boolean).pop() ?? '';
    const stem = base.replace(/\.(pdf|jpe?g|png|html?)$/i, '');
    return /^\d{5,}$/.test(stem) ? stem : undefined;
  } catch {
    return undefined;
  }
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

/**
 * Feed condition "aftermarket" (any casing / surrounding text) means the
 * piece is excluded entirely — never imported, never priced. The label lives
 * on the feed's condition field and does not surface in Shopify tags once
 * the product is held out.
 */
export function isAftermarketCondition(condition: string | undefined): boolean {
  if (!condition) return false;
  return /\bafter[\s_-]?market\b/i.test(condition);
}

export interface NormalizeResult {
  items: FeedItem[];
  holds: Hold[];
}

/**
 * LMNY's cost for a stone.
 *
 * Belgium Dia fields (confirmed from live lab feed raw keys):
 *   Buy_Price, Buy_Price_Discount_PER, COD_Buy_Price, Memo_Price, Rap_Price, …
 *
 * **Lab:** Buy_Price is USD **per carat**, not total. Live fingerprint: median
 * Buy_Price stays ~$100 across 1–10ct while true $/ct declines with size —
 * treating it as total inverted the retail curve (~1/20th prices). Total cost
 * = Buy_Price × Weight. Prefer an explicit total when present and it agrees
 * with per-carat × carat within 5%; otherwise multiply.
 *
 * **Natural:** Buy_Price (when non-zero) is a total; otherwise
 * Rap × (1 + Buy_Price_Discount_PER/100).
 */
export interface StoneCostResolution {
  costUsd: number;
  pricePerCaratUsd?: number;
  /** Set when both a total and a per-carat signal disagree beyond tolerance. */
  mismatchDetail?: string;
}

const BUY_PRICE_KEYS = [
  'buy_price',
  'cod_buy_price',
  'memo_price',
  'cost',
  'cost_usd',
  'net_price',
  'price',
  'price_usd',
  'amount',
];
const TOTAL_PRICE_KEYS = ['total_price', 'total_cost', 'total_cost_usd', 'stone_price', 'stone_total'];
const PER_CARAT_KEYS = [
  'price_per_carat',
  'price_per_ct',
  'price_ct',
  'per_carat',
  'per_ct',
  'buy_price_per_carat',
];

function withinPct(a: number, b: number, pct: number): boolean {
  if (a <= 0 || b <= 0) return false;
  return Math.abs(a - b) / Math.max(a, b) <= pct;
}

export function resolveStoneCost(
  raw: Raw,
  kind: 'natural' | 'lab',
  carat: number,
  rapPriceUsd: number | undefined,
): StoneCostResolution | undefined {
  const buy = num(raw, BUY_PRICE_KEYS);
  const explicitTotal = num(raw, TOTAL_PRICE_KEYS);
  const explicitPpc = num(raw, PER_CARAT_KEYS);

  if (kind === 'lab') {
    // Prefer an explicit per-carat field when present.
    const ppc = explicitPpc ?? buy;
    if (!ppc || !carat) {
      // Last resort: an explicit total alone.
      if (explicitTotal) {
        return { costUsd: Math.round(explicitTotal * 100) / 100, pricePerCaratUsd: Math.round((explicitTotal / carat) * 100) / 100 };
      }
      return undefined;
    }
    const multiplied = Math.round(ppc * carat * 100) / 100;
    if (explicitTotal && !withinPct(explicitTotal, multiplied, 0.05)) {
      // Prefer the explicit total but flag the disagreement for the report.
      return {
        costUsd: Math.round(explicitTotal * 100) / 100,
        pricePerCaratUsd: Math.round((explicitTotal / carat) * 100) / 100,
        mismatchDetail: `total ${explicitTotal} vs ppc×carat ${multiplied} (ppc=${ppc})`,
      };
    }
    // If "buy" already looks like a total (≈ explicitPpc × carat), use it.
    if (explicitPpc && buy && withinPct(buy, explicitPpc * carat, 0.05)) {
      return {
        costUsd: Math.round(buy * 100) / 100,
        pricePerCaratUsd: Math.round(explicitPpc * 100) / 100,
      };
    }
    return {
      costUsd: multiplied,
      pricePerCaratUsd: Math.round(ppc * 100) / 100,
    };
  }

  // Natural: Buy_Price is total when present; else Rap × (1 + disc/100).
  if (buy) {
    const costUsd = Math.round(buy * 100) / 100;
    return { costUsd, pricePerCaratUsd: carat > 0 ? Math.round((costUsd / carat) * 100) / 100 : undefined };
  }
  if (explicitTotal) {
    const costUsd = Math.round(explicitTotal * 100) / 100;
    return { costUsd, pricePerCaratUsd: carat > 0 ? Math.round((costUsd / carat) * 100) / 100 : undefined };
  }
  const discRaw = pick(raw, ['buy_price_discount_per', 'buy_discount', 'buy_price_discount', 'memo_discount_per']);
  const disc = discRaw === undefined ? Number.NaN : Number(String(discRaw).replace(/[%\s]/g, ''));
  if (rapPriceUsd && Number.isFinite(disc)) {
    const c = rapPriceUsd * (1 + disc / 100);
    if (c > 0) {
      const costUsd = Math.round(c);
      return { costUsd, pricePerCaratUsd: carat > 0 ? Math.round((costUsd / carat) * 100) / 100 : undefined };
    }
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
    if (!carat || !shape || !color || !clarity || !lab) {
      holds.push({ kind, stockRef, reason: 'missing_grading_fields' });
      continue;
    }
    const resolved = resolveStoneCost(raw, kind, carat, rapPriceUsd);
    if (!resolved) {
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
    const certNumber = str(raw, ['cert_number', 'certificate_number', 'cert_no', 'report_number', 'report_no', 'certificate']);
    const certUrl = normalizeUrl(str(raw, ['cert_url', 'certificate_url', 'report_url', 'cert_link', 'certificatelink']));
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
      certNumber: certNumber ?? certNumberFromUrl(certUrl),
      certUrl,
      measurements: str(raw, ['measurements', 'measurement', 'dimensions']),
      tablePct: num(raw, ['table_per', 'table_pct', 'table_percent', 'table']),
      depthPct: num(raw, ['depth_per', 'depth_pct', 'depth_percent', 'depth']),
      costUsd: resolved.costUsd,
      pricePerCaratUsd: resolved.pricePerCaratUsd,
      rapPriceUsd,
      imageUrls: collectUrls(raw, IMAGE_KEYS),
      videoUrls: collectUrls(raw, VIDEO_KEYS),
    };
    if (resolved.mismatchDetail) {
      console.warn(`cost mismatch ${kind} ${stockRef}: ${resolved.mismatchDetail}`);
    }
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
    const condition = str(raw, ['condition', 'condition_grade', 'state']);
    if (isAftermarketCondition(condition)) {
      holds.push({ kind, stockRef, reason: 'watch_aftermarket', detail: condition });
      continue;
    }
    // Brands outside WATCH_BRANDS still import — they are tagged
    // `other-watch-brand` at product-build time and land in the Other Watch
    // Brands collection. Curation no longer holds them out of the catalogue.
    const box = bool(raw, ['box', 'has_box', 'with_box', 'original_box']);
    const papers = bool(raw, ['paper', 'papers', 'has_papers', 'with_papers', 'original_papers', 'card']);
    // Spec fields confirmed on the live developer-api/watch payload (2026-08-09
    // key dump): Dial, Bezel, Bracelet, Metal, MM, Links (plural), Comment.
    // OG Tag is not present on the API — do not invent it.
    const item: WatchItem = {
      kind,
      stockRef,
      brand,
      model,
      reference,
      year: str(raw, ['year', 'production_year', 'year_of_production']),
      condition,
      box,
      papers,
      isNaked: !box && !papers,
      caseSizeMm: str(raw, ['mm', 'case_size', 'case_size_mm', 'size_mm']),
      metal: str(raw, ['metal']),
      dial: str(raw, ['dial']),
      bezel: str(raw, ['bezel']),
      bracelet: str(raw, ['bracelet']),
      // API field is `Links` (plural); schema / listing table label stays "Link".
      link: str(raw, ['links', 'link']),
      comment: str(raw, ['comment', 'notes', 'note']),
      costUsd,
      imageUrls: collectUrls(raw, IMAGE_KEYS),
      videoUrls: collectUrls(raw, VIDEO_KEYS),
    };
    items.push(item);
  }
  return { items, holds };
}
