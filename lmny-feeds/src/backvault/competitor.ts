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
 *
 * PAGINATION CAP. The retailer caps page-based pagination at 100 pages of
 * 250 — observed 2026-09-11, when page 101 came back HTTP 400 after 100 full
 * pages had been read. So roughly 25,000 products are reachable through this
 * endpoint and a larger catalogue simply cannot be fully read this way: the
 * 400 is the end of the road, not a fault. The walk therefore stops there and
 * returns what it has as a PARTIAL result (see CompetitorCatalog) rather than
 * throwing away 25,000 rows. Closing that gap needs a different source
 * (cursor pagination, a sitemap walk, or a feed the retailer publishes);
 * nothing here attempts one.
 */

import { BACKVAULT } from '../../config/pricing.js';

const PAGE_LIMIT = 250;
const MAX_PAGES = 200;
/**
 * Where the retailer's page-based pagination runs out: page 101 answers 4xx
 * however many products are really in the catalogue (observed 2026-09-11,
 * HTTP 400). Documented here as the reason a 4xx past page 1 is an ending
 * rather than a failure; the code does not hard-code the page number, it
 * reacts to the status it is given.
 */
export const PAGINATION_CAP_PAGES = 100;

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
 * page pacing together. Without it, 4 attempts of up to 30 s plus three 30 s
 * waits is 210 s for a single page, which across MAX_PAGES is a multi-hour run:
 * a sustained throttle would be cancelled by the Actions job timeout with no
 * report at all, which is worse than the 429 this retry exists for.
 *
 * Sized from the COMPETITOR's catalogue, not the supplier's. An independent
 * full scan of the competitor earlier in this project counted roughly 20,000
 * products — about 80 pages at PAGE_LIMIT 250 — and the 2026-09-11 run was
 * still paginating at page 61 when it was throttled, so a healthy walk is on
 * the order of 80 pages, and MAX_PAGES 200 is the ceiling it is allowed to
 * reach. At 200 pages the pacing alone is 50 s and the requests can add
 * minutes on a slow day, so 6 minutes could trip on a perfectly healthy run:
 * 10 minutes keeps that headroom while still cutting a throttled walk short
 * in time to write a report. The 60-minute job timeout is the backstop.
 *
 * To check the real page count against these figures, read the progress line
 * this module logs every PROGRESS_EVERY_PAGES pages in a successful run.
 */
export const FETCH_DEADLINE_MS = 10 * 60_000;
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
  /** Called once per retry actually taken, so the walk can say why it ran out of time. */
  onRetry?: () => void;
}

/** Thrown when the wall-clock budget for the fetch is gone. */
export class CompetitorDeadlineError extends Error {}

/**
 * A page the retailer answered with a non-OK status that was not retried (or
 * was retried to exhaustion). Carries the status so the walk can tell the
 * pagination cap (a 400 past page 1) from a feed that is wrong or gone.
 */
export class CompetitorHttpError extends Error {
  readonly status: number;
  readonly page: number;
  constructor(status: number, page: number) {
    super(`Competitor feed: HTTP ${status} for page ${page}`);
    this.status = status;
    this.page = page;
  }
}

/**
 * Statuses the retailer uses to say "there is no such page", as opposed to
 * "this feed is broken or forbidden". Past page 1 with rows already in hand,
 * one of these is the end of pagination (see PAGINATION_CAP_PAGES). 401, 403,
 * 410 and friends are deliberately NOT here: those mean the feed itself is
 * gone or blocked, and swallowing them would quietly halve the index.
 */
const PAGINATION_CAP_STATUSES: ReadonlySet<number> = new Set([400, 404, 414, 422]);

/** Why the catalog walk stopped. Only 'exhausted' means the whole catalogue was read. */
export type CompetitorStopReason = 'exhausted' | 'pagination-cap' | 'deadline' | 'max-pages';

/**
 * The outcome of one catalog walk. `complete` is true ONLY when the walk ended
 * because a page came back short or empty — i.e. the catalogue ran out. Every
 * other ending leaves rows unread, and callers must treat the index built from
 * `rows` as partial: a piece missing from it may well be priced on a page that
 * was never read, so a missing match is not evidence of no match.
 */
export interface CompetitorCatalog {
  /** Every row read, in page order. Usable as-is; partial when `complete` is false. */
  rows: unknown[];
  complete: boolean;
  pagesRead: number;
  stoppedReason: CompetitorStopReason;
  /** Human-readable reason, set whenever the walk stopped short. For reports. */
  stoppedDetail?: string;
}

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
      // A request the clamped timeout aborted at the end of the budget is a
      // deadline, not a network failure: reported as one, the page and row
      // counts survive instead of a bare 'request failed (…aborted)'.
      if (now() >= deadlineAt) {
        throw new CompetitorDeadlineError(`Competitor feed: fetch deadline passed on page ${page}`);
      }
      if (attempt === MAX_ATTEMPTS - 1) continue;
      const wait = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
      if (now() + wait >= deadlineAt) throw new CompetitorDeadlineError(`Competitor feed: fetch deadline passed on page ${page}`);
      options.onRetry?.();
      await sleep(wait);
      continue;
    }
    if (candidate.ok) {
      res = candidate;
      break;
    }
    if (!isRetryableStatus(candidate.status) || attempt === MAX_ATTEMPTS - 1) {
      await discardBody(candidate);
      throw new CompetitorHttpError(candidate.status, page);
    }
    const wait = retryAfterMs(candidate.headers?.get?.('retry-after') ?? null, attempt, now());
    await discardBody(candidate);
    if (now() + wait >= deadlineAt) throw new CompetitorDeadlineError(`Competitor feed: fetch deadline passed on page ${page}`);
    console.warn(
      `Competitor feed: HTTP ${candidate.status} for page ${page}, retrying in ${Math.round(wait / 100) / 10}s ` +
        `(attempt ${attempt + 2} of ${MAX_ATTEMPTS})`,
    );
    options.onRetry?.();
    await sleep(wait);
  }
  if (!res) throw new Error(`Competitor feed: request failed (${lastErr})`);
  const body = (await res.json()) as { products?: unknown[] };
  if (!Array.isArray(body.products)) throw new Error('Competitor feed: response had no `products` array');
  return body.products;
}

/**
 * Which of the two ways the walk ran out of wall clock: retries mean the
 * competitor was throttling, no retries at all mean nothing went wrong except
 * the clock — the deadline is mis-sized for a catalogue this size.
 */
function deadlineCause(retries: number): string {
  return retries > 0
    ? `after ${retries} retr${retries === 1 ? 'y' : 'ies'} — the competitor was throttling`
    : 'with no retries — the walk was simply too slow, so the deadline is mis-sized';
}

/** The deadline as a thrown error: only used when not one page was read. */
function deadlineMessage(pagesRead: number, rows: number, retries: number): string {
  return (
    `Competitor feed: the ${FETCH_DEADLINE_MS / 60_000}-minute fetch deadline passed after ` +
    `${pagesRead} of up to ${MAX_PAGES} pages (${rows} rows read), ${deadlineCause(retries)}`
  );
}

/** One line for a report or a log: how much was read, and why it stopped there. */
export function describeCompetitorStop(result: CompetitorCatalog): string {
  const scale = `${result.rows.length} rows over ${result.pagesRead} page${result.pagesRead === 1 ? '' : 's'}`;
  if (result.complete) return `${scale} (the whole catalogue)`;
  return `${scale} — ${result.stoppedDetail ?? `stopped early (${result.stoppedReason})`}`;
}

/**
 * Every page of the competitor's public catalog, paced by PAGE_DELAY_MS so the
 * walk does not trip the retailer's rate limit part-way through, and bounded by
 * FETCH_DEADLINE_MS end to end.
 *
 * Rows already read are never thrown away. Once at least one page is in hand,
 * both of the endings that are not the catalogue running out — the retailer's
 * pagination cap (a non-retryable 4xx past page 1, see the file header) and the
 * wall-clock deadline — come back as a PARTIAL result naming how far it got,
 * because 25,000 rows that price most of the run are worth more than nothing.
 *
 * It still throws when there is nothing worth returning or the feed itself is
 * wrong: any failure on page 1, a network failure that never read a page, a
 * blocked or missing feed (403, 401, 410 ...), or a malformed response.
 */
export async function fetchCompetitorCatalog(options: CompetitorFetchOptions = {}): Promise<CompetitorCatalog> {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const deadlineAt = now() + FETCH_DEADLINE_MS;
  const all: unknown[] = [];
  let retries = 0;
  let pagesRead = 0;
  const onRetry = () => {
    retries += 1;
    options.onRetry?.();
  };
  const deadlineDetail = () =>
    `the ${FETCH_DEADLINE_MS / 60_000}-minute fetch deadline passed ${deadlineCause(retries)}`;
  const partial = (stoppedReason: CompetitorStopReason, stoppedDetail: string): CompetitorCatalog => {
    console.warn(
      `Competitor feed: stopping after ${pagesRead} pages (${all.length} rows) — ${stoppedDetail}; ` +
        'using the rows already read as a partial index',
    );
    return { rows: all, complete: false, pagesRead, stoppedReason, stoppedDetail };
  };
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (page > 1) {
      if (now() + PAGE_DELAY_MS >= deadlineAt) {
        if (pagesRead === 0) throw new Error(deadlineMessage(pagesRead, all.length, retries));
        return partial('deadline', deadlineDetail());
      }
      await sleep(PAGE_DELAY_MS);
    }
    let rows: unknown[];
    try {
      rows = await fetchCompetitorPage(page, { ...options, deadlineAt, onRetry });
    } catch (err) {
      // Nothing read yet: there is no partial index to salvage, and a failure
      // on page 1 means the feed is wrong or gone rather than exhausted.
      if (pagesRead === 0) {
        if (err instanceof CompetitorDeadlineError) throw new Error(deadlineMessage(pagesRead, all.length, retries));
        throw err;
      }
      if (err instanceof CompetitorDeadlineError) return partial('deadline', deadlineDetail());
      if (err instanceof CompetitorHttpError && PAGINATION_CAP_STATUSES.has(err.status)) {
        return partial(
          'pagination-cap',
          `page ${err.page} returned HTTP ${err.status}: the retailer caps page-based pagination at ` +
            `${PAGINATION_CAP_PAGES} pages of ${PAGE_LIMIT} (~${PAGINATION_CAP_PAGES * PAGE_LIMIT} products), ` +
            'so the rest of its catalogue cannot be read through this endpoint',
        );
      }
      throw err;
    }
    pagesRead += 1;
    all.push(...rows);
    if (rows.length > 0 && page % PROGRESS_EVERY_PAGES === 0) {
      console.log(`Competitor feed: ${page} pages fetched, ${all.length} rows so far`);
    }
    // A short or empty page is the catalogue running out: the only complete ending.
    if (rows.length < PAGE_LIMIT) {
      return { rows: all, complete: true, pagesRead, stoppedReason: 'exhausted' };
    }
  }
  return partial('max-pages', `the ${MAX_PAGES}-page ceiling was reached with the catalogue still going`);
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
