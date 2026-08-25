/**
 * Watch listing builder — LMNY
 *
 * Pure, side-effect-free transform: raw feed record in, Shopify-ready
 * listing fields out. Wired into product.ts for the Belgium Dia watch
 * ingest path; also mirrored by scripts/lmny_watches_backfill.py for the
 * one-time backfill of already-live watches.
 *
 * Implements docs/watch-listing-schema.md exactly. If you change a rule,
 * change it there first, then here, then in lmny_watches_backfill.py —
 * all three must agree or titles will differ depending on whether a watch
 * came in live or through the backfill.
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

const CONFIG = {
  trustLine: '', // e.g. "Authenticated and hand-inspected by Laura Milman New York."
};

// ---------------------------------------------------------------------------
// Condition mapping — the two known STATE values, plus known GRADE values
// (which imply state = preowned). Anything not listed here is NEEDS_REVIEW.

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
  if (!year) return null;
  const bare = year.match(/^\d{4}$/);
  if (bare) return year;
  const monthYear = year.match(/^([A-Za-z]{3})-(\d{4})$/);
  if (monthYear) {
    const month = MONTHS[monthYear[1]!.toUpperCase()];
    if (month) return `${month} ${monthYear[2]}`;
  }
  return year;
}

/** Truncate at the last full word at or under maxLen. Never cuts mid-word. */
function truncateAtWord(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

/** Preserve the commercial-intent suffix and shorten only model detail. */
function fitWithSuffix(lead: string, suffix: string, maxLen: number): string {
  const available = maxLen - suffix.length - 1;
  return `${truncateAtWord(lead, available)} ${suffix}`.trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Built from the box/paper booleans. Returns null when both are unstated. */
function boxPaperClause(box: boolean | null | undefined, paper: boolean | null | undefined): string | null {
  const boxKnown = box !== null && box !== undefined;
  const paperKnown = paper !== null && paper !== undefined;
  if (!boxKnown && !paperKnown) return null;
  if (box && paper) return 'as a full set with box and papers';
  if (box && !paper) return 'with its original box, but without papers';
  if (!box && paper) return 'with its papers, but without the original box';
  return 'on its own, without box or papers';
}

function yesNo(v: boolean | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return v ? 'Yes' : 'No';
}

// ---------------------------------------------------------------------------
// Main transform

export function buildWatchListing(record: WatchFeedRecord): WatchListing | NeedsReview {
  const mapping = mapCondition(record.conditionRaw);
  if (!mapping) {
    return {
      needsReview: true,
      reason: `Unrecognized condition value: "${record.conditionRaw}"`,
      record,
    };
  }

  const brand = titleCase(record.brand);
  const model = titleCase(record.model);
  const reference = record.reference.trim(); // never re-cased
  const year = normalizeYear(record.year);
  const { titleWord, grade, googleShoppingCondition } = mapping;

  const title = `${titleWord} ${brand} ${model} ${reference}`;

  const yearClause = year ? ` from ${escapeHtml(year)}` : '';
  const gradeClause = grade ? ` It is in ${grade.toLowerCase()} condition.` : '';
  const bpClause = boxPaperClause(record.box, record.paper);
  const openingClause = ` is offered by Laura Milman New York${bpClause ? ` ${bpClause}` : ''}`;

  // Specs render in the theme's `.product-specs` grid via custom.* metafields
  // (same PDP chrome as jewelry). Description keeps prose only — no HTML table.
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
  const caseSize = record.caseSizeMm ? `${String(record.caseSizeMm).trim()}mm` : null;

  const trustParagraph = CONFIG.trustLine ? `<p>${escapeHtml(CONFIG.trustLine)}</p>` : '';

  const commentIsRedundant =
    (record.comment || '').trim().toUpperCase() === 'NAKED' && record.box === false && record.paper === false;
  const notesParagraph =
    record.comment && !commentIsRedundant ? `<p>${escapeHtml(record.comment)}</p>` : '';

  const descriptionHtml =
    `<p>This ${titleWord} ${escapeHtml(brand)} ${escapeHtml(model)} ${escapeHtml(reference)}` +
    `${yearClause}${openingClause}.${gradeClause}</p>` +
    notesParagraph +
    trustParagraph;

  const seoTitle = fitWithSuffix(
    `${brand} ${model} ${reference}`,
    `– ${titleWord} Watch`,
    60,
  );

  const gradeSuffix = grade ? `, ${grade.toLowerCase()} condition` : '';
  let seoDescription =
    `Shop this ${titleWord.toLowerCase()} ${brand} ${model} ${reference}${gradeSuffix}. ` +
    `Authenticated by Laura Milman New York.`;
  seoDescription = truncateAtWord(seoDescription, 160);

  const tags = Array.from(new Set([brand, `${titleWord} Watches`, reference, model, 'Watches']));

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
  pushCustom('condition', titleWord);
  pushCustom('condition_grade', grade);
  pushCustom('box', boxYesNo);
  pushCustom('papers', paperYesNo);
  pushCustom('original_tag', ogTagYesNo);
  pushCustom('link', linkValue);
  pushCustom('stock_number', record.stockNumber ?? null);

  const metafields = [
    {
      namespace: 'mm-google-shopping',
      key: 'condition',
      value: googleShoppingCondition,
      type: 'single_line_text_field',
    },
    {
      namespace: 'global',
      key: 'MPN',
      value: reference,
      type: 'single_line_text_field',
    },
    ...customSpecs,
  ];

  return { title, descriptionHtml, seoTitle, seoDescription, tags, metafields };
}

/** True if a title already carries this schema's condition prefix — safe to skip. */
export function alreadyProcessed(currentTitle: string): boolean {
  return /^(Pre-Owned|Unworn)\s/.test(currentTitle.trim());
}
