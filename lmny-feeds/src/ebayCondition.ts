/**
 * eBay condition vs accessories — LMNY
 *
 * eBay Wristwatch condition 1000 is the canned value "New with box and papers"
 * ("brand new and has never been worn"). Marketplace Connect / Uploadify maps
 * Shopify copy that says "box and papers" onto that condition even when the
 * title is Pre-Owned, and eBay then hides the listing.
 *
 * Accessories belong in Features (`With Box`, `With Papers`). Condition is
 * the numeric eBay ConditionID Marketplace Connect expects — not the display
 * name. Wristwatch categories reject `Pre-owned` as a Condition ID
 * ("Condition ID Pre-owned is not supported for this category").
 *
 * 3000 = Used / Pre-owned on watches. 1000 = New with tags (Unworn only).
 */

export const EBAY_CONDITION_NAMESPACE = 'custom';
export const EBAY_CONDITION_KEY = 'ebay_condition';
export const EBAY_FEATURES_KEY = 'features';

/** eBay ConditionID for used / pre-owned watches. Never 1000 on used stock. */
export const EBAY_CONDITION_PREOWNED = '3000';
/** Unworn only. 1000 is New with tags — box/papers stay in Features. */
export const EBAY_CONDITION_UNWORN = '1000';

export const NEW_WITH_BOX_RE = /new\s+with\s+box(?:\s+and\s+papers)?/i;
export const FULL_SET_BOX_PAPERS_RE = /as a full set with box and papers/gi;
export const PREOWNED_TITLE_RE = /\bpre[-\s]?owned\b/i;
export const UNWORN_TITLE_RE = /\bunworn\b/i;

export type WatchState = 'preowned' | 'unworn';

export function titleLooksPreowned(title: string): boolean {
  return PREOWNED_TITLE_RE.test(title);
}

export function titleLooksUnworn(title: string): boolean {
  return UNWORN_TITLE_RE.test(title);
}

/**
 * LMNY watches are pre-owned estate / feed stock unless explicitly Unworn.
 * Unclassified titles (no Pre-Owned prefix) still must not ship as New.
 */
export function ebayConditionForWatch(opts: {
  title: string;
  state?: WatchState | null;
}): string {
  if (opts.state === 'unworn' || titleLooksUnworn(opts.title)) return EBAY_CONDITION_UNWORN;
  return EBAY_CONDITION_PREOWNED;
}

export function ebayFeaturesFromBoxPapers(
  box: boolean | null | undefined,
  papers: boolean | null | undefined,
): string | undefined {
  const parts: string[] = [];
  if (box) parts.push('With Box');
  if (papers) parts.push('With Papers');
  return parts.length ? parts.join(', ') : undefined;
}

export function yesNoToBool(raw: string | null | undefined): boolean | null {
  const v = (raw ?? '').trim().toLowerCase();
  if (!v) return null;
  if (v === 'yes' || v === 'true' || v === '1') return true;
  if (v === 'no' || v === 'false' || v === '0') return false;
  return null;
}

export function ebayFeaturesFromYesNo(
  box: string | null | undefined,
  papers: string | null | undefined,
): string | undefined {
  return ebayFeaturesFromBoxPapers(yesNoToBool(box), yesNoToBool(papers));
}

/** True when any field uses eBay's "New with box and papers" condition language. */
export function hasNewWithBoxLanguage(...fields: Array<string | null | undefined>): boolean {
  return fields.some((f) => Boolean(f && NEW_WITH_BOX_RE.test(f)));
}

export function isPreownedNewWithBoxMismatch(input: {
  title: string;
  fields: Array<string | null | undefined>;
}): boolean {
  if (titleLooksUnworn(input.title)) return false;
  return titleLooksPreowned(input.title) && hasNewWithBoxLanguage(...input.fields);
}

export interface EbayConditionPlanInput {
  title: string;
  descriptionHtml: string;
  productType?: string;
  box?: string | null;
  papers?: string | null;
  ebayCondition?: string | null;
  features?: string | null;
  googleCondition?: string | null;
  state?: WatchState | null;
}

export interface EbayConditionPlan {
  ebayCondition?: string;
  features?: string;
  clearFeatures?: boolean;
  googleCondition?: string;
  descriptionHtml?: string;
  reasons: string[];
}

export function planEbayConditionFix(input: EbayConditionPlanInput): EbayConditionPlan | null {
  const reasons: string[] = [];
  const isWatch = /\bwatch/i.test(input.productType ?? '');
  const wantedCondition = isWatch
    ? ebayConditionForWatch({ title: input.title, state: input.state })
    : titleLooksUnworn(input.title)
      ? EBAY_CONDITION_UNWORN
      : titleLooksPreowned(input.title)
        ? EBAY_CONDITION_PREOWNED
        : undefined;
  const wantedFeatures = ebayFeaturesFromYesNo(input.box, input.papers);
  const rewritten = rewritePreownedBoxPapersCopy(input.descriptionHtml ?? '');

  let ebayCondition: string | undefined;
  if (wantedCondition && (input.ebayCondition ?? '').trim() !== wantedCondition) {
    ebayCondition = wantedCondition;
    reasons.push(`ebay_condition → ${wantedCondition}`);
  }

  let features: string | undefined;
  let clearFeatures = false;
  if (wantedFeatures && (input.features ?? '').trim() !== wantedFeatures) {
    features = wantedFeatures;
    reasons.push(`features → ${wantedFeatures}`);
  } else if (!wantedFeatures && hasNewWithBoxLanguage(input.features)) {
    clearFeatures = true;
    reasons.push('clear Features "New with box and papers"');
  }

  let googleCondition: string | undefined;
  if (wantedCondition === EBAY_CONDITION_PREOWNED && (input.googleCondition ?? '').trim() === 'new') {
    googleCondition = 'used';
    reasons.push('google condition new → used');
  } else if (wantedCondition === EBAY_CONDITION_PREOWNED && !(input.googleCondition ?? '').trim() && isWatch) {
    googleCondition = 'used';
    reasons.push('google condition → used');
  }

  let descriptionHtml: string | undefined;
  if (rewritten !== (input.descriptionHtml ?? '')) {
    descriptionHtml = rewritten;
    reasons.push('rewrote box-and-papers copy');
  }

  if (hasNewWithBoxLanguage(input.features, input.ebayCondition, input.descriptionHtml)) {
    if (!reasons.some((r) => r.includes('New with box'))) reasons.push('had New with box and papers language');
  }

  if (!ebayCondition && !features && !clearFeatures && !googleCondition && !descriptionHtml) return null;
  return { ebayCondition, features, clearFeatures, googleCondition, descriptionHtml, reasons };
}

/**
 * Stop Marketplace Connect matching the eBay condition value
 * "New with box and papers". Accessories stay in the sentence without "New".
 */
export function rewritePreownedBoxPapersCopy(html: string): string {
  return html
    .replace(FULL_SET_BOX_PAPERS_RE, 'with its original box and papers')
    .replace(/new with box and papers/gi, 'with original box and papers');
}

export function boxPaperClause(box: boolean | null | undefined, paper: boolean | null | undefined): string | null {
  const boxKnown = box !== null && box !== undefined;
  const paperKnown = paper !== null && paper !== undefined;
  if (!boxKnown && !paperKnown) return null;
  if (box && paper) return 'with its original box and papers';
  if (box && !paper) return 'with its original box, but without papers';
  if (!box && paper) return 'with its papers, but without the original box';
  return 'on its own, without box or papers';
}
