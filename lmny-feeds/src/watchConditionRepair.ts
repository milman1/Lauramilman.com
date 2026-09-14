import { ebayConditionForWatch } from './ebayCondition.js';

export type RawWatchRow = Record<string, unknown>;

export interface SourceWatchCondition {
  stockRef: string;
  state: 'preowned' | 'unworn' | null;
  box: boolean | null;
  papers: boolean | null;
}

export interface CatalogWatchCondition {
  productId: string;
  handle: string;
  sku: string;
  ebayCondition: string | null;
  googleCondition: string | null;
}

export interface WatchConditionPlanRow {
  productId: string;
  handle: string;
  sku: string;
  stockRef: string;
  before: { ebayCondition: string | null; googleCondition: string | null };
  after: { ebayCondition: string; googleCondition: 'new' | 'used' };
}

export interface WatchConditionPlanSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  rows: WatchConditionPlanRow[];
}

const ROW_KEYS = ['after', 'before', 'handle', 'productId', 'sku', 'stockRef'];

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

export function validatePlanSnapshot(
  value: unknown,
  now = Date.now(),
  maxAgeMs = 24 * 60 * 60 * 1000,
): WatchConditionPlanSnapshot {
  if (!value || typeof value !== 'object') throw new Error('reviewed plan is not an object');
  const snapshot = value as Record<string, unknown>;
  if (!exactKeys(snapshot, ['generatedAt', 'rows', 'schemaVersion']) || snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.rows)) {
    throw new Error('reviewed plan schema is invalid');
  }
  const generated = Date.parse(String(snapshot.generatedAt));
  if (!Number.isFinite(generated) || generated > now || now - generated > maxAgeMs) throw new Error('reviewed plan is stale or has an invalid timestamp');
  const productIds = new Set<string>();
  const stockRefs = new Set<string>();
  for (const raw of snapshot.rows) {
    if (!raw || typeof raw !== 'object' || !exactKeys(raw as Record<string, unknown>, ROW_KEYS)) throw new Error('reviewed plan row schema is invalid');
    const row = raw as Record<string, unknown>;
    for (const key of ['productId', 'handle', 'stockRef']) {
      if (typeof row[key] !== 'string' || !row[key]) throw new Error(`reviewed plan ${key} is invalid`);
    }
    if (typeof row.sku !== 'string') throw new Error('reviewed plan sku is invalid');
    if (productIds.has(row.productId as string)) throw new Error(`duplicate reviewed productId: ${row.productId}`);
    productIds.add(row.productId as string);
    const stockKey = String(row.stockRef).toUpperCase();
    if (stockRefs.has(stockKey)) throw new Error(`duplicate reviewed stockRef: ${row.stockRef}`);
    stockRefs.add(stockKey);
    if (!row.before || typeof row.before !== 'object' || !exactKeys(row.before as Record<string, unknown>, ['ebayCondition', 'googleCondition'])) throw new Error('reviewed plan before fields are invalid');
    if (!row.after || typeof row.after !== 'object' || !exactKeys(row.after as Record<string, unknown>, ['ebayCondition', 'googleCondition'])) throw new Error('reviewed plan after fields are invalid');
    const before = row.before as Record<string, unknown>;
    const after = row.after as Record<string, unknown>;
    if (![before.ebayCondition, before.googleCondition].every((item) => item === null || typeof item === 'string')) {
      throw new Error('reviewed plan before condition value is invalid');
    }
    if (typeof after.ebayCondition !== 'string' || typeof after.googleCondition !== 'string' ||
        !['1000', '1500', '3000'].includes(after.ebayCondition) || !['new', 'used'].includes(after.googleCondition)) {
      throw new Error('reviewed plan condition value is invalid');
    }
    const identities = catalogStockCandidates(row as unknown as CatalogWatchCondition);
    if (identities.length !== 1 || identities[0] !== String(row.stockRef).toUpperCase()) throw new Error(`reviewed plan stock identity mismatch: ${row.productId}`);
  }
  return value as WatchConditionPlanSnapshot;
}

export function catalogDrift(plan: WatchConditionPlanRow[], current: CatalogWatchCondition[]): string[] {
  const byId = new Map(current.map((row) => [row.productId, row]));
  const errors: string[] = [];
  for (const row of plan) {
    const found = byId.get(row.productId);
    if (!found) { errors.push(`${row.productId}: missing or inactive`); continue; }
    if (found.handle !== row.handle || found.sku !== row.sku) errors.push(`${row.productId}: SKU/handle changed`);
    if (found.ebayCondition !== row.before.ebayCondition || found.googleCondition !== row.before.googleCondition) {
      errors.push(`${row.productId}: condition values changed`);
    }
  }
  return errors;
}

function pick(raw: RawWatchRow, names: string[]): unknown {
  const entries = new Map(Object.entries(raw).map(([key, value]) => [key.toLowerCase(), value]));
  for (const name of names) {
    const value = entries.get(name.toLowerCase());
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

function text(raw: RawWatchRow, names: string[]): string | null {
  const value = pick(raw, names);
  return value === undefined ? null : String(value).trim();
}

function explicitBoolean(raw: RawWatchRow, names: string[]): boolean | null {
  const value = pick(raw, names);
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  const normalized = String(value).trim().toLowerCase();
  if (['yes', 'true', '1', 'y'].includes(normalized)) return true;
  if (['no', 'false', '0', 'n'].includes(normalized)) return false;
  return null;
}

function sourceState(condition: string | null): SourceWatchCondition['state'] {
  const normalized = (condition ?? '').trim().toUpperCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
  if (normalized === 'UNWORN') return 'unworn';
  if (normalized === 'PRE OWNED' || ['MINT', 'EXCELLENT', 'VERY GOOD', 'GOOD', 'FAIR'].includes(normalized)) {
    return 'preowned';
  }
  return null;
}

export function sourceWatchCondition(raw: RawWatchRow): SourceWatchCondition | null {
  const stockRef = text(raw, ['stock_ref', 'stockref', 'stock_no', 'stock_number', 'stock', 'watch_id', 'sku']);
  if (!stockRef) return null;
  return {
    stockRef,
    state: sourceState(text(raw, ['condition', 'condition_grade', 'state'])),
    box: explicitBoolean(raw, ['box', 'has_box', 'with_box', 'original_box']),
    papers: explicitBoolean(raw, ['paper', 'papers', 'has_papers', 'with_papers', 'original_papers', 'card']),
  };
}

export function desiredConditions(source: SourceWatchCondition): {
  ebayCondition: string;
  googleCondition: 'new' | 'used';
} {
  return {
    ebayCondition: ebayConditionForWatch({ state: source.state, box: source.box, papers: source.papers }),
    googleCondition: source.state === 'unworn' ? 'new' : 'used',
  };
}

/** Exact identifiers only: variant SKU, generated w-<stock>, or legacy RW handle. */
export function catalogStockCandidates(row: CatalogWatchCondition): string[] {
  const candidates = new Set<string>();
  if (row.sku.trim()) candidates.add(row.sku.trim().toUpperCase());
  const handle = row.handle.trim().toLowerCase();
  if (/^w-[a-z0-9-]+$/.test(handle)) candidates.add(handle.slice(2).toUpperCase());
  if (/^rw\d+$/.test(handle)) candidates.add(handle.toUpperCase());
  return [...candidates];
}

export function buildWatchConditionPlan(
  sourceRows: SourceWatchCondition[],
  catalogRows: CatalogWatchCondition[],
  allowedStocks: ReadonlySet<string>,
): WatchConditionPlanRow[] {
  const allowedUpper = new Set([...allowedStocks].map((value) => value.trim().toUpperCase()));
  const sourceByStock = new Map<string, SourceWatchCondition>();
  for (const source of sourceRows) {
    const key = source.stockRef.trim().toUpperCase();
    if (!allowedUpper.has(key)) continue;
    if (sourceByStock.has(key)) throw new Error(`duplicate source stockRef: ${key}`);
    sourceByStock.set(key, source);
  }
  if (sourceByStock.size === 0) throw new Error('0 allowed source watch rows');

  const catalogByStock = new Map<string, CatalogWatchCondition>();
  const joined: Array<{ source: SourceWatchCondition; catalog: CatalogWatchCondition }> = [];
  for (const catalog of catalogRows) {
    const identifiers = catalogStockCandidates(catalog);
    if (identifiers.length > 1) throw new Error(`conflicting catalog SKU/handle identifiers for ${catalog.productId}`);
    const uniqueMatches = identifiers.filter((candidate) => sourceByStock.has(candidate));
    if (uniqueMatches.length > 1) throw new Error(`ambiguous catalog identifiers for ${catalog.productId}`);
    if (uniqueMatches.length === 0) continue;
    const stock = uniqueMatches[0]!;
    if (catalogByStock.has(stock)) throw new Error(`duplicate catalog match for stockRef: ${stock}`);
    catalogByStock.set(stock, catalog);
    joined.push({ source: sourceByStock.get(stock)!, catalog });
  }

  return joined
    .map(({ source, catalog }) => {
      const after = desiredConditions(source);
      if (catalog.ebayCondition === after.ebayCondition && catalog.googleCondition === after.googleCondition) return null;
      return {
        productId: catalog.productId,
        handle: catalog.handle,
        sku: catalog.sku,
        stockRef: source.stockRef,
        before: { ebayCondition: catalog.ebayCondition, googleCondition: catalog.googleCondition },
        after,
      } satisfies WatchConditionPlanRow;
    })
    .filter((row): row is WatchConditionPlanRow => row !== null)
    .sort((a, b) => a.stockRef.localeCompare(b.stockRef) || a.productId.localeCompare(b.productId));
}
