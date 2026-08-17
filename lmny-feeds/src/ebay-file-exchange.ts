/**
 * eBay File Exchange helpers — LMNY
 *
 * Seller Hub's listings template (BusinessPolicy sheet) wants
 * `Policy Name - (ID: 123456)`. Display name alone or digits alone
 * both fail with error 21917328.
 */

export const EBAY_TITLE_MAX = 80;
export const PAYMENT_PROFILE_COL = 'PaymentProfileName';
export const RETURN_PROFILE_COL = 'ReturnProfileName';
export const TITLE_COL = '*Title';
export const DESCRIPTION_COL = '*Description';
export const CUSTOM_LABEL_COL = 'CustomLabel';

export const PAYMENT_PROFILE_COLS = ['PaymentProfileName', 'Payment profile name'] as const;
export const RETURN_PROFILE_COLS = ['ReturnProfileName', 'Return profile name'] as const;
export const SHIPPING_PROFILE_COLS = ['ShippingProfileName', 'Shipping profile name'] as const;
export const CUSTOM_LABEL_COLS = ['CustomLabel', 'Custom Label (SKU)'] as const;
export const TITLE_COLS = ['*Title', 'Title'] as const;
export const ITEM_NUMBER_COLS = ['Item number', 'ItemID', 'Item ID'] as const;

/** Exact Payment profile name from Seller Hub listings-template BusinessPolicy sheet. */
export const LMNY_EBAY_PAYMENT_PROFILE =
  'eBay Managed Payments (246832199020) - (ID: 246832199020)';
export const LMNY_EBAY_SHIPPING_PROFILE =
  'Daily Deals - 1Handling Day - (ID: 258461530020)';
/** Watches use the Seller Hub no-returns policy, not 14-day refunds. */
export const LMNY_EBAY_RETURN_PROFILE =
  'No returns accepted - (ID: 24363507020)';
/** From lauramilman.com privacy policy: 1145 6th Avenue, Fl 3, New York, NY 10036. */
export const LMNY_EBAY_POSTAL_CODE = '10036';
/** Calculated-shipping package weight for a boxed watch (pounds). */
export const LMNY_EBAY_WEIGHT_MAJOR = '2';
export const LMNY_EBAY_WEIGHT_MINOR = '0';
export const LMNY_EBAY_WEIGHT_UNIT = 'lb';
export const LMNY_EBAY_PACKAGE_TYPE = 'PackageThickEnvelope';

const POLICY_ID_SUFFIX = /\s*\(\d+\)\s*$/;
const TRUNCATED_TITLE = /(?:Box\s*&|Watch\s*w\/|w\/|&)$/;

export function stripPolicyIdSuffix(value: string): string {
  return value.replace(POLICY_ID_SUFFIX, '').trim();
}

export function looksLikePolicyIdSuffix(value: string): boolean {
  return POLICY_ID_SUFFIX.test(value);
}

export function looksTruncatedEbayTitle(title: string): boolean {
  return TRUNCATED_TITLE.test(title.trim());
}

/** Shorten a title until it fits eBay's 80-character limit. Prefer dropping filler, not the reference. */
export function fitEbayTitle(title: string, max = EBAY_TITLE_MAX): string {
  let t = title.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;

  const steps: Array<[RegExp, string]> = [
    [/\bAudemars Piguet\b/g, 'AP'],
    [/\b Selfwinding\b/g, ''],
    [/\b Watch\b/g, ''],
    [/\b Womens\b/g, ''],
    [/\b Mens\b/g, ''],
    [/\b Unisex\b/g, ''],
    [/\b Pre-Owned\b/g, ''],
    [/\b Retail Ready\b/g, ''],
  ];
  for (const [re, sub] of steps) {
    if (t.length <= max) break;
    t = t.replace(re, sub).replace(/\s+/g, ' ').trim();
  }
  if (t.length > max) t = t.slice(0, max).trim();
  return t;
}

export function repairEbayTitle(
  title: string,
  description = '',
  max = EBAY_TITLE_MAX,
): { title: string; changed: boolean; reason?: string } {
  const original = title;
  let next = title.trim();
  const desc = description.toLowerCase();

  if (looksTruncatedEbayTitle(next)) {
    if (/Box\s*&$/.test(next) && /full set/.test(desc)) {
      next = `${next} Papers`;
    } else if (/(?:Watch\s*)?w\/$/.test(next) && /with papers|w\/ papers/.test(desc)) {
      next = next.replace(/\s*(?:Watch\s*)?w\/$/, '') + ' w/ Papers';
    }
  }

  next = fitEbayTitle(next, max);
  if (next === original) return { title: original, changed: false };
  return {
    title: next,
    changed: true,
    reason: original.length > max || looksTruncatedEbayTitle(original)
      ? 'title truncated or over 80 characters'
      : 'title normalized',
  };
}

export function firstPresentColumn(
  headersOrRow: string[] | Record<string, string>,
  names: readonly string[],
): string | undefined {
  if (Array.isArray(headersOrRow)) {
    return names.find((name) => headersOrRow.includes(name));
  }
  return names.find((name) => Object.prototype.hasOwnProperty.call(headersOrRow, name));
}

export function rowCustomLabel(row: Record<string, string>): string {
  const col = firstPresentColumn(row, CUSTOM_LABEL_COLS);
  return col ? (row[col] ?? '') : '';
}

export function rowTitle(row: Record<string, string>): string {
  const col = firstPresentColumn(row, TITLE_COLS);
  return col ? (row[col] ?? '') : '';
}

export function actionColumn(headers: string[]): string | undefined {
  return headers.find((h) => h === 'Action' || h.startsWith('*Action') || h.startsWith('Action('));
}

export interface EbayFixOptions {
  /** Replace every payment-profile column with this exact name. */
  paymentProfileName?: string;
  /** Replace every return-profile column with this exact name. */
  returnProfileName?: string;
}

export interface EbayFixChange {
  customLabel: string;
  field: string;
  from: string;
  to: string;
  reason: string;
}

export interface EbayFixResult {
  infoLine: string;
  headers: string[];
  rows: Record<string, string>[];
  changes: EbayFixChange[];
  /** Seller Hub templates are UTF-8 with BOM. */
  bom: boolean;
}

export function isEbayResultsFile(text: string): boolean {
  const first = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
  return /^Line Number,/i.test(first);
}

export function parseEbayFileExchange(text: string): {
  infoLine: string;
  headers: string[];
  rows: Record<string, string>[];
  bom: boolean;
} {
  const bom = text.startsWith('\uFEFF');
  const raw = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records = parseCsv(raw);
  if (records.length < 2) {
    throw new Error('File Exchange CSV needs an Info line plus a header row');
  }
  const infoLine = records[0]!.join(',');
  if (!/^Info,/i.test(infoLine)) {
    throw new Error(
      `Not a File Exchange template (first line must start with Info,). Got: ${infoLine.slice(0, 80)}`,
    );
  }
  const headers = records[1]!;
  const rows = records.slice(2).filter((r) => r.some((c) => c.trim() !== '')).map((r) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]!] = r[i] ?? '';
    }
    return obj;
  });
  return { infoLine, headers, rows, bom };
}

/**
 * Seller Hub identifies the template from line 1. eBay's own downloads are
 * UTF-8 with BOM and CRLF. Rewriting as LF-only / no BOM makes upload fail
 * with "We couldn’t identify your template."
 */
export function serializeEbayFileExchange(
  infoLine: string,
  headers: string[],
  rows: Record<string, string>[],
  options: { bom?: boolean } = {},
): string {
  const lines = [infoLine, serializeCsvRow(headers)];
  for (const row of rows) {
    lines.push(serializeCsvRow(headers.map((h) => row[h] ?? '')));
  }
  const body = `${lines.join('\r\n')}\r\n`;
  return (options.bom === false ? '' : '\uFEFF') + body;
}

export function fixEbayFileExchange(text: string, options: EbayFixOptions = {}): EbayFixResult {
  if (isEbayResultsFile(text)) {
    throw new Error(
      'This is an eBay results/error file (starts with Line Number), not a listing template. Upload the original File Exchange template, not the results CSV.',
    );
  }
  const parsed = parseEbayFileExchange(text);
  const changes: EbayFixChange[] = [];
  const payCol = firstPresentColumn(parsed.headers, PAYMENT_PROFILE_COLS) ?? PAYMENT_PROFILE_COL;
  const returnCol = firstPresentColumn(parsed.headers, RETURN_PROFILE_COLS) ?? RETURN_PROFILE_COL;
  if (!parsed.headers.includes(returnCol)) parsed.headers.push(returnCol);

  for (const row of parsed.rows) {
    const label = rowCustomLabel(row);

    const currentPay = row[payCol] ?? '';
    const nextPay = options.paymentProfileName ?? LMNY_EBAY_PAYMENT_PROFILE;
    if (nextPay !== currentPay) {
      changes.push({
        customLabel: label,
        field: payCol,
        from: currentPay,
        to: nextPay,
        reason: 'set to Seller Hub payment policy name',
      });
      row[payCol] = nextPay;
    }

    const currentReturn = row[returnCol] ?? '';
    const nextReturn = options.returnProfileName ?? LMNY_EBAY_RETURN_PROFILE;
    if (nextReturn !== currentReturn) {
      changes.push({
        customLabel: label,
        field: returnCol,
        from: currentReturn,
        to: nextReturn,
        reason: 'set to Seller Hub no-returns policy for watches',
      });
      row[returnCol] = nextReturn;
    }

    const titleCol = firstPresentColumn(row, TITLE_COLS) ?? TITLE_COL;
    const descCol = firstPresentColumn(row, [DESCRIPTION_COL, 'Description']) ?? DESCRIPTION_COL;
    const currentTitle = row[titleCol] ?? '';
    const repaired = repairEbayTitle(currentTitle, row[descCol] ?? '');
    if (repaired.changed) {
      changes.push({
        customLabel: label,
        field: titleCol,
        from: currentTitle,
        to: repaired.title,
        reason: repaired.reason ?? 'title repaired',
      });
      row[titleCol] = repaired.title;
    }
  }

  return { ...parsed, changes };
}

export function isEbayListingsTemplate(text: string): boolean {
  return /Template=eBay-listings-template/i.test(text.replace(/^\uFEFF/, ''));
}

export function parseEbayListingsTemplate(text: string): {
  infoLines: string[];
  headers: string[];
  rows: Record<string, string>[];
  bom: boolean;
} {
  const bom = text.startsWith('\uFEFF');
  const raw = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records = parseCsv(raw);
  const infoLines: string[] = [];
  let headerIndex = -1;
  for (let i = 0; i < records.length; i++) {
    const line = records[i]!.join(',');
    if (/^#INFO/i.test(line) || /^Info,/i.test(line)) {
      infoLines.push(line);
      continue;
    }
    headerIndex = i;
    break;
  }
  if (headerIndex < 0 || !records[headerIndex]) {
    throw new Error('Listings template needs #INFO lines plus a header row');
  }
  const headers = records[headerIndex]!;
  const rows = records.slice(headerIndex + 1).filter((r) => r.some((c) => c.trim() !== '')).map((r) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]!] = r[i] ?? '';
    }
    return obj;
  });
  return { infoLines, headers, rows, bom };
}

export function serializeEbayListingsTemplate(
  infoLines: string[],
  headers: string[],
  rows: Record<string, string>[],
  options: { bom?: boolean } = {},
): string {
  const lines = [...infoLines, serializeCsvRow(headers)];
  for (const row of rows) {
    lines.push(serializeCsvRow(headers.map((h) => row[h] ?? '')));
  }
  const body = `${lines.join('\r\n')}\r\n`;
  return (options.bom === false ? '' : '\uFEFF') + body;
}

export function applyReturnProfile(
  rows: Record<string, string>[],
  headers: string[],
  returnProfileName = LMNY_EBAY_RETURN_PROFILE,
): number {
  const returnCol = firstPresentColumn(headers, RETURN_PROFILE_COLS);
  if (!returnCol) return 0;
  let n = 0;
  for (const row of rows) {
    if (row[returnCol] !== returnProfileName) {
      row[returnCol] = returnProfileName;
      n += 1;
    }
  }
  return n;
}

export interface EbayWatchItemRef {
  itemId: string;
  sku: string;
  title: string;
}

/** Match live eBay titles to listings-template rows. Duplicate titles are assigned once each. */
export function matchLiveWatchesToRows(
  rows: Record<string, string>[],
  live: Array<{ itemId: string; title: string }>,
): { matched: EbayWatchItemRef[]; unmatchedLive: Array<{ itemId: string; title: string }> } {
  const byTitle = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    const title = rowTitle(row);
    const list = byTitle.get(title) ?? [];
    list.push(row);
    byTitle.set(title, list);
  }
  const matched: EbayWatchItemRef[] = [];
  const unmatchedLive: Array<{ itemId: string; title: string }> = [];
  for (const item of live) {
    const cands = byTitle.get(item.title);
    const row = cands?.shift();
    if (!row) {
      unmatchedLive.push(item);
      continue;
    }
    matched.push({ itemId: item.itemId, sku: rowCustomLabel(row), title: item.title });
  }
  return { matched, unmatchedLive };
}

export function buildClassicReviseNoReturns(items: EbayWatchItemRef[]): string {
  const headers = ['Action', 'ItemID', 'CustomLabel', 'ReturnProfileName'];
  const rows = items.map((item) => ({
    Action: 'Revise',
    ItemID: item.itemId,
    CustomLabel: item.sku,
    ReturnProfileName: LMNY_EBAY_RETURN_PROFILE,
  }));
  return serializeEbayFileExchange('Info,Version=1.0.0', headers, rows);
}

export function toListingsReviseRows(
  rows: Record<string, string>[],
  headers: string[],
  items: EbayWatchItemRef[],
): { headers: string[]; rows: Record<string, string>[] } {
  const skuCol = firstPresentColumn(headers, CUSTOM_LABEL_COLS) ?? 'Custom Label (SKU)';
  const actionCol = actionColumn(headers);
  if (!actionCol) throw new Error('Listings template is missing an Action column');
  const nextHeaders = [...headers];
  if (!firstPresentColumn(nextHeaders, ITEM_NUMBER_COLS)) {
    const skuIndex = nextHeaders.indexOf(skuCol);
    nextHeaders.splice(skuIndex >= 0 ? skuIndex : 1, 0, 'Item number');
  }
  const itemCol = firstPresentColumn(nextHeaders, ITEM_NUMBER_COLS)!;
  const returnCol = firstPresentColumn(nextHeaders, RETURN_PROFILE_COLS);
  const bySku = new Map(items.map((item) => [item.sku, item]));
  const reviseRows: Record<string, string>[] = [];
  for (const row of rows) {
    const item = bySku.get(row[skuCol] ?? '');
    if (!item) continue;
    const next = { ...row, [actionCol]: 'Revise', [itemCol]: item.itemId };
    if (returnCol) next[returnCol] = LMNY_EBAY_RETURN_PROFILE;
    reviseRows.push(next);
  }
  return { headers: nextHeaders, rows: reviseRows };
}

export interface EbayResultsRow {
  itemId: string;
  sku: string;
  status: string;
  title: string;
}

export function parseEbayResultsRows(text: string): EbayResultsRow[] {
  const raw = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records = parseCsv(raw);
  if (records.length < 2) return [];
  const headers = records[0]!.map((h) => h.trim());
  const itemCol = firstPresentColumn(headers, ['ItemID', 'Item ID', 'Item number', 'Item Number']);
  const skuCol = firstPresentColumn(headers, ['CustomLabel', 'Custom Label', 'Custom Label (SKU)', 'SKU']);
  const statusCol = firstPresentColumn(headers, ['Status']);
  const titleCol = firstPresentColumn(headers, ['Title', '*Title']);
  if (!itemCol) return [];
  return records.slice(1).flatMap((r) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]!] = r[i] ?? '';
    const itemId = (obj[itemCol] ?? '').trim();
    if (!/^\d{10,14}$/.test(itemId)) return [];
    return [{
      itemId,
      sku: skuCol ? (obj[skuCol] ?? '').trim() : '',
      status: statusCol ? (obj[statusCol] ?? '').trim() : '',
      title: titleCol ? (obj[titleCol] ?? '').trim() : '',
    }];
  });
}

/** RFC 4180-ish parser. File Exchange quotes fields that contain commas. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (inQuotes) throw new Error('Unclosed quoted field in File Exchange CSV');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function serializeCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(',');
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
