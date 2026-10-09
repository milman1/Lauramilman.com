import { FEED_FETCH_ORDER } from './feeds-config.js';
import type { Kind } from './types.js';

/**
 * Belgium Dia allows about one developer-API request per 15 minutes when the
 * sync calls belgiumdia.com directly. A later feed in the same run then
 * answers HTTP 200 with an empty list. Waiting out that window and retrying
 * once is what lets lab prices land without the Cloudflare feed cache.
 */
export const EMPTY_FEED_RETRY_MS = 15 * 60 * 1000;

export const EMPTY_FEED_ERROR =
  'returned 0 rows (likely rate-limit/outage) — segment protected, not archived';

export function emptyFeedRetryDelayMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.BELGIUMDIA_EMPTY_RETRY_MS;
  if (raw === undefined || raw.trim() === '') return EMPTY_FEED_RETRY_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return EMPTY_FEED_RETRY_MS;
  return n;
}

export function feedsNeedingRetry(
  feeds: Record<Kind, { fetchError?: string; skipped?: boolean }>,
): Kind[] {
  return FEED_FETCH_ORDER.filter(
    (kind) => !feeds[kind].skipped && (feeds[kind].fetchError ?? '').startsWith('returned 0 rows'),
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
