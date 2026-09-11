/**
 * Competitor price lookup for Back Vault pieces.
 *
 * Robinson's Jewelers (robinsonsjewelers.com) stocks the same estate pieces
 * from the same supplier, under its own SKUs. The supplier's stock number
 * (J10605, RR9688, ...) survives in the retailer's titles, handles, image
 * file names, or body copy, so that token is the match key. Anything that
 * cannot be matched by stock number is treated as unmatched; there is no
 * fuzzy title matching here on purpose, because a wrong match sets a wrong
 * public price.
 *
 * Read from the retailer's public Shopify /products.json, same as the
 * supplier feed. No API key. The sandbox that wrote this cannot reach the
 * host; GitHub Actions can.
 */

import { BACKVAULT } from '../../config/pricing.js';

const PAGE_LIMIT = 250;
const MAX_PAGES = 200;

/** Attempts per page: the first try plus three retries on 429/5xx or a network throw. */
const MAX_ATTEMPTS = 4;
/** Backoff between attempts: 1s, 2s, 4s, each capped by MAX_BACKOFF_MS. */
const BASE_BACKOFF_MS = 1_000;
/** No single wait is longer than this, even if `Retry-After` asks for more. */
const MAX_BACKOFF_MS = 30_000;
/**
 * A `Retry-After` shorter than this is ignored in favour of the exponential
 * backoff: a server that just answered 429 must not be hit again in
 * milliseconds, which is what a 0 ms wait would do four times over.
 */
const MIN_RETRY_AFTER_MS = 1_000;
/** Per-request timeout, also clamped so no request can outlive the deadline. */
const REQUEST_TIMEOUT_MS = 30_000;
/**
 * Wall-clock budget for the WHOLE competitor fetch — requests, retry waits and
 * page pacing together. 4 attempts x 30 s plus three 30 s waits is 210 s per
 * page, which across 200 pages is a multi-hour run: a sustained throttle would
 * be cancelled by the Actions job timeout with no report at all, which is worse
 * than the 429 this retry exists for. Six minutes is ~15x the ~25 s a healthy
 * full walk takes (14 pages at 250 ms pacing), so only a genuinely broken
 * competitor hits it, and hitting it still leaves time for the rest of the run.
 */
export const FETCH_DEADLINE_MS = 6 * 60_000;
/**
 * Pause between page requests. The 2026-09-11 weekly dry run walked all 200
 * pages back to back and the retailer rate-limited it with HTTP 429 at page
 * 61, which failed the whole competitor fetch. 250 ms costs ~50 s across a
 * full catalog walk and keeps the request rate under Shopify's public
 * /products.json throttle.
 */
export const PAGE_DELAY_MS = 250;
/** Log a progress line every N pages, so a future failure shows how far it got. */
const PROGRESS_EVERY_PAGES = 25;

const REQUEST_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; LMNY-FeedSync/1.0; +https://lauramilman.com)',
} as const;

/** Supplier stock numbers: 1-3 letters then 3-6 digits, e.g. J10605, RR9688, RR2954. */
const STOCK_REF = /\b([A-Z]{1,3}\d{3,6})\b/gi;

export interface CompetitorRow {
  handle?: string;
  title?: string;
  body_html?: string;
  variants?: Array<{ sku?: string | null; price?: string; available?: boolean }>;
  images?: Array<{ src?: string }>;
}

/** stock ref (upper-case) -> lowest available price on the competitor. */
export type CompetitorIndex = Map<string, number>;

export interface CompetitorFetchOptions {
  /** Injected by tests so retry backoff and page pacing don't really wait. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected clock, so the deadline can be tested without real time. */
  now?: () => number;
  /**
   * Absolute deadline on the `now()` clock. Set by fetchCompetitorCatalog so
   * every page of one walk shares a single budget; a bare fetchCompetitorPage
   * call gets its own.
   */
  deadlineAt?: number;
}

/** Thrown when the wall-clock budget for the fetch is gone. */
export class CompetitorDeadlineError extends Error {}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function baseUrl(): string {
  return (process.env.COMPETITOR_BASE_URL || BACKVAULT.competitor.baseUrl).replace(/\/+$/, '');
}

/** 429 and 5xx are transient; a 404 or any other 4xx is not and fails immediately. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** RFC 9110 IMF-fixdate, the only date form `Retry-After` is allowed to use. */
const HTTP_DATE = /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/;

/**
 * How long to wait after a throttled response. `Retry-After` is read
 * STRICTLY: all-digit seconds, or an IMF-fixdate. V8's `Date.parse` is
 * lenient enough to turn '-5' and '1,5' into a date in 2001, which used to
 * come back as a 0 ms wait and burn all four attempts in milliseconds
 * against a server that had just said 429. Anything else — a malformed value,
 * a whitespace-only header, a date in the past, or any wait under
 * MIN_RETRY_AFTER_MS — falls back to exponential backoff. Always capped at
 * MAX_BACKOFF_MS.
 */
export function retryAfterMs(header: string | null, attempt: number, now = Date.now()): number {
  const backoff = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  if (!header) return backoff;
  const raw = header.trim();
  let wait: number | null = null;
  if (/^\d+$/.test(raw)) wait = Number(raw) * 1000;
  else if (HTTP_DATE.test(raw)) {
    const at = Date.parse(raw);
    if (Number.isFinite(at)) wait = at - now;
  }
  if (wait === null || wait < MIN_RETRY_AFTER_MS) return backoff;
  return Math.min(wait, MAX_BACKOFF_MS);
}

/**
 * Release the socket for a response we are about to discard. Without this a
 * retried page leaves its unread body holding the connection open.
 */
async function discardBody(res: Response): Promise<void> {
  try {
    if (res.body && typeof res.body.cancel === 'function') await res.body.cancel();
    else if (typeof res.text === 'function') await res.text();
  } catch {
    // Nothing to drain, or the peer already closed it.
  }
}

/**
 * One page of the competitor's catalog, retried on a network throw and on a
 * throttled/5xx response (up to MAX_ATTEMPTS). A 404 or other 4xx is a single
 * immediate failure: retrying a permanent status just delays the report.
 */
export async function fetchCompetitorPage(page: number, options: CompetitorFetchOptions = {}): Promise<unknown[]> {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const deadlineAt = options.deadlineAt ?? now() + FETCH_DEADLINE_MS;
  const url = `${baseUrl()}/products.json?limit=${PAGE_LIMIT}&page=${page}`;
  let res: Response | undefined;
  let lastErr = '';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const remaining = deadlineAt - now();
    if (remaining <= 0) throw new CompetitorDeadlineError(`Competitor feed: fetch deadline passed on page ${page}`);
    let candidate: Response | undefined;
    try {
      candidate = await fetch(url, {
        headers: REQUEST_HEADERS,
        // Clamped to what is left of the budget: one hung request must not
        // outlive the deadline the whole walk shares.
        signal: AbortSignal.timeout(Math.max(1, Math.min(REQUEST_TIMEOUT_MS, remaining))),
      });
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_ATTEMPTS - 1) continue;
      const wait = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
      if (now() + wait >= deadlineAt) throw new CompetitorDeadlineError(`Competitor feed: fetch deadline passed on page ${page}`);
      await sleep(wait);
      continue;
    }
    if (candidate.ok) {
      res = candidate;
      break;
    }
    if (!isRetryableStatus(candidate.status) || attempt === MAX_ATTEMPTS - 1) {
      await discardBody(candidate);
      throw new Error(`Competitor feed: HTTP ${candidate.status} for page ${page}`);
    }
    const wait = retryAfterMs(candidate.headers?.get?.('retry-after') ?? null, attempt, now());
    await discardBody(candidate);
    if (now() + wait >= deadlineAt) throw new CompetitorDeadlineError(`Competitor feed: fetch deadline passed on page ${page}`);
    console.warn(
      `Competitor feed: HTTP ${candidate.status} for page ${page}, retrying in ${Math.round(wait / 100) / 10}s ` +
        `(attempt ${attempt + 2} of ${MAX_ATTEMPTS})`,
    );
    await sleep(wait);
  }
  if (!res) throw new Error(`Competitor feed: request failed (${lastErr})`);
  const body = (await res.json()) as { products?: unknown[] };
  if (!Array.isArray(body.products)) throw new Error('Competitor feed: response had no `products` array');
  return body.products;
}

/** One message for every way the walk can run out of wall clock. */
function deadlineMessage(pagesRead: number, rows: number): string {
  return (
    `Competitor feed: the ${FETCH_DEADLINE_MS / 60_000}-minute fetch deadline passed after ` +
    `${pagesRead} of up to ${MAX_PAGES} pages (${rows} rows read)`
  );
}

/**
 * Every page of the competitor's public catalog, paced by PAGE_DELAY_MS so the
 * walk does not trip the retailer's rate limit part-way through, and bounded by
 * FETCH_DEADLINE_MS end to end. Running out of budget throws, naming how far it
 * got, so the caller's catch turns it into the warning path and the run still
 * reaches its report — the opposite of a cancelled multi-hour job.
 */
export async function fetchCompetitorCatalog(options: CompetitorFetchOptions = {}): Promise<unknown[]> {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const deadlineAt = now() + FETCH_DEADLINE_MS;
  const all: unknown[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (page > 1) {
      if (now() + PAGE_DELAY_MS >= deadlineAt) throw new Error(deadlineMessage(page - 1, all.length));
      await sleep(PAGE_DELAY_MS);
    }
    let rows: unknown[];
    try {
      rows = await fetchCompetitorPage(page, { ...options, deadlineAt });
    } catch (err) {
      if (err instanceof CompetitorDeadlineError) throw new Error(deadlineMessage(page - 1, all.length));
      throw err;
    }
    if (rows.length === 0) break;
    all.push(...rows);
    if (page % PROGRESS_EVERY_PAGES === 0) {
      console.log(`Competitor feed: ${page} pages fetched, ${all.length} rows so far`);
    }
    if (rows.length < PAGE_LIMIT) break;
  }
  return all;
}

/** Stock-number tokens found anywhere on a competitor row. */
export function stockRefsIn(row: CompetitorRow): Set<string> {
  const refs = new Set<string>();
  const texts: string[] = [row.title ?? '', row.handle ?? '', row.body_html ?? ''];
  for (const v of row.variants ?? []) if (v.sku) texts.push(v.sku);
  for (const img of row.images ?? []) {
    if (!img.src) continue;
    const file = img.src.split('?')[0]!.split('/').pop() ?? '';
    texts.push(file.replace(/[._-]/g, ' '));
  }
  for (const text of texts) {
    for (const m of text.matchAll(STOCK_REF)) refs.add(m[1]!.toUpperCase());
  }
  return refs;
}

function lowestAvailablePrice(row: CompetitorRow): number | null {
  let best: number | null = null;
  for (const v of row.variants ?? []) {
    if (v.available === false) continue;
    const p = Number(v.price);
    if (!Number.isFinite(p) || p <= 0) continue;
    if (best === null || p < best) best = p;
  }
  return best;
}

/**
 * Build the stock-ref -> price index. A ref that appears on more than one
 * competitor row with different prices is ambiguous and dropped: a wrong
 * public price is worse than a missing match.
 */
export function indexCompetitor(rows: unknown[]): CompetitorIndex {
  const index: CompetitorIndex = new Map();
  const ambiguous = new Set<string>();
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as CompetitorRow;
    const price = lowestAvailablePrice(row);
    if (price === null) continue;
    for (const ref of stockRefsIn(row)) {
      const seen = index.get(ref);
      if (seen !== undefined && Math.abs(seen - price) > 0.005) ambiguous.add(ref);
      else index.set(ref, price);
    }
  }
  for (const ref of ambiguous) index.delete(ref);
  return index;
}

/** The supplier stock number for one of our items: the SKU, else the handle's last token. */
export function stockRefFor(item: { sku?: string; sourceHandle: string }): string | null {
  const fromSku = item.sku?.trim().toUpperCase();
  if (fromSku && /^[A-Z]{1,3}\d{3,6}$/.test(fromSku)) return fromSku;
  const tail = item.sourceHandle.split('-').pop()?.toUpperCase() ?? '';
  return /^[A-Z]{1,3}\d{3,6}$/.test(tail) ? tail : null;
}

export function competitorPriceFor(item: { sku?: string; sourceHandle: string }, index: CompetitorIndex): number | null {
  const ref = stockRefFor(item);
  if (!ref) return null;
  return index.get(ref) ?? null;
}
