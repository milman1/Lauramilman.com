/**
 * Pre-import check for a Shopify product CSV of jewelry.
 *
 * Uploadify (and the feed writers) require ACTIVE + SKU + qty > 0, plus a
 * real Shopify Category. Image-only extra rows are ignored; each Handle is
 * judged from its product row and first variant row.
 */
import { taxonomyForProductType, isRecognizedJewelryCategory } from './taxonomy.js';

export interface JewelryCsvIssue {
  handle: string;
  row: number;
  field: string;
  message: string;
}

interface CsvProduct {
  handle: string;
  headerRow: number;
  status: string;
  published: string;
  type: string;
  category: string;
  sku: string;
  tracker: string;
  qty: string;
  policy: string;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      if (field.endsWith('\r')) field = field.slice(0, -1);
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    if (field.endsWith('\r')) field = field.slice(0, -1);
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function headerIndex(headers: string[], ...names: string[]): number {
  const want = names.map((n) => n.trim().toLowerCase());
  return headers.findIndex((h) => want.includes(h.trim().toLowerCase()));
}

function cell(row: string[], index: number): string {
  if (index < 0) return '';
  return (row[index] ?? '').trim();
}

export function validateJewelryCsv(text: string): JewelryCsvIssue[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [{ handle: '', row: 1, field: 'file', message: 'CSV is empty' }];
  const headers = rows[0]!.map((h) => h.trim());
  const col = {
    handle: headerIndex(headers, 'Handle'),
    status: headerIndex(headers, 'Status'),
    published: headerIndex(headers, 'Published'),
    type: headerIndex(headers, 'Type'),
    category: headerIndex(headers, 'Product Category'),
    sku: headerIndex(headers, 'Variant SKU'),
    tracker: headerIndex(headers, 'Variant Inventory Tracker'),
    qty: headerIndex(headers, 'Variant Inventory Qty'),
    policy: headerIndex(headers, 'Variant Inventory Policy'),
  };
  const issues: JewelryCsvIssue[] = [];
  const required: Array<[keyof typeof col, string]> = [
    ['handle', 'Handle'],
    ['status', 'Status'],
    ['sku', 'Variant SKU'],
    ['tracker', 'Variant Inventory Tracker'],
    ['qty', 'Variant Inventory Qty'],
    ['category', 'Product Category'],
  ];
  for (const [key, label] of required) {
    if (col[key] < 0) {
      issues.push({ handle: '', row: 1, field: label, message: `Missing column "${label}"` });
    }
  }
  if (issues.length > 0) return issues;

  const byHandle = new Map<string, CsvProduct>();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    const handle = cell(row, col.handle);
    if (!handle) {
      issues.push({ handle: '', row: i + 1, field: 'Handle', message: 'Blank handle' });
      continue;
    }
    const existing = byHandle.get(handle);
    const product: CsvProduct = existing ?? {
      handle,
      headerRow: i + 1,
      status: '',
      published: '',
      type: '',
      category: '',
      sku: '',
      tracker: '',
      qty: '',
      policy: '',
    };
    const status = cell(row, col.status);
    const category = cell(row, col.category);
    const type = cell(row, col.type);
    const sku = cell(row, col.sku);
    const tracker = cell(row, col.tracker);
    const qty = cell(row, col.qty);
    const policy = cell(row, col.policy);
    const published = cell(row, col.published);
    if (status) product.status = status;
    if (category) product.category = category;
    if (type) product.type = type;
    if (published) product.published = published;
    if (sku && !product.sku) {
      product.sku = sku;
      product.tracker = tracker;
      product.qty = qty;
      product.policy = policy;
      product.headerRow = i + 1;
    }
    byHandle.set(handle, product);
  }

  for (const product of byHandle.values()) {
    const row = product.headerRow;
    if (product.status.toLowerCase() !== 'active') {
      issues.push({
        handle: product.handle,
        row,
        field: 'Status',
        message: `Must be active (got "${product.status || '(blank)'}"). Uploadify skips / delists anything not ACTIVE.`,
      });
    }
    if (!product.sku) {
      issues.push({
        handle: product.handle,
        row,
        field: 'Variant SKU',
        message: 'SKU is required. Use the internal stock number.',
      });
    }
    if (product.tracker.toLowerCase() !== 'shopify') {
      issues.push({
        handle: product.handle,
        row,
        field: 'Variant Inventory Tracker',
        message: `Must be "shopify" (got "${product.tracker || '(blank)'}"). Untracked inventory reads as qty 0 to Uploadify.`,
      });
    }
    const qty = Number(product.qty);
    if (!Number.isFinite(qty) || qty < 1) {
      issues.push({
        handle: product.handle,
        row,
        field: 'Variant Inventory Qty',
        message: `Must be ≥ 1 for a piece you want listed (got "${product.qty || '(blank)'}"). Unique jewelry is qty 1.`,
      });
    }
    if (product.policy && product.policy.toLowerCase() !== 'deny') {
      issues.push({
        handle: product.handle,
        row,
        field: 'Variant Inventory Policy',
        message: `Use "deny" so qty 0 cannot sell (got "${product.policy}").`,
      });
    }
    if (!product.category) {
      const suggested = taxonomyForProductType(product.type);
      issues.push({
        handle: product.handle,
        row,
        field: 'Product Category',
        message: `Category is blank. For Type "${product.type || 'Jewelry'}" use "${suggested.breadcrumb}" (or ${suggested.id}).`,
      });
    } else if (!isRecognizedJewelryCategory(product.category)) {
      issues.push({
        handle: product.handle,
        row,
        field: 'Product Category',
        message: `"${product.category}" is not a recognized jewelry/watch Shopify category.`,
      });
    }
  }
  return issues;
}

export function formatJewelryCsvReport(issues: JewelryCsvIssue[]): string {
  if (issues.length === 0) return 'Jewelry CSV OK — every product is ACTIVE, has a SKU, tracked qty ≥ 1, and a Shopify Category.\n';
  const lines = ['Jewelry CSV failed Uploadify/marketplace checks:', ''];
  for (const issue of issues) {
    const where = issue.handle ? `${issue.handle} (row ${issue.row})` : `row ${issue.row}`;
    lines.push(`- ${where} [${issue.field}]: ${issue.message}`);
  }
  return lines.join('\n') + '\n';
}
