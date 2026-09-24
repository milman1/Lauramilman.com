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

export type ConditionMapping = ClassifiedWatchCondition;

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
// Feed-watch SEO descriptions use the store's exchanges-only closer.

import {
  boxPaperClause,
  classifyWatchCondition,
  ebayConditionForWatch,
  ebayFeaturesFromBoxPapers,
  type ClassifiedWatchCondition,
} from './ebayCondition.js';
import { extractEbayWatchSpecifics } from './ebayWatchSpecifics.js';

const CONFIG = {
  trustLine: '', // e.g. "Authenticated and hand-inspected by Laura Milman New York."
};

function mapCondition(conditionRaw: string): ConditionMapping | null {
  return classifyWatchCondition(conditionRaw);
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
  SEPT: 'September',
  OCT: 'October',
  NOV: 'November',
  DEC: 'December',
};

/** Watch SEO closer. The theme's watch policy is exchanges only, not refunds. */
const WATCH_SEO_CLOSER = 'Exchanges only within 7 days of delivery.';

/** "2014" -> "2014". "FEB-2016" / "SEPT-2021" -> "February 2016" / "September 2021". */
function normalizeYear(year: string | null | undefined): string | null {
  const raw = String(year ?? '').trim();
  if (!raw || /^(?:0|n\/?a|-|unknown)$/i.test(raw)) return null;
  const bare = raw.match(/^\d{4}$/);
  if (bare) return raw;
  const monthYear = raw.match(/^([A-Za-z]{3,4})-(\d{4})$/);
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

/** Industry shorthand stays as written. A plain word such as STEEL is lowercased for prose. */
function proseMetal(metal: string | null | undefined): string | null {
  const raw = String(metal ?? '').trim();
  if (!raw) return null;
  if (/[0-9/&]/.test(raw) || /\b(?:YG|WG|RG|SS|S\/S|PT|TT)\b/i.test(raw)) return raw;
  return raw.toLowerCase();
}

function article(phrase: string): string {
  return /^[aeiou]/i.test(phrase) ? 'an' : 'a';
}

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/** Lowercase a source feature and name its part once. "OYSTER" → "an oyster bracelet". */
function featurePhrase(value: string, noun: 'dial' | 'bezel' | 'bracelet'): string {
  const lower = value.toLowerCase();
  const alreadyNamed =
    noun === 'bracelet' ? /\b(?:bracelets?|straps?|bands?)\b/.test(lower) : new RegExp(`\\b${noun}s?\\b`).test(lower);
  const phrase = alreadyNamed ? lower : `${lower} ${noun}`;
  return `${article(phrase)} ${phrase}`;
}

function asSentence(value: string): string {
  const text = value.trim();
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** Prose fragment for a real link count. Zero, blank, and invalid counts are omitted. */
function linkProse(link: number | string | null | undefined): string | null {
  const clause = linkClause(link);
  if (!clause || clause === 'Not specified') return null;
  if (clause.endsWith(' included')) return `including ${clause.slice(0, -' included'.length)}`;
  if (clause.endsWith(' missing')) return `with ${clause}`;
  return null;
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

  const bpClause = boxPaperClause(record.box, record.paper);

  // Specs render in the theme's `.product-specs` grid via custom.* metafields
  // (same PDP chrome as jewelry). The body is one factual paragraph.
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
  const metalProse = proseMetal(record.metal);
  const sizeMetal = [caseSize, metalProse].filter(Boolean).join(' ');
  const watchNoun = sizeMetal ? `${article(sizeMetal)} ${sizeMetal} watch` : 'a watch';
  const featurePhrases = [
    dial ? featurePhrase(dial, 'dial') : null,
    bezel ? featurePhrase(bezel, 'bezel') : null,
    bracelet ? featurePhrase(bracelet, 'bracelet') : null,
  ].filter((part): part is string => Boolean(part));
  const links = linkProse(record.link);
  let descriptionText =
    `This ${titleWord ? `${titleWord.toLowerCase()} ` : ''}${brand} ${model} reference ${reference} is ${watchNoun}`;
  if (featurePhrases.length) descriptionText += ` with ${joinAnd(featurePhrases)}`;
  if (year) descriptionText += ` from ${year}`;
  if (grade) descriptionText += ` in ${grade.toLowerCase()} condition`;
  if (links) descriptionText += `, ${links}`;
  descriptionText += `, offered by Laura Milman New York`;
  if (bpClause) descriptionText += ` ${bpClause}`;
  descriptionText = asSentence(descriptionText);
  if (record.comment && !commentIsRedundant) descriptionText += ` ${asSentence(record.comment)}`;
  const descriptionHtml = `<p>${escapeHtml(descriptionText)}</p>${trustParagraph}`;

  let seoTitle = titleIdentity;
  if (titleWord && `${seoTitle} ${titleWord}`.length <= 80) seoTitle += ` ${titleWord}`;
  for (const detail of [caseSize, year, 'Watch'].filter(Boolean) as string[]) {
    if (`${seoTitle} ${detail}`.length <= 60) seoTitle += ` ${detail}`;
  }

  const seoFacts = [caseSize, year, grade ? `${grade.toLowerCase()} condition` : null].filter(Boolean);
  const seoIdentity = titleWord
    ? `Shop this ${titleWord.toLowerCase()} ${identity}`
    : `Shop this ${identity} watch`;
  const seoLead = `${seoIdentity}${seoFacts.length ? `, ${seoFacts.join(', ')}` : ''}.`;
  const seoDescription = fitWithSuffix(seoLead, WATCH_SEO_CLOSER, 160);

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
