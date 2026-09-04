/**
 * eBay item-specifics for watch products, stored as custom.* metafields.
 *
 * Marketplace Connect maps these seven keys once (Mapping → Item specifics →
 * "Use [key] from custom"). Values are extracted from title + descriptionHtml
 * when the copy actually states them. Department / Handedness / Type are
 * catalog-wide constants where the source does not say otherwise.
 *
 * Never guess: an uncertain field stays blank and is flagged for review.
 * Existing custom.model / custom.case_size (feed watches) are not overwritten.
 */

export const EBAY_WATCH_NAMESPACE = 'custom';

export const EBAY_WATCH_KEYS = [
  'band_material',
  'case_size',
  'department',
  'handedness',
  'model',
  'style',
  'type',
] as const;

export type EbayWatchKey = (typeof EBAY_WATCH_KEYS)[number];

export const EBAY_WATCH_TYPE = 'Wristwatch';
export const EBAY_WATCH_HANDEDNESS = 'Right';

/** Collection / line names, longest first so "Tank Francaise" wins over "Tank". */
const STYLE_LINES = [
  'Signature Deco',
  'Tank Francaise',
  'Tank Française',
  'Tank Asymmetric',
  'Pasha Seatimer',
  'Classique Femme',
  'GMT Master II',
  'Sky Dweller',
  'Yacht-Master',
  'Yachtmaster',
  'Oyster Perpetual',
  'Submariner Date',
  'Royal Oak Offshore',
  'Day-Date',
  'Santos 100',
  'Happy Diamonds',
  'Happy Sport',
  'Chopardissimo',
  'Super Ocean',
  'Sea-Dweller',
  'Explorer II',
  'GMT Master',
  'Datejust',
  'Submariner',
  'Daytona',
  'Explorer',
  'Oysterdate',
  'Serpenti',
  'Tubogas',
  'Quadrato',
  'Parentesi',
  'Panthere',
  'Panthère',
  'Captive',
  'Cadenas',
  'Premier',
  'Santos',
  'Pasha',
  'Trinity',
  'Charms',
  'Avenue',
  'Butterfly',
  'Nautilus',
  'Aquanaut',
  'Reverso',
  'Speedmaster',
  'Royal Oak',
  'Art Deco',
  'Tank',
] as const;

const ORGANIC_STRAP = [
  'alligator',
  'crocodile',
  'leather',
  'calfskin',
  'suede',
  'ostrich',
  'lizard',
  'snake',
  'rubber',
  'caoutchouc',
  'nato',
  'fabric',
  'textile',
  'silk',
  'satin',
] as const;

const ORGANIC_TO_EBAY: Record<string, string> = {
  alligator: 'Alligator',
  crocodile: 'Crocodile',
  leather: 'Leather',
  calfskin: 'Leather',
  suede: 'Leather',
  ostrich: 'Ostrich',
  lizard: 'Lizard',
  snake: 'Snake',
  rubber: 'Rubber',
  caoutchouc: 'Rubber',
  nato: 'NATO',
  fabric: 'Fabric',
  textile: 'Fabric',
  silk: 'Silk',
  satin: 'Satin',
};

export interface EbayWatchFlag {
  field: EbayWatchKey | 'duplicate' | 'other';
  reason: string;
  excerpt?: string;
}

export interface EbayWatchValues {
  band_material?: string;
  case_size?: string;
  department?: string;
  handedness?: string;
  model?: string;
  style?: string;
  type?: string;
}

export interface EbayWatchExtraction {
  values: EbayWatchValues;
  flags: EbayWatchFlag[];
}

export interface EbayWatchSource {
  title: string;
  descriptionHtml: string;
  /** Variant SKU — never used as Model. */
  sku?: string | null;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function labeledFields(html: string, plain: string): Map<string, string> {
  const out = new Map<string, string>();
  const remember = (label: string, value: string) => {
    const key = label.replace(/\s+/g, ' ').trim().toLowerCase().replace(/:$/, '');
    const v = value.replace(/\s+/g, ' ').trim();
    if (key && v && !out.has(key)) out.set(key, v);
  };
  const htmlRe = /<strong>\s*([^:<]+):?\s*<\/strong>\s*([^<]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = htmlRe.exec(html))) remember(m[1]!, m[2]!);
  const lineRe = /(?:^|[;\n]|<li>)\s*([A-Za-z][A-Za-z /-]{1,40}):\s*([^<\n;]+)/g;
  while ((m = lineRe.exec(`${plain}\n`))) remember(m[1]!, m[2]!);
  return out;
}

function labeled(map: Map<string, string>, ...names: string[]): string | undefined {
  for (const name of names) {
    const v = map.get(name.toLowerCase());
    if (v) return v;
  }
  return undefined;
}

function isStockLike(value: string, sku?: string | null): boolean {
  const v = value.trim();
  if (!v) return true;
  if (sku && v.toLowerCase() === sku.trim().toLowerCase()) return true;
  if (/^(rr|j)\d{4,}$/i.test(v)) return true;
  return false;
}

function cleanToken(value: string): string {
  return value.replace(/^[,.;:\s]+|[,.;:\s]+$/g, '').replace(/\s+/g, ' ').trim();
}

function canonicalDepartment(raw: string): string | undefined {
  const s = raw.trim().toLowerCase();
  if (/unisex/.test(s)) return 'Unisex';
  if (/women|lad(?:y|ies)/.test(s)) return "Women's";
  if (/\bmen|gents?/.test(s)) return "Men's";
  return undefined;
}

function departmentFrom(
  title: string,
  plain: string,
  labeledDept?: string,
): { value?: string; flags: EbayWatchFlag[] } {
  const flags: EbayWatchFlag[] = [];
  if (labeledDept) {
    const v = canonicalDepartment(labeledDept);
    if (v) return { value: v, flags };
  }
  const blob = `${title} ${plain}`;
  const women =
    /\bwomen(?:['’]?s)?(?:\s+watch)?\b/i.test(title) ||
    /\blad(?:y|ies)(?:['’]?s)?(?:\s+watch)?\b/i.test(title) ||
    /\blad(?:y|ies)['’]?s\s+(?:dress\s+)?watch\b/i.test(blob);
  const men =
    /\bmen(?:['’]?s)?(?:\s+watch)?\b/i.test(title) ||
    /\bgents?(?:['’]?s)?(?:\s+watch)?\b/i.test(title);
  const unisex = /\bunisex\b/i.test(title);
  if (unisex) return { value: 'Unisex', flags };
  if (women && men) {
    flags.push({ field: 'department', reason: 'title mentions both men and women' });
    return { flags };
  }
  if (women) return { value: "Women's", flags };
  if (men) return { value: "Men's", flags };
  return { flags };
}

function handednessFrom(plain: string): { value: string; flags: EbayWatchFlag[] } {
  const flags: EbayWatchFlag[] = [];
  if (/\bleft[- ]hand(?:ed)?\b/i.test(plain)) {
    return { value: 'Left', flags };
  }
  return { value: EBAY_WATCH_HANDEDNESS, flags };
}

function typeFrom(plain: string, title: string): { value?: string; flags: EbayWatchFlag[] } {
  const blob = `${title} ${plain}`;
  if (/\bpocket\s+watch\b/i.test(blob) || /\bpendant\s+watch\b/i.test(blob)) {
    return {
      flags: [{ field: 'type', reason: 'copy looks like a pocket/pendant watch, not Wristwatch' }],
    };
  }
  return { value: EBAY_WATCH_TYPE, flags: [] };
}

function styleFrom(title: string, plain: string, labeledStyle?: string): string | undefined {
  if (labeledStyle) {
    const v = cleanToken(labeledStyle);
    if (v) return titleCaseWords(v);
  }
  const pick = (text: string): string | undefined => {
    const hits: Array<{ line: string; index: number; len: number }> = [];
    for (const line of STYLE_LINES) {
      const re = new RegExp(`\\b${escapeRegex(line)}\\b`, 'i');
      const m = re.exec(text);
      if (m && m.index != null) {
        const normalized = normalizeStyle(line);
        hits.push({ line: normalized, index: m.index, len: normalized.length });
      }
    }
    hits.sort((a, b) => b.len - a.len || a.index - b.index);
    return hits[0]?.line;
  };
  return pick(title) ?? pick(plain);
}

function normalizeStyle(line: string): string {
  if (line === 'Panthère') return 'Panthere';
  if (line === 'Tank Française') return 'Tank Francaise';
  return line;
}

function titleCaseWords(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function caseSizeFrom(title: string, plain: string, labels: Map<string, string>): {
  value?: string;
  flags: EbayWatchFlag[];
} {
  const flags: EbayWatchFlag[] = [];
  const labeledSize = labeled(
    labels,
    'case size',
    'case diameter',
    'dial size',
    'case measurement',
    'case measurements',
  );
  if (labeledSize && /\d/.test(labeledSize) && !/inch|wrist/i.test(labeledSize)) {
    const n = normalizeMm(labeledSize);
    if (n) return { value: n, flags };
  }
  const sizeLabel = labeled(labels, 'size');
  if (sizeLabel && /\d/.test(sizeLabel) && /mm/i.test(sizeLabel) && !/inch|wrist/i.test(sizeLabel)) {
    const n = normalizeMm(sizeLabel);
    if (n) return { value: n, flags };
  }

  const includingLugs = plain.match(
    /case[^.]*?(?:including lugs[, ]+)?measures?\s+(\d+(?:\.\d+)?\s*(?:mm)?\s*(?:x|×)\s*\d+(?:\.\d+)?\s*mm)/i,
  );
  if (includingLugs?.[1]) {
    const n = normalizeMm(includingLugs[1]);
    if (n) return { value: n, flags };
  }

  const caseMeasures = plain.match(/case[^.]*?measures?\s+(\d+(?:\.\d+)?\s*mm(?:\s*(?:x|×)\s*\d+(?:\.\d+)?\s*mm)?)/i);
  if (caseMeasures?.[1]) {
    const n = normalizeMm(caseMeasures[1]);
    if (n) return { value: n, flags };
  }

  const square = `${title} ${plain}`.match(/\b(\d+(?:\.\d+)?)\s*mm\s+square\b/i);
  if (square?.[1]) return { value: `${trimNum(square[1]!)}mm`, flags };

  const dim = `${title} ${plain}`.match(/\b(\d+(?:\.\d+)?)\s*mm\s*(?:x|×)\s*(\d+(?:\.\d+)?)\s*mm\b/i);
  if (dim) return { value: `${trimNum(dim[1]!)}mm x ${trimNum(dim[2]!)}mm`, flags };

  const titleDial = title.match(/\b(\d+(?:\.\d+)?)\s*mm(?:\s+dial)?\b/i);
  if (titleDial?.[1] && !/wrist/i.test(title)) {
    return { value: `${trimNum(titleDial[1])}mm`, flags };
  }

  const design = plain.match(/\b(\d+(?:\.\d+)?)\s*mm\s+(?:design|case|dial)\b/i);
  if (design?.[1]) return { value: `${trimNum(design[1])}mm`, flags };

  const lengthMm = labeled(labels, 'length');
  if (lengthMm && /mm/i.test(lengthMm) && !/wrist|inch/i.test(lengthMm)) {
    const n = normalizeMm(lengthMm);
    if (n) {
      flags.push({ field: 'case_size', reason: 'used labeled Length as case size', excerpt: lengthMm });
      return { value: n, flags };
    }
  }

  return { flags };
}

function normalizeMm(raw: string): string | undefined {
  const two = raw.match(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*(?:x|×)\s*(\d+(?:\.\d+)?)\s*mm/i);
  if (two) return `${trimNum(two[1]!)}mm x ${trimNum(two[2]!)}mm`;
  const one = raw.match(/(\d+(?:\.\d+)?)\s*mm/i);
  if (one) return `${trimNum(one[1]!)}mm`;
  return undefined;
}

function trimNum(n: string): string {
  const x = Number(n);
  return Number.isInteger(x) ? String(x) : String(x);
}

function bandMaterialFrom(title: string, plain: string, labels: Map<string, string>): {
  value?: string;
  flags: EbayWatchFlag[];
} {
  const flags: EbayWatchFlag[] = [];
  const labeledBand = labeled(
    labels,
    'band material',
    'strap material',
    'bracelet material',
    'band',
    'strap',
  );
  if (labeledBand) {
    const mapped = mapBandPhrase(labeledBand);
    if (mapped) {
      if (mapped === 'Satin') {
        flags.push({ field: 'band_material', reason: 'satin band stated; not inferred as Leather', excerpt: labeledBand });
      }
      return { value: mapped, flags };
    }
    flags.push({ field: 'band_material', reason: 'labeled band/strap was not a known material', excerpt: labeledBand });
  }

  const blob = `${title} ${plain}`;
  const buckleOnly = /\b(steel|gold|silver|platinum)\s+buckle\b/i.test(blob);
  const color = 'black|blue|brown|white|red|green|pink|grey|gray|navy|tan|beige|cream|burgundy|orange|purple|yellow';
  const materials = ORGANIC_STRAP.join('|');
  const organic = blob.match(
    new RegExp(
      String.raw`\b(?:(?:${color})\s+)?(${materials})(?:\s+(?:${color}))?(?:\s+leather)?\s+(?:strap|band)s?\b` +
        String.raw`|\b(?:strap|band)s?\s+(?:is\s+|in\s+|of\s+|made\s+of\s+)?(?:(?:${color})\s+)?(${materials})\b`,
      'i',
    ),
  );
  if (organic) {
    const word = (organic[1] || organic[2] || '').toLowerCase();
    const mapped = ORGANIC_TO_EBAY[word];
    if (mapped === 'Satin') {
      flags.push({ field: 'band_material', reason: 'satin band/strap stated; not inferred as Leather', excerpt: organic[0] });
    }
    if (mapped) return { value: mapped, flags };
  }

  // Metal bracelet / band / strap — never buckle.
  const karat = String.raw`18\s?(?:k(?:t)?|ct)`;
  const metalBand = blob.match(
    new RegExp(
      String.raw`\b((?:${karat}\s+)?(?:yellow\s+|white\s+|rose\s+)?two[-\s]?tone(?:\s+${karat})?(?:\s+gold)?|(?:${karat}\s+)?(?:yellow|white|rose)\s+gold|${karat}\s+gold|stainless\s+steel|titanium|platinum|ceramic)\s+(?:bracelet|band|strap)s?\b`,
      'i',
    ),
  );
  const goldBracelet = blob.match(/\b(?:woven\s+)?gold\s+bracelet\b/i);
  const steelBracelet = blob.match(/\bstainless\s+steel\s+(?:bracelet|band|strap)s?\b|\bsteel\s+(?:bracelet|band|strap)s?\b/i);
  if (metalBand) {
    return { value: mapMetalBand(metalBand[1]!), flags };
  }
  if (goldBracelet) return { value: 'Gold', flags };
  if (steelBracelet && !buckleOnly) return { value: 'Stainless Steel', flags };
  if (/\bsteel\s+bracelet\b/i.test(blob)) return { value: 'Stainless Steel', flags };

  if (/\bleather\s+accents?\b/i.test(blob) && !/\bleather\s+(?:strap|band)\b/i.test(blob)) {
    flags.push({ field: 'band_material', reason: 'leather accents stated; not assumed to be the strap' });
  }
  if (buckleOnly && !organic && !metalBand && !goldBracelet) {
    flags.push({ field: 'band_material', reason: 'buckle metal is not band material', excerpt: 'buckle' });
  }
  return { flags };
}

function mapBandPhrase(raw: string): string | undefined {
  const s = raw.toLowerCase();
  for (const [key, val] of Object.entries(ORGANIC_TO_EBAY)) {
    if (s.includes(key)) return val;
  }
  if (/stainless|steel/.test(s)) return 'Stainless Steel';
  if (/titanium/.test(s)) return 'Titanium';
  if (/platinum/.test(s)) return 'Platinum';
  if (/ceramic/.test(s)) return 'Ceramic';
  if (/two[-\s]?tone/.test(s)) return 'Two-Tone';
  if (/yellow\s+gold/.test(s)) return 'Yellow Gold';
  if (/white\s+gold/.test(s)) return 'White Gold';
  if (/rose\s+gold/.test(s)) return 'Rose Gold';
  if (/\bgold\b/.test(s)) return 'Gold';
  return undefined;
}

function mapMetalBand(raw: string): string {
  const s = raw.toLowerCase();
  if (/two[-\s]?tone/.test(s)) return 'Two-Tone';
  if (/stainless|steel/.test(s)) return 'Stainless Steel';
  if (/titanium/.test(s)) return 'Titanium';
  if (/platinum/.test(s)) return 'Platinum';
  if (/ceramic/.test(s)) return 'Ceramic';
  if (/yellow/.test(s)) return 'Yellow Gold';
  if (/white/.test(s)) return 'White Gold';
  if (/rose/.test(s)) return 'Rose Gold';
  return 'Gold';
}

function modelFrom(
  title: string,
  plain: string,
  labels: Map<string, string>,
  sku?: string | null,
  style?: string,
): { value?: string; flags: EbayWatchFlag[] } {
  const flags: EbayWatchFlag[] = [];
  const labeledModel = labeled(labels, 'model');
  if (labeledModel && !isStockLike(labeledModel, sku) && !/^n\/?a$/i.test(labeledModel)) {
    return { value: cleanToken(labeledModel), flags };
  }

  const refLabeled = labeled(labels, 'reference', 'ref', 'reference number');
  if (refLabeled && !isStockLike(refLabeled, sku)) {
    return { value: cleanToken(refLabeled).replace(/^#/, ''), flags };
  }

  const ref = `${title} ${plain}`.match(/\bref(?:erence)?\.?\s*#?\s*([A-Z0-9][A-Z0-9./-]{1,24})/i);
  if (ref?.[1] && !isStockLike(ref[1], sku) && !/^(mm|k|ct)$/i.test(ref[1])) {
    return { value: cleanToken(ref[1].replace(/[.,]$/, '')), flags };
  }

  const hashRef = title.match(/#\s*([A-Z0-9]{3,12})\b/);
  if (hashRef?.[1] && !isStockLike(hashRef[1], sku)) {
    return { value: hashRef[1], flags };
  }

  const codes = title.match(/\b(?!18K\b)([A-Z]{2,}\d{2,}[A-Z0-9]*|\d{4,6}[A-Z]{1,6}|\d{4,6})\b/g) ?? [];
  for (const code of codes) {
    if (isStockLike(code, sku)) continue;
    if (/^(19|20)\d{2}$/.test(code)) continue; // years
    if (/^\d{1,3}$/.test(code)) continue;
    return { value: code, flags };
  }

  const bvlgari = title.match(/\b((?:BB|SQ|SP|BJ)\s*\d{1,3}(?:\s+\d?[A-Z0-9]{1,4})?)\b/i);
  if (bvlgari?.[1] && !isStockLike(bvlgari[1], sku)) {
    return { value: bvlgari[1].replace(/\s+/g, ' ').trim().toUpperCase(), flags };
  }

  if (style) return { value: style, flags };
  return { flags };
}

export function extractEbayWatchSpecifics(source: EbayWatchSource): EbayWatchExtraction {
  const title = source.title ?? '';
  const html = source.descriptionHtml ?? '';
  const plain = stripHtml(html);
  const labels = labeledFields(html, `${title} ${plain}`);
  const flags: EbayWatchFlag[] = [];

  const type = typeFrom(plain, title);
  flags.push(...type.flags);
  const handed = handednessFrom(`${title} ${plain}`);
  flags.push(...handed.flags);
  const dept = departmentFrom(title, plain, labeled(labels, 'department'));
  flags.push(...dept.flags);
  const style = styleFrom(title, plain, labeled(labels, 'style'));
  const band = bandMaterialFrom(title, plain, labels);
  flags.push(...band.flags);
  const caseSize = caseSizeFrom(title, plain, labels);
  flags.push(...caseSize.flags);
  const model = modelFrom(title, plain, labels, source.sku, style);
  flags.push(...model.flags);

  const values: EbayWatchValues = {};
  if (type.value) values.type = type.value;
  if (handed.value) values.handedness = handed.value;
  if (dept.value) values.department = dept.value;
  if (style) values.style = style;
  if (band.value) values.band_material = band.value;
  if (caseSize.value) values.case_size = caseSize.value;
  if (model.value) values.model = model.value;
  return { values, flags };
}

/**
 * Existing non-empty custom.* values win (feed watches already have model /
 * case_size for the PDP). Constants still fill when missing. Extracted values
 * never wipe a field.
 */
export function mergeEbayWatchSpecifics(
  extracted: EbayWatchValues,
  existing: Partial<Record<EbayWatchKey, string | null | undefined>> = {},
): { values: EbayWatchValues; keptExisting: EbayWatchKey[] } {
  const values: EbayWatchValues = {};
  const keptExisting: EbayWatchKey[] = [];
  for (const key of EBAY_WATCH_KEYS) {
    const had = (existing[key] ?? '').trim();
    const next = (extracted[key] ?? '').trim();
    if (had) {
      values[key] = had;
      if (next && next !== had) keptExisting.push(key);
    } else if (next) {
      values[key] = next;
    }
  }
  return { values, keptExisting };
}

export interface WatchDuplicateInput {
  id: string;
  handle: string;
  title: string;
  sku?: string | null;
  tags?: string[];
  status?: string;
}

export interface WatchDuplicateGroup {
  key: string;
  reason: string;
  products: WatchDuplicateInput[];
}

function normalizeSku(sku: string): string {
  return sku.trim().toLowerCase();
}

function stemHandle(handle: string): string {
  return handle.replace(/^bv-/, '');
}

/**
 * True duplicates: same manufacturer/stock SKU on two Shopify products, or
 * an original handle plus its `bv-` Back Vault reimport. Same commercial title
 * with different SKUs (two Datejust 126334s) is inventory, not a duplicate.
 */
export function findDuplicateWatchGroups(products: WatchDuplicateInput[]): WatchDuplicateGroup[] {
  const bySku = new Map<string, WatchDuplicateInput[]>();
  const byStem = new Map<string, WatchDuplicateInput[]>();
  for (const p of products) {
    const sku = (p.sku ?? '').trim();
    if (sku) {
      const k = normalizeSku(sku);
      const list = bySku.get(k) ?? [];
      list.push(p);
      bySku.set(k, list);
    }
    const stem = stemHandle(p.handle);
    const list = byStem.get(stem) ?? [];
    list.push(p);
    byStem.set(stem, list);
  }

  const groups: WatchDuplicateGroup[] = [];
  const seen = new Set<string>();
  const fingerprint = (members: WatchDuplicateInput[]) =>
    members
      .map((m) => m.id)
      .sort()
      .join('|');

  for (const [sku, members] of bySku) {
    if (members.length < 2) continue;
    const fp = fingerprint(members);
    seen.add(fp);
    groups.push({
      key: sku,
      reason: 'same SKU on more than one product',
      products: members,
    });
  }
  for (const [stem, members] of byStem) {
    if (members.length < 2) continue;
    const hasBv = members.some((m) => m.handle.startsWith('bv-'));
    const hasOrig = members.some((m) => !m.handle.startsWith('bv-'));
    if (!hasBv || !hasOrig) continue;
    const fp = fingerprint(members);
    if (seen.has(fp)) continue;
    seen.add(fp);
    groups.push({
      key: stem,
      reason: 'original import and backvault-feed copy of the same watch',
      products: members,
    });
  }
  return groups.sort((a, b) => b.products.length - a.products.length);
}

export function ebayMetafieldInputs(
  ownerId: string,
  values: EbayWatchValues,
  existing: Partial<Record<EbayWatchKey, string | null | undefined>> = {},
): Array<{ ownerId: string; namespace: string; key: string; type: string; value: string }> {
  const { values: merged } = mergeEbayWatchSpecifics(values, existing);
  const out: Array<{ ownerId: string; namespace: string; key: string; type: string; value: string }> = [];
  for (const key of EBAY_WATCH_KEYS) {
    const next = (merged[key] ?? '').trim();
    if (!next) continue;
    const had = (existing[key] ?? '').trim();
    if (had === next) continue;
    out.push({
      ownerId,
      namespace: EBAY_WATCH_NAMESPACE,
      key,
      type: 'single_line_text_field',
      value: next,
    });
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
