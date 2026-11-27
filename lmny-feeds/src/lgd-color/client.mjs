/**
 * LGD USA LLC inventory client.
 *
 * The supplier is LGD USA (api.lgdusallc.com), the same feed that already
 * fills the colored loose lab-grown diamonds. Two inventory classes share
 * one endpoint and the Actions secret LGD_API_KEY:
 *
 *   type=certified_color   fancy-color lab diamonds (the live colored feed)
 *   type=certified         white lab diamonds (D–L)
 *
 * The key travels in the query string. Nothing in this file logs a URL,
 * a response body, or a price. A failed fetch throws a fixed sentence.
 *
 * A complete snapshot is required before any Shopify write. Pages are
 * remembered only for the rest of this process, so a retry of a later
 * page does not repeat earlier ones. A snapshot from a previous run is
 * never reused: the supplier being unreachable must not refresh or
 * withdraw live stones.
 */

export const DEFAULT_ENDPOINT = 'https://api.lgdusallc.com/api/v1/inventory/diamond';
export const COLOR_TYPE = 'certified_color';
export const WHITE_TYPE = 'certified';

const TRANSIENT_HTTP = new Set([429, 500, 502, 503, 504]);
const ATTEMPTS = 3;

/** Fixed text only. Never include the request URL: it carries the API key. */
export function supplierFetchError(err) {
  const code = err?.cause?.code || err?.code || '';
  const name = err?.name || err?.cause?.name || '';
  const kind = code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ENODATA' ? 'host does not resolve'
    : code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT' || name === 'TimeoutError' ? 'timed out'
    : code === 'ECONNREFUSED' || code === 'ECONNRESET' ? 'connection failed'
    : 'request failed';
  const error = new Error(`LGD supplier ${kind}; no inventory changes are safe`);
  error.safeToLog = true;
  error.transient = kind !== 'request failed' || code === 'ETIMEDOUT' || name === 'TimeoutError';
  return error;
}

function httpError(status) {
  const error = new Error(`LGD feed HTTP ${status}; no inventory changes are safe`);
  error.safeToLog = true;
  error.transient = TRANSIENT_HTTP.has(status);
  return error;
}

/**
 * Base endpoint, without a query string. LGD_API_BASE replaces the host
 * when the supplier issues a new URL. The default is the endpoint this
 * sync already used.
 */
export function inventoryEndpoint(env = process.env) {
  const raw = String(env.LGD_API_BASE || '').trim();
  const value = raw || DEFAULT_ENDPOINT;
  let url;
  try { url = new URL(value); }
  catch { throw new Error('LGD_API_BASE is not a valid URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('LGD_API_BASE must be an https URL with no query, hash, or credentials');
  }
  return url.origin + url.pathname.replace(/\/$/, '');
}

function unsupportedType(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data.data)) return false;
  const message = String(data.message || data.error || '');
  return /invalid type|unknown type|type not found|no such type/i.test(message);
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(url, fetcher, sleep) {
  let last;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const response = await fetcher(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(60000),
        redirect: 'error',
      });
      if (response.ok || response.status === 404) return response;
      last = httpError(response.status || 0);
      await response.body?.cancel?.();
    } catch (err) {
      last = supplierFetchError(err);
    }
    if (!last.transient || attempt === ATTEMPTS) throw last;
    await sleep(400 * attempt);
  }
  throw last;
}

/**
 * One inventory class, every page, or a throw.
 * `optional` turns HTTP 404 and an "unknown type" body into
 * `{ unsupported: true }` so a missing white feed cannot block color.
 * `allowEmpty` accepts a real zero-row snapshot (white only).
 */
export async function fetchInventoryType(key, type, options = {}) {
  if (!key) throw new Error('LGD_API_KEY is not set');
  const fetcher = options.fetcher || fetch;
  const sleep = options.sleep || defaultSleep;
  const optional = options.optional === true;
  const allowEmpty = options.allowEmpty === true;
  const root = options.endpoint || inventoryEndpoint(options.env);
  const log = options.log || ((entry) => console.log(JSON.stringify(entry)));
  const rows = [];
  let totalPages;
  let totalResults;
  for (let page = 1; page <= 100; page++) {
    const url = new URL(root);
    url.search = new URLSearchParams({ type, page: String(page), key }).toString();
    const response = await fetchPage(url, fetcher, sleep);
    if (optional && response.status === 404) {
      await response.body?.cancel?.();
      log({ stage: 'lgd_fetch', inventory: type, result: 'unsupported' });
      return { rows: [], unsupported: true };
    }
    if (!response.ok) throw httpError(response.status || 0);
    let data;
    try { data = await response.json(); }
    catch { throw new Error('LGD returned invalid JSON'); }
    if (optional && unsupportedType(data)) {
      log({ stage: 'lgd_fetch', inventory: type, result: 'unsupported' });
      return { rows: [], unsupported: true };
    }
    if (allowEmpty && page === 1 && Number(data.total_results) === 0 && Array.isArray(data.data) && data.data.length === 0) {
      log({ stage: 'lgd_fetch', inventory: type, pages: 0, rows: 0 });
      return { rows: [] };
    }
    if (!Array.isArray(data.data) || Number(data.page_no) !== page || !Number.isInteger(Number(data.total_page)) || Number(data.total_page) < 1 || Number(data.total_page) > 100 || !Number.isInteger(Number(data.total_results)) || Number(data.total_results) <= 0) {
      throw new Error('Invalid or empty feed snapshot');
    }
    if (page === 1) { totalPages = Number(data.total_page); totalResults = Number(data.total_results); }
    if (Number(data.total_page) !== totalPages || Number(data.total_results) !== totalResults || !data.data.length) {
      throw new Error('Feed snapshot changed during pagination');
    }
    rows.push(...data.data);
    if (page === totalPages) {
      if (rows.length !== totalResults) throw new Error('Incomplete feed snapshot');
      log({ stage: 'lgd_fetch', inventory: type, pages: totalPages, rows: rows.length });
      return { rows };
    }
  }
  throw new Error('Feed page limit exceeded');
}

/**
 * Colored inventory is required. White inventory is included when the
 * supplier returns a complete snapshot, and skipped when that class is
 * not on this account. A network failure fails the whole call: there is
 * one host, and a partial read must not change the store.
 */
function colorRows(color) {
  const rows = color.rows.map((row) => ({ ...row, _lgdType: COLOR_TYPE }));
  rows.manageWhite = false;
  return rows;
}

/**
 * Colored inventory is required. White inventory is included when that
 * class returns a complete snapshot. A missing or unreadable white class
 * is logged and skipped: it must not block the colored stones already on
 * the site, and it must not withdraw white products either.
 * A network failure on the colored class still fails the whole call.
 */
export async function fetchSupplierInventory(key, options = {}) {
  const color = await fetchInventoryType(key, COLOR_TYPE, options);
  const log = options.log || ((entry) => console.log(JSON.stringify(entry)));
  try {
    const white = await fetchInventoryType(key, WHITE_TYPE, { ...options, optional: true, allowEmpty: true });
    if (white.unsupported) return colorRows(color);
    const rows = [
      ...color.rows.map((row) => ({ ...row, _lgdType: COLOR_TYPE })),
      ...white.rows.map((row) => ({ ...row, _lgdType: WHITE_TYPE })),
    ];
    rows.manageWhite = true;
    return rows;
  } catch (err) {
    log({ stage: 'lgd_fetch', inventory: WHITE_TYPE, result: 'skipped', ...(err?.safeToLog ? { reason: err.message } : {}) });
    return colorRows(color);
  }
}
