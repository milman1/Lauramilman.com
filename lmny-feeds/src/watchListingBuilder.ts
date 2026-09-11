/**
 * Watch listing builder — LMNY
 *
 * Pure, side-effect-free transform: raw feed record in, Shopify-ready
 * listing fields out. Wired into product.ts for the Belgium Dia watch
 * ingest path. The retired scripts/lmny_watches_backfill.py must not be used
 * to overwrite this structured-source copy.
 *
 * Implements docs/watch-listing-schema.md exactly. If you change a rule,
 * change it there first, then here.
 */

// ---------------------------------------------------------------------------
// Types

export interface WatchFeedRecord {
  brand: string;
  model: string;
  reference: string;
  year?: string | null; // "2014" or "FEB-2016" — both handled
  conditionRaw: string; // e.g. "PRE OWNED", "UNWORN", "MINT", "SLIDER"

  // Every other non-price, non-image column from the master tracking sheet.
  // All optional: undefined means "not stated in the source," which is
  // different from a stated false/empty value and is handled differently
  // (see docs/watch-listing-schema.md). Never invent a value for a missing field.
  box?: boolean | null; // Box column
  paper?: boolean | null; // Paper column
  ogTag?: boolean | null; // OG Tag — original hang tag; table label "Original Tag"
  link?: number | string | null; // Link column; table label "Link"
  caseSizeMm?: number | string | null; // MM column
  bracelet?: string | null; // Bracelet column, e.g. "AP BRACELET"
  dial?: string | null; // Dial column, e.g. "GREY TAPISSERIE"
  bezel?: string | null; // Bezel column, e.g. "OCTAGON"
  metal?: string | null; // Metal column, e.g. "18K YG & S/S" — left as-given
  stockNumber?: string | null; // Stock# — LMNY internal, distinct from reference
  comment?: string | null; // Comment column, e.g. "NAKED"
}

export type ConditionState = 'preowned' | 'unworn';

export interface ConditionMapping {
  state: ConditionState;
  titleWord: 'Pre-Owned' | 'Unworn';
  grade: string | null; // e.g. "Excellent" — spec-table only, never in title
  googleShoppingCondition: 'new' | 'used';
}

export interface WatchListing {
  title: string;
  descriptionHtml: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  /** Google Shopping / MPN plus storefront `custom.*` rows for the PDP specs grid. */
  metafields: { namespace: string; key: string; value: string; type: string }[];
}

/** Returned instead of a WatchListing when the record can't be safely processed. */
export interface NeedsReview {
  needsReview: true;
  reason: string;
  record: WatchFeedRecord;
}

// ---------------------------------------------------------------------------
// Config — flip once the "estate" trust line is confirmed true for this
// inventory (see "Explicitly out of scope" in docs/watch-listing-schema.md).
// SEO description still always ends with "Authenticated by Laura Milman New York."

import {
  boxPaperClause,
  ebayConditionForWatch,
  ebayFeaturesFromBoxPapers,
} from './ebayCondition.js';
import { extractEbayWatchSpecifics } from './ebayWatchSpecifics.js';

const CONFIG = {
  trustLine: '', // e.g. "Authenticated and hand-inspected by Laura Milman New York."
};

// ---------------------------------------------------------------------------
// Condition mapping — the two known STATE values, plus known GRADE values
// (which imply state = preowned). Anything else remains unclassified.

const STATE_MAP: Record<string, ConditionMapping> = {
  'PRE OWNED': { state: 'preowned', titleWord: 'Pre-Owned', grade: null, googleShoppingCondition: 'used' },
  UNWORN: { state: 'unworn', titleWord: 'Unworn', grade: null, googleShoppingCondition: 'new' },
};

const GRADE_MAP: Record<string, string> = {
  MINT: 'Mint',
  EXCELLENT: 'Excellent',
  'VERY GOOD': 'Very Good',
  GOOD: 'Good',
  FAIR: 'Fair',
};

function mapCondition(conditionRaw: string): ConditionMapping | null {
  const key = (conditionRaw || '').trim().toUpperCase();
  if (STATE_MAP[key]) return STATE_MAP[key];
  if (GRADE_MAP[key]) {
    return {
      state: 'preowned',
      titleWord: 'Pre-Owned',
      grade: GRADE_MAP[key],
      googleShoppingCondition: 'used',
    };
  }
  return null; // SLIDER, blank, or anything unrecognized
}

// ---------------------------------------------------------------------------
// Helpers

const ACRONYMS = new Set(['GMT']); // extend as more turn up
const ROMAN_NUMERAL = /^[IVXLCDM]+$/;

function titleCase(s: string): string {
  // Capitalizes after spaces AND hyphens, so "DAY-DATE" -> "Day-Date", not
  // "Day-date". Also preserves known acronyms (GMT) and roman numerals (II).
  const capPiece = (p: string): string => {
    if (!p) return p;
    const up = p.toUpperCase();
    if (ACRONYMS.has(up) || ROMAN_NUMERAL.test(up)) return up;
    return p[0]!.toUpperCase() + p.slice(1).toLowerCase();
  };
  return s
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.split('-').map(capPiece).join('-'))
    .join(' ');
}

const MONTHS: Record<string, string> = {
  JAN: 'January',
  FEB: 'February',
  MAR: 'March',
  APR: 'April',
  MAY: 'May',
  JUN: 'June',
  JUL: 'July',
  AUG: 'August',
  SEP: 'September',
  OCT: 'October',
  NOV: 'November',
  DEC: 'December',
};

/** "2014" -> "2014". "FEB-2016" -> "February 2016". Anything else -> passed through. */
function normalizeYear(year: string | null | undefined): string | null {
  const raw = String(year ?? '').trim();
  if (!raw || /^(?:0|n\/?a|-|unknown)$/i.test(raw)) return null;
  const bare = raw.match(/^\d{4}$/);
  if (bare) return raw;
  const monthYear = raw.match(/^([A-Za-z]{3})-(\d{4})$/);
  if (monthYear) {
    const month = MONTHS[monthYear[1]!.toUpperCase()];
    if (month) return `${month} ${monthYear[2]}`;
  }
  return raw;
}

export function normalizeCaseSize(size: number | string | null | undefined): string | null {
  const raw = String(size ?? '').trim();
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*(?:mm)?$/i);
  if (!match || Number(match[1]) <= 0) return null;
  return `${match[1]}mm`;
}

/** Truncate at the last full word at or under maxLen. Never cuts mid-word. */
function truncateAtWord(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : '').trim();
}

/** Preserve the commercial-intent suffix and shorten only model detail. */
function fitWithSuffix(lead: string, suffix: string, maxLen: number): string {
  const available = maxLen - suffix.length - 1;
  return `${truncateAtWord(lead, available)} ${suffix}`.trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// boxPaperClause lives in ebayCondition.ts — eBay hides Pre-Owned titles when
// Features/Condition say "New with box and papers", so the copy never uses that phrase.

function yesNo(v: boolean | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return v ? 'Yes' : 'No';
}

/**
 * Human-readable bracelet link copy from the feed `Links` field.
 * Positive = extra links included; negative = links short of a full bracelet.
 */
export function linkClause(link: number | string | null | undefined): string | null {
  if (link === null || link === undefined) return 'Not specified';
  const raw = String(link).trim();
  if (!raw) return 'Not specified';
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n === 0) return 'Not specified';
  if (n > 0) {
    return n === 1
      ? '1 additional bracelet link included'
      : `${n} additional bracelet links included`;
  }
  const missing = Math.abs(n);
  return missing === 1
    ? '1 bracelet link missing'
    : `${missing} bracelet links missing`;
}

// ---------------------------------------------------------------------------
// Main transform

export function buildWatchListing(record: WatchFeedRecord): WatchListing | NeedsReview {
  const mapping = mapCondition(record.conditionRaw);

  const brand = titleCase(record.brand);
  const model = titleCase(record.model);
  const reference = record.reference.trim(); // never re-cased
  const year = normalizeYear(record.year);
  const titleWord = mapping?.titleWord ?? null;
  const grade = mapping?.grade ?? null;

  const identity = `${brand} ${model} ${reference}`;
  const fixed = [titleWord, brand, reference].filter(Boolean).join(' ');
  const modelBudget = 80 - fixed.length - 1;
  const titleModel = truncateAtWord(model, modelBudget);
  if (!titleModel || `${fixed} ${titleModel}`.length > 80) {
    return { needsReview: true, reason: 'condition, brand, and reference leave no safe model title within 80 characters', record };
  }
  const titleIdentity = `${brand} ${titleModel} ${reference}`;
  const baseTitle = titleWord ? `${titleWord} ${titleIdentity}` : titleIdentity;

  const yearClause = year ? ` from ${escapeHtml(year)}` : '';
  const gradeClause = grade ? ` It is in ${grade.toLowerCase()} condition.` : '';
  const bpClause = boxPaperClause(record.box, record.paper);
  const linkText = linkClause(record.link)!;
  const openingClause = ` is offered by Laura Milman New York${bpClause ? ` ${bpClause}` : ''}`;

  // Specs render in the theme's `.product-specs` grid via custom.* metafields
  // (same PDP chrome as jewelry), and the description repeats the buyer-facing
  // source facts as a compact labeled block rather than an HTML table.
  const dial = record.dial ? titleCase(record.dial) : null;
  const bezel = record.bezel ? titleCase(record.bezel) : null;
  const bracelet = record.bracelet ? titleCase(record.bracelet) : null;
  const boxYesNo = yesNo(record.box);
  const paperYesNo = yesNo(record.paper);
  const ogTagYesNo = yesNo(record.ogTag);
  const linkValue =
    record.link !== null && record.link !== undefined && String(record.link).trim() !== ''
      ? String(record.link).trim()
      : null;
  const caseSize = normalizeCaseSize(record.caseSizeMm);
  const titleDetails = [caseSize, year].filter(Boolean) as string[];
  let title = baseTitle;
  for (const detail of titleDetails) {
    if (`${title} ${detail}`.length <= 80) title += ` ${detail}`;
  }

  const trustParagraph = CONFIG.trustLine ? `<p>${escapeHtml(CONFIG.trustLine)}</p>` : '';

  const commentIsRedundant =
    (record.comment || '').trim().toUpperCase() === 'NAKED' && record.box === false && record.paper === false;
  const notesParagraph =
    record.comment && !commentIsRedundant ? `<p>${escapeHtml(record.comment)}</p>` : '';

  const descriptionIdentity = titleWord ? `${titleWord} ${brand} ${model} ${reference}` : identity;
  const descriptionHtml =
    `<p>This ${escapeHtml(descriptionIdentity)}` +
    `${yearClause}${openingClause}.${gradeClause}</p>` +
    `<p><strong>Case size:</strong> ${escapeHtml(caseSize ?? 'Not specified')}<br>` +
    `<strong>Year:</strong> ${escapeHtml(year ?? 'Not specified')}<br>` +
    `<strong>Bracelet links:</strong> ${escapeHtml(linkText)}</p>` +
    notesParagraph +
    trustParagraph;

  let seoTitle = titleIdentity;
  if (titleWord && `${seoTitle} ${titleWord}`.length <= 80) seoTitle += ` ${titleWord}`;
  for (const detail of [caseSize, year, 'Watch'].filter(Boolean) as string[]) {
    if (`${seoTitle} ${detail}`.length <= 60) seoTitle += ` ${detail}`;
  }

  const gradeSuffix = grade ? `, ${grade.toLowerCase()} condition` : '';
  const factParts = [caseSize ? `${caseSize} case` : null, year ? `year ${year}` : null, linkText !== 'Not specified' ? linkText : null].filter(Boolean);
  const seoLead = titleWord
    ? `Shop this ${titleWord.toLowerCase()} ${identity}${gradeSuffix}${factParts.length ? ` with ${factParts.join(', ')}` : ''}.`
    : `Explore this ${identity} watch${factParts.length ? ` with ${factParts.join(', ')}` : ''}.`;
  const seoDescription = fitWithSuffix(seoLead, 'Authenticated by Laura Milman New York.', 160);

  const conditionTag = titleWord ? `${titleWord} Watches` : record.conditionRaw.trim();
  const tags = Array.from(new Set([brand, conditionTag, reference, model, 'Watches'].filter(Boolean)));

  const customSpecs: { namespace: string; key: string; value: string; type: string }[] = [];
  const pushCustom = (key: string, value: string | null | undefined) => {
    if (value === null || value === undefined || value === '') return;
    customSpecs.push({ namespace: 'custom', key, value, type: 'single_line_text_field' });
  };
  pushCustom('brand', brand);
  pushCustom('model', model);
  pushCustom('reference', reference);
  pushCustom('year', year);
  pushCustom('case_size', caseSize);
  pushCustom('metal', record.metal ?? null);
  pushCustom('dial', dial);
  pushCustom('bezel', bezel);
  pushCustom('bracelet', bracelet);
  pushCustom('condition', titleWord ?? record.conditionRaw.trim());
  pushCustom('condition_grade', grade);
  pushCustom('box', boxYesNo);
  pushCustom('papers', paperYesNo);
  pushCustom('ebay_condition', ebayConditionForWatch({
    state: mapping?.state ?? null,
    box: record.box,
    papers: record.paper,
  }));
  pushCustom('features', ebayFeaturesFromBoxPapers(record.box, record.paper));
  pushCustom('original_tag', ogTagYesNo);
  pushCustom('link', linkValue);
  pushCustom('stock_number', record.stockNumber ?? null);

  // eBay item specifics (Marketplace Connect maps custom.* once). Model and
  // case_size above are the PDP values — extractor fills the rest, never
  // overwriting those two.
  const ebay = extractEbayWatchSpecifics({
    title,
    descriptionHtml,
    sku: record.stockNumber,
  });
  pushCustom('type', ebay.values.type);
  pushCustom('handedness', ebay.values.handedness);
  pushCustom('department', ebay.values.department);
  pushCustom('style', ebay.values.style);
  pushCustom('band_material', ebay.values.band_material);
  if (!caseSize) pushCustom('case_size', ebay.values.case_size);

  const metafields = [
    {
      namespace: 'global',
      key: 'MPN',
      value: reference,
      type: 'single_line_text_field',
    },
    ...customSpecs,
  ];
  if (mapping) {
    metafields.unshift({
      namespace: 'mm-google-shopping',
      key: 'condition',
      value: mapping.googleShoppingCondition,
      type: 'single_line_text_field',
    });
  }

  return { title, descriptionHtml, seoTitle, seoDescription, tags, metafields };
}

/** True if a title already carries this schema's condition prefix — safe to skip. */
export function alreadyProcessed(currentTitle: string): boolean {
  return /^(Pre-Owned|Unworn)\s/.test(currentTitle.trim());
}
