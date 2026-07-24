/**
 * Belgium Dia feed client.
 *
 * The API key is secret-only (slated for rotation): it is sent via headers,
 * never query strings, and never logged.
 *
 * Endpoint paths are env-overridable because the original adapter was lost;
 * the dry-run against the live API is the contract test.
 */

type Raw = Record<string, unknown>;

const DEFAULT_PATHS = {
  natural: '/api/diamonds?type=natural',
  lab: '/api/diamonds?type=labgrown',
  watch: '/api/watches',
} as const;

export type BelgiumDiaKind = keyof typeof DEFAULT_PATHS;

const DEFAULT_BASE_URL = 'https://api.belgiumdia.com';

function baseUrl(): string {
  const url = process.env.BELGIUMDIA_API_URL ?? DEFAULT_BASE_URL;
  return url.replace(/\/+$/, '');
}

function pathFor(kind: BelgiumDiaKind): string {
  const override = process.env[`BELGIUMDIA_${kind.toUpperCase()}_PATH`];
  return override ?? DEFAULT_PATHS[kind];
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

export async function fetchBelgiumDiaFeed(kind: BelgiumDiaKind): Promise<Raw[]> {
  const key = process.env.BELGIUMDIA_API_KEY;
  if (!key) throw new Error('BELGIUMDIA_API_KEY is not set');
  const url = `${baseUrl()}${pathFor(kind)}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${key}`,
      'X-Api-Key': key,
    },
  });
  if (!res.ok) {
    throw new Error(`Belgium Dia ${kind} feed: HTTP ${res.status}`);
  }
  const payload = await res.json();
  const rows = extractRows(payload);
  if (rows === null) {
    throw new Error(`Belgium Dia ${kind} feed: could not locate a row array in the response shape`);
  }
  return rows;
}
