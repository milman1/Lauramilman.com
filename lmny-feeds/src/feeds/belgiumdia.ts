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
function buildUrl(kind: BelgiumDiaKind, page: number, base = baseUrl()): string {
  const key = requireKey();
  const override = process.env[`BELGIUMDIA_${kind.toUpperCase()}_PATH`];
  const url = new URL(base + (override ?? defaultPath(kind)));
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

const REQUEST_HEADERS = {
  Accept: 'application/json',
  // Some WAFs reject requests without a browser-like UA by resetting the
  // connection (surfaces as a network-level "fetch failed", not an HTTP code).
  'User-Agent': 'Mozilla/5.0 (compatible; LMNY-FeedSync/1.0; +https://lauramilman.com)',
} as const;

/**
 * The cache (BELGIUMDIA_API_URL) is an optimization, not a dependency. When
 * it answers with an error — stale deploy, missing secret, mismatched key —
 * fall through to the supplier directly rather than failing the run. Costs
 * one wasted request against the 1-per-15-minutes limit, which beats a dead
 * sync, and the whole cache layer becomes optional infrastructure.
 */
async function fetchPage(kind: BelgiumDiaKind, page: number): Promise<Raw[]> {
  const usingCache = baseUrl() !== DEFAULT_BASE_URL;
  try {
    return await fetchPageFrom(kind, page, baseUrl());
  } catch (err) {
    if (!usingCache) throw err;
    console.error(
      `Feed cache failed for ${kind} (${err instanceof Error ? err.message : String(err)}) — falling back to the supplier directly`,
    );
    return fetchPageFrom(kind, page, DEFAULT_BASE_URL);
  }
}

async function fetchPageFrom(kind: BelgiumDiaKind, page: number, base: string): Promise<Raw[]> {
  const url = buildUrl(kind, page, base);
  let res: Response | undefined;
  let lastNetErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(url, { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(30_000) });
      break;
    } catch (err) {
      // Surface the underlying cause (DNS/reset/TLS/timeout) without leaking
      // the URL — undici causes carry a host at most, never the key query.
      const cause = (err as { cause?: { code?: string; name?: string; message?: string } }).cause;
      lastNetErr =
        [cause?.code, cause?.name, cause?.message].filter(Boolean).join(': ') ||
        (err instanceof Error ? err.message : String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  if (!res) {
    throw new Error(`Belgium Dia ${kind} feed: request failed (${lastNetErr})`);
  }
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

/**
 * One raw page-1 request, for diagnostics when a feed answers empty: the
 * HTTP status and a body snippet tell apart "rate-limited", "genuinely
 * empty", and "response shape changed" — which all look identical through
 * fetchBelgiumDiaFeed. The key is redacted from the snippet defensively.
 */
export async function probeFeed(kind: BelgiumDiaKind): Promise<{ status: number; snippet: string }> {
  const res = await fetch(buildUrl(kind, 1), { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(30_000) });
  const body = (await res.text()).slice(0, 400).replaceAll(requireKey(), '[key]');
  return { status: res.status, snippet: body };
}
