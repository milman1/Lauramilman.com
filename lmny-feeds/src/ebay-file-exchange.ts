/**
 * eBay File Exchange helpers — LMNY
 *
 * Seller Hub bulk upload rejects a PaymentProfileName that looks like
 * "eBay Managed Payments (24683219020)". Error 21917328: eBay treats the
 * parenthetical number as a payment-policy ID, and that number is the
 * seller account id, not a Business Policy id.
 *
 * PaymentProfileName must be the exact policy *name* from
 * Seller Hub → Account → Business policies (or a real policy id, digits only).
 */

export const EBAY_TITLE_MAX = 80;
export const PAYMENT_PROFILE_COL = 'PaymentProfileName';
export const TITLE_COL = '*Title';
export const DESCRIPTION_COL = '*Description';
export const CUSTOM_LABEL_COL = 'CustomLabel';

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

export interface EbayFixOptions {
  /** Replace every PaymentProfileName with this exact name. */
  paymentProfileName?: string;
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
}

export function parseEbayFileExchange(text: string): {
  infoLine: string;
  headers: string[];
  rows: Record<string, string>[];
} {
  const raw = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records = parseCsv(raw);
  if (records.length < 2) {
    throw new Error('File Exchange CSV needs an Info line plus a header row');
  }
  const infoLine = records[0]!.join(',');
  const headers = records[1]!;
  const rows = records.slice(2).filter((r) => r.some((c) => c.trim() !== '')).map((r) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]!] = r[i] ?? '';
    }
    return obj;
  });
  return { infoLine, headers, rows };
}

export function serializeEbayFileExchange(
  infoLine: string,
  headers: string[],
  rows: Record<string, string>[],
): string {
  const lines = [infoLine, serializeCsvRow(headers)];
  for (const row of rows) {
    lines.push(serializeCsvRow(headers.map((h) => row[h] ?? '')));
  }
  return lines.join('\n') + '\n';
}

export function fixEbayFileExchange(text: string, options: EbayFixOptions = {}): EbayFixResult {
  const parsed = parseEbayFileExchange(text);
  const changes: EbayFixChange[] = [];

  for (const row of parsed.rows) {
    const label = row[CUSTOM_LABEL_COL] ?? '';

    const currentPay = row[PAYMENT_PROFILE_COL] ?? '';
    const nextPay = options.paymentProfileName
      ? options.paymentProfileName
      : stripPolicyIdSuffix(currentPay);
    if (nextPay !== currentPay) {
      changes.push({
        customLabel: label,
        field: PAYMENT_PROFILE_COL,
        from: currentPay,
        to: nextPay,
        reason: options.paymentProfileName
          ? 'payment profile overridden'
          : 'stripped parenthetical account/policy id (error 21917328)',
      });
      row[PAYMENT_PROFILE_COL] = nextPay;
    }

    const currentTitle = row[TITLE_COL] ?? '';
    const repaired = repairEbayTitle(currentTitle, row[DESCRIPTION_COL] ?? '');
    if (repaired.changed) {
      changes.push({
        customLabel: label,
        field: TITLE_COL,
        from: currentTitle,
        to: repaired.title,
        reason: repaired.reason ?? 'title repaired',
      });
      row[TITLE_COL] = repaired.title;
    }
  }

  return { ...parsed, changes };
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
