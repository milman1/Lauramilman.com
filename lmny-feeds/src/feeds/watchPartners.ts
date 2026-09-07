/**
 * Belgium Dia website partner books. The developer watch API often omits
 * Branch, so numeric Uncle Manny stock (10005, 3124, …) is indistinguishable
 * from Belgium Watch numeric stock. This client reads the public watch table
 * filtered by Branch and returns the stock numbers we are allowed to publish.
 *
 * Does not use BELGIUMDIA_API_KEY and does not count against the developer
 * API's 1-request-per-15-minutes limit.
 */

import { ALLOWED_WATCH_PARTNER_BRANCHES } from '../../config/watchGates.js';

const TOKEN_URL = 'https://belgiumdia.com/get-token';
const WATCH_URL = 'https://brainapis.com/api/belgium-dia/watch';
const UA = 'Mozilla/5.0 (compatible; LMNY-FeedSync/1.0; +https://lauramilman.com)';
const PAGE = 250;

type WatchListResponse = {
  record?: Array<{ Stock?: string | number }>;
  total?: number;
};

async function guestToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    headers: {
      Accept: '*/*',
      'User-Agent': UA,
      'X-Requested-With': 'XMLHttpRequest',
      Referer: 'https://belgiumdia.com/watch',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`watch partner token: HTTP ${res.status}`);
  const token = (await res.text()).trim();
  if (token.length < 20) throw new Error('watch partner token: empty');
  return token;
}

async function fetchBranch(token: string, branch: string): Promise<string[]> {
  const stocks: string[] = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const body = new URLSearchParams({
      stock: '',
      reference: '',
      offset: String(offset),
      limit: String(PAGE),
      branch,
    });
    const res = await fetch(WATCH_URL, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'User-Agent': UA,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: 'https://belgiumdia.com',
        Referer: 'https://belgiumdia.com/watch',
      },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`watch partner ${branch}: HTTP ${res.status}`);
    const json = (await res.json()) as WatchListResponse;
    const rows = json.record ?? [];
    total = typeof json.total === 'number' ? json.total : rows.length;
    for (const row of rows) {
      const stock = row.Stock != null ? String(row.Stock).trim() : '';
      if (stock) stocks.push(stock);
    }
    if (rows.length === 0) break;
    offset += PAGE;
  }
  return stocks;
}

/**
 * Stock numbers from Belgium Watch (ROMAN) + TLV + Vivid.
 * Throws if the list is empty so the caller can fall back to prefix rules
 * rather than publishing zero watches.
 */
export async function fetchAllowedWatchStocks(): Promise<Set<string>> {
  const token = await guestToken();
  const stocks = new Set<string>();
  for (const branch of ALLOWED_WATCH_PARTNER_BRANCHES) {
    for (const stock of await fetchBranch(token, branch)) stocks.add(stock);
  }
  if (stocks.size === 0) {
    throw new Error('watch partner allowlist: 0 stocks');
  }
  return stocks;
}
