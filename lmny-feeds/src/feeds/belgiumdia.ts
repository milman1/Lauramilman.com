/**
 * Belgium Dia feed client.
 *
 * Live API shape (belgiumdia.com developer API):
 *   natural: GET /api/developer-api/diamond?type=natural&page=N&key=…
 *   lab:     GET /api/developer-api/diamond?type=lab&page=N&key=…
 *   watch:   GET /api/developer-api/watch?key=…
 *
 * The key is a query parameter (provider's contract). It's read from the
 * env secret (slated for rotation) and never logged — error messages carry
 * the status only, never the URL, so the key can't leak into CI logs.
 *
 * The diamond endpoints are paginated; watch is a single request.
 */

type Raw = Record<string, unknown>;

export type BelgiumDiaKind = 'natural' | 'lab' | 'watch';

const DEFAULT_BASE_URL = 'https://belgiumdia.com';
/** Safety cap so a misbehaving pager can't loop forever (~3,800 naturals). */
const MAX_PAGES = 500;

function baseUrl(): string {
  const url = process.env.BELGIUMDIA_API_URL || DEFAULT_BASE_URL;
  return url.replace(/\/+$/, '');
}

function requireKey(): string {
  const key = process.env.BELGIUMDIA_API_KEY;
  if (!key) throw new Error('BELGIUMDIA_API_KEY is not set');
  return key;
}

/** Build a request URL. Path is env-overridable; the key stays out of logs. */
function buildUrl(kind: BelgiumDiaKind, page: number): string {
  const key = requireKey();
  const override = process.env[`BELGIUMDIA_${kind.toUpperCase()}_PATH`];
  const url = new URL(baseUrl() + (override ?? defaultPath(kind)));
  if (kind !== 'watch') {
    url.searchParams.set('type', kind === 'natural' ? 'natural' : 'lab');
    url.searchParams.set('page', String(page));
  }
  url.searchParams.set('key', key);
  return url.toString();
}

function defaultPath(kind: BelgiumDiaKind): string {
  return kind === 'watch' ? '/api/developer-api/watch' : '/api/developer-api/diamond';
}

/** Depth-first search for the first array of objects in a JSON payload. */
export function extractRows(payload: unknown, depth = 0): Raw[] | null {
  if (depth > 4 || payload === null || typeof payload !== 'object') return null;
  if (Array.isArray(payload)) {
    if (payload.length === 0) return [];
    return payload.every((r) => r !== null && typeof r === 'object') ? (payload as Raw[]) : null;
  }
  const preferred = ['data', 'items', 'results', 'diamonds', 'stones', 'watches', 'products', 'rows'];
  const obj = payload as Raw;
  const keys = [...preferred.filter((k) => k in obj), ...Object.keys(obj).filter((k) => !preferred.includes(k))];
  for (const key of keys) {
    const found = extractRows(obj[key], depth + 1);
    if (found) return found;
  }
  return null;
}

async function fetchPage(kind: BelgiumDiaKind, page: number): Promise<Raw[]> {
  const res = await fetch(buildUrl(kind, page), { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    // Status only — never the URL (it carries the key).
    throw new Error(`Belgium Dia ${kind} feed: HTTP ${res.status}`);
  }
  const rows = extractRows(await res.json());
  if (rows === null) {
    throw new Error(`Belgium Dia ${kind} feed: could not locate a row array in the response shape`);
  }
  return rows;
}

/** Signature of a page used to detect an API that ignores `page` and repeats. */
function pageSignature(rows: Raw[]): string {
  return `${rows.length}:${JSON.stringify(rows[0] ?? null).slice(0, 300)}`;
}

export async function fetchBelgiumDiaFeed(kind: BelgiumDiaKind): Promise<Raw[]> {
  requireKey();

  // Watch: single request, no pagination.
  if (kind === 'watch') {
    return fetchPage('watch', 1);
  }

  // Diamonds: page until an empty page, a repeated page, or the safety cap.
  const all: Raw[] = [];
  let prevSig = '';
  let page = 1;
  for (; page <= MAX_PAGES; page++) {
    const rows = await fetchPage(kind, page);
    if (rows.length === 0) break;
    const sig = pageSignature(rows);
    if (sig === prevSig) break; // provider ignored `page` / returned the same page again
    prevSig = sig;
    all.push(...rows);
  }
  if (page > MAX_PAGES) {
    console.warn(`Belgium Dia ${kind}: hit the ${MAX_PAGES}-page safety cap; feed may be truncated`);
  }
  return all;
}
