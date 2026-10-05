/**
 * Pre-import check for a Shopify product CSV of jewelry.
 *
 * Draft-only import by default. The legacy marketplace audit is opt-in and
 * is not an import approval. Full saved-product review uses jewelry:gate.
 */
import { copyIssues } from './jewelryGate.js';
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
  if (inQuotes) throw new Error('Unterminated CSV quote');
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

export function validateJewelryCsv(text: string, mode: 'draft-import' | 'marketplace-audit' = 'draft-import'): JewelryCsvIssue[] {
  let rows: string[][];
  try { rows = parseCsv(text); } catch { return [{ handle: '', row: 1, field: 'file', message: 'Malformed CSV: unterminated quote' }]; }
  if (rows.length === 0) return [{ handle: '', row: 1, field: 'file', message: 'CSV is empty' }];
  if (rows.length === 1) return [{ handle: '', row: 1, field: 'file', message: 'CSV has no products' }];
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

  if (mode === 'draft-import') return validateDraftRows(rows, col);

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
  if (issues.length === 0) return 'Jewelry CSV check passed. Draft import is not activation approval; run jewelry:gate on the saved product before activation.\n';
  const lines = ['Jewelry CSV checks failed:', ''];
  for (const issue of issues) {
    const where = issue.handle ? `${issue.handle} (row ${issue.row})` : `row ${issue.row}`;
    lines.push(`- ${where} [${issue.field}]: ${issue.message}`);
  }
  return lines.join('\n') + '\n';
}

/** Structural preflight before any new finished-jewelry CSV upload. */
function validateDraftRows(rows: string[][], col: { handle: number; status: number; published: number; category: number; sku: number; tracker: number; qty: number; policy: number; type: number }): JewelryCsvIssue[] {
  const headers = rows[0]!;
  const issues: JewelryCsvIssue[] = [];
  const add = (handle: string, row: number, field: string, message: string) => issues.push({ handle, row, field, message });
  const required = ['Published', 'Title', 'Body (HTML)', 'SEO Title', 'SEO Description', 'Variant Price', 'Image Src', 'Image Alt Text', 'Option1 Value', 'Tags'];
  for (const field of required) if (headerIndex(headers, field) < 0) add('', 1, field, 'Required for draft import preflight');
  if (issues.length) return issues;
  const groups = new Map<string, Array<{ row: string[]; n: number }>>();
  rows.slice(1).forEach((row, i) => {
    const handle = cell(row, col.handle);
    if (!handle) add('', i + 2, 'Handle', 'Required');
    else groups.set(handle, [...(groups.get(handle) ?? []), { row, n: i + 2 }]);
  });
  const get = (row: string[], name: string) => cell(row, headerIndex(headers, name));
  for (const [handle, entries] of groups) {
    const first = entries[0]!;
    const images = new Set<string>();
    const skus = new Set<string>();
    if (cell(first.row, col.status).toLowerCase() !== 'draft') add(handle, first.n, 'Status', 'New imports must explicitly be draft');
    if (cell(first.row, col.published).toLowerCase() !== 'false') add(handle, first.n, 'Published', 'New imports must explicitly be false');
    for (const { row, n } of entries) {
      const status = cell(row, col.status);
      const published = cell(row, col.published);
      if (status && status.toLowerCase() !== 'draft') add(handle, n, 'Status', 'Every populated status must be draft');
      if (published && published.toLowerCase() !== 'false') add(handle, n, 'Published', 'Every populated Published value must be false');
      if (get(row, 'Tags').split(',').some(t => t.trim().toLowerCase() === 'ebay')) add(handle, n, 'Tags', 'No ebay tag on drafts');
      if (get(row, 'Title')) {
        for (const message of copyIssues(get(row, 'Title'), get(row, 'Body (HTML)'), { title: get(row, 'SEO Title'), description: get(row, 'SEO Description') })) add(handle, n, 'Copy', message);
        if (!cell(row, col.type)) add(handle, n, 'Type', 'Specific product type required');
        if (!isRecognizedJewelryCategory(cell(row, col.category))) add(handle, n, 'Product Category', 'Jewelry category required');
      }
      const isVariant = row === first.row || !!get(row, 'Option1 Value') || !!cell(row, col.sku) || !!get(row, 'Variant Price') || !!cell(row, col.qty) || !!cell(row, col.tracker);
      if (isVariant) {
        const sku = cell(row, col.sku);
        if (!sku || skus.has(sku)) add(handle, n, 'Variant SKU', 'Every variant needs a unique SKU');
        skus.add(sku);
        const price = Number(get(row, 'Variant Price'));
        if (!(Number.isFinite(price) && price > 0)) add(handle, n, 'Variant Price', 'Positive confirmed retail required');
        const qty = Number(cell(row, col.qty));
        if (cell(row, col.tracker).toLowerCase() !== 'shopify' || !Number.isInteger(qty) || qty < 0 || cell(row, col.policy).toLowerCase() !== 'deny') add(handle, n, 'Inventory', 'CSV imports use tracked inventory, nonnegative integer quantity and deny; documented made-to-order is reviewed through the API gate');
      }
      const src = get(row, 'Image Src');
      if (src) {
        images.add(src);
        if (!get(row, 'Image Alt Text')) add(handle, n, 'Image Alt Text', 'Every image needs descriptive alt text');
      }
    }
    if (!get(first.row, 'Title')) add(handle, first.n, 'Title', 'Product row required');
    if (images.size < 3) add(handle, first.n, 'Image Src', 'At least three distinct accurate images required');
  }
  return issues;
}
