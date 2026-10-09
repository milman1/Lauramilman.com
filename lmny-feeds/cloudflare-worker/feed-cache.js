/**
 * LMNY — Belgium Dia feed cache
 * Cloudflare Worker, same deployment style as PD's diamond-proxy.
 *
 * WHY: the Belgium Dia key allows ONE request per 15 minutes. Three feeds
 * fetched seconds apart in one sync run means only the first gets data.
 * This Worker refreshes one feed every 20 minutes on a cron (inside the
 * limit), stores the JSON in KV, and serves the sync from cache — so the
 * hourly sync reads natural, lab AND watch instantly, every run.
 *
 * THE KEY IS SELF-HEALING — there is no secret to keep in sync. The sync
 * already sends the real key on every request (that's how the cache is
 * gated). The first time a key arrives that the Worker doesn't recognize,
 * it proves that key against the supplier and, if it works, stores it in KV
 * and uses it from then on — including for the cron refreshes. A dashboard
 * API_KEY secret is honored if present but is no longer required, and a
 * stale or mistyped one loses to a key that has actually fetched data.
 *
 * DEPLOYMENT STEPS:
 * 1. Deployed by the git-connected Workers Build on push to main
 *    (project "lauramilman-com", config in wrangler.jsonc at the repo root).
 * 2. Storage & Databases → KV namespace LMNY_FEEDS, bound as FEED_CACHE.
 * 3. Cron trigger 7,27,47 * * * *
 *    (:07 natural, :27 lab, :47 watch — 20 minutes apart, limit is 15)
 * 4. In GitHub → Settings → Secrets and variables → Actions → Variables:
 *      BELGIUMDIA_API_URL = https://lauramilman-com.<subdomain>.workers.dev
 *    Nothing else changes — the sync already honors that override and
 *    already sends the key, which this Worker checks before serving.
 *
 * NOTE: the lab feed (~19k rows) is stored gzip-compressed to fit KV's
 * 25 MiB value limit. If the :27 lab refresh ever fails on CPU limits,
 * move the Worker to the $5 paid plan (30s CPU vs 10ms free).
 */

import { collectFeed } from './complete-feed.js';

import { ENGRAVING_ROUTE, handleEngraving } from './engraving-render.js';

const UPSTREAM = 'https://belgiumdia.com';
const FEEDS = ['natural', 'lab', 'watch'];
/** Cron fires at :07 / :27 / :47 — minute picks the feed to refresh. */
const CRON_SLOTS = { 7: 'natural', 27: 'lab', 47: 'watch' };
/** KV key holding the supplier key last proven to work. */
const KEY_KV = 'auth:key';
/** KV marker throttling adoption probes, so junk keys can't burn the limit. */
const PROBE_KV = 'auth:probing';

function upstreamUrl(kind, key, page = 1) {
  const url = new URL(
    UPSTREAM + (kind === 'watch' ? '/api/developer-api/watch' : '/api/developer-api/diamond'),
  );
  if (kind !== 'watch') {
    url.searchParams.set('type', kind);
    url.searchParams.set('page', String(page));
  }
  url.searchParams.set('key', key);
  return url.toString();
}

/**
 * The key this Worker uses upstream. A key proven against the supplier wins
 * over the dashboard secret: the dashboard copy has been entered wrong more
 * than once, and a value that has actually fetched data beats a typed one.
 */
async function activeKey(env) {
  return (await env.FEED_CACHE.get(KEY_KV)) || env.API_KEY || '';
}

/**
 * Classify an upstream body without paying to parse it. The lab feed is
 * large; this is used only to prove a credential, never to decide cache
 * completeness. collectFeed validates every page before caching it.
 *
 * Returns 'data' (cacheable rows), 'limited' (the key was accepted but is
 * early — proof the credential is good), or 'bad'.
 */
function classifyBody(buf) {
  if (buf.byteLength >= 4096) return 'data';
  try {
    const payload = JSON.parse(new TextDecoder().decode(buf));
    const rows = Array.isArray(payload) ? payload : payload && payload.data;
    if (Array.isArray(rows) && rows.length > 0) return 'data';
    return /limit/i.test((payload && payload.message) || '') ? 'limited' : 'bad';
  } catch {
    return 'bad';
  }
}

/** Store a feed body gzipped, streamed through the native codec. */
async function storeFeed(kind, env, buf, rows) {
  const gz = new Blob([buf]).stream().pipeThrough(new CompressionStream('gzip'));
  await env.FEED_CACHE.put(`feed:v2:${kind}`, gz, {
    metadata: { fetchedAt: new Date().toISOString(), bytes: buf.byteLength, complete: true, rows },
  });
}

/**
 * Does this key work against the supplier? Costs one upstream request, so
 * callers must hold the PROBE_KV cooldown first. On success the fetched
 * body only verifies the key; it cannot warm the cache until all pages
 * have been fetched successfully.
 */
async function probeKey(key, env) {
  let res;
  try {
    res = await fetch(upstreamUrl('natural', key), { headers: { Accept: 'application/json' } });
  } catch {
    return false;
  }
  if (!res.ok) return false;
  const buf = await res.arrayBuffer();
  const verdict = classifyBody(buf);
  // A key probe is only page one: never publish it as a complete feed.
  return verdict !== 'bad';
}

/**
 * Fetch every upstream page before replacing the complete snapshot. A
 * failure leaves the previous complete snapshot intact; serving expires
 * it after three hours. Legacy unversioned page-one data is never read.
 */
async function refreshFeed(kind, env, key) {
  if (!key) return false;
  const rows = await collectFeed(kind, page => fetch(upstreamUrl(kind, key, page), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  }));
  const buf = new TextEncoder().encode(JSON.stringify({ data: rows }));
  await storeFeed(kind, env, buf, rows.length);
  return true;
}

export default {
  async scheduled(controller, env, ctx) {
    const minute = new Date(controller.scheduledTime).getUTCMinutes();
    const kind = CRON_SLOTS[minute] ?? FEEDS[minute % FEEDS.length];
    ctx.waitUntil(
      (async () => {
        await refreshFeed(kind, env, await activeKey(env));
      })(),
    );
  },

  async fetch(request, env, ctx) {
    // Storefront engraving render (POST from the product page). Separate from
    // the feed cache below, which stays GET-only and key-gated.
    if (new URL(request.url).pathname === ENGRAVING_ROUTE) return handleEngraving(request, env, ctx);

    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    if (!env.FEED_CACHE) return new Response('Worker misconfigured: FEED_CACHE KV binding not set', { status: 500 });

    const url = new URL(request.url);

    if (url.pathname === '/__version') return new Response('feed-cache-v2-complete-pages\n');

    // Unauthenticated fingerprint of the key actually in use: 12 hex chars of
    // its SHA-256. Safe to expose, and it makes "the two copies of the key
    // disagree" diagnosable without printing any secret anywhere.
    if (url.pathname === '/__keyhash') {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(await activeKey(env)));
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
      return new Response(hex.slice(0, 12) + '\n');
    }

    // The sync sends the real key as ?key= — require it, so the cached feed
    // isn't publicly readable. An unrecognized key isn't rejected outright:
    // it's proven against the supplier once, and adopted if it works. That's
    // what makes the dashboard secret optional — a caller who can already
    // fetch the supplier gains nothing here that they didn't already have.
    const presented = url.searchParams.get('key') || '';
    const stored = await env.FEED_CACHE.get(KEY_KV);
    let authorized = presented !== '' && (presented === stored || presented === env.API_KEY);

    if (!authorized && presented.length >= 20 && !(await env.FEED_CACHE.get(PROBE_KV))) {
      await env.FEED_CACHE.put(PROBE_KV, '1', { expirationTtl: 300 });
      if (await probeKey(presented, env)) {
        await env.FEED_CACHE.put(KEY_KV, presented);
        authorized = true;
      }
    }

    if (!authorized) return new Response('Forbidden', { status: 403 });

    // Auth'd freshness check: /__status
    if (url.pathname === '/__status') {
      const status = {};
      for (const kind of FEEDS) {
        const { metadata } = await env.FEED_CACHE.getWithMetadata(`feed:v2:${kind}`);
        status[kind] = metadata ?? null;
      }
      return new Response(JSON.stringify(status, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Route exactly like the real API, so BELGIUMDIA_API_URL is the only change.
    let kind;
    if (url.pathname === '/api/developer-api/watch') kind = 'watch';
    else if (url.pathname === '/api/developer-api/diamond') {
      kind = url.searchParams.get('type') === 'lab' ? 'lab' : 'natural';
    } else {
      return new Response('Not found', { status: 404 });
    }

    const page = url.searchParams.get('page') ?? '1';
    if (!/^[1-9][0-9]*$/.test(page)) return new Response('Invalid page', { status: 400 });
    let snapshot = await env.FEED_CACHE.getWithMetadata(`feed:v2:${kind}`, { type: 'arrayBuffer' });
    const usable = s => s.value && s.metadata?.complete === true &&
      Date.now() - Date.parse(s.metadata.fetchedAt) < 3 * 60 * 60 * 1000;
    if (!usable(snapshot)) {
      // No legacy page-one cache is ever served. A failed refresh leaves the
      // last complete snapshot intact, but expired snapshots fail closed.
      try { await refreshFeed(kind, env, presented || (await activeKey(env))); }
      catch { return new Response('Complete feed snapshot unavailable', { status: 503 }); }
      snapshot = await env.FEED_CACHE.getWithMetadata(`feed:v2:${kind}`, { type: 'arrayBuffer' });
      if (!usable(snapshot)) return new Response('Complete feed snapshot unavailable', { status: 503 });
    }
    // The cache combines every upstream page into page one. Only a verified
    // complete snapshot is allowed to emit the synthetic page-two terminator.
    if (kind !== 'watch' && page !== '1') {
      return new Response('{"data":[]}', { headers: { 'Content-Type': 'application/json' } });
    }
    return gzipResponse(snapshot.value, snapshot.metadata);
  },
};

function gzipResponse(bytes, metadata) {
  return new Response(bytes, {
    encodeBody: 'manual',
    headers: {
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
      'X-Feed-Fetched-At': (metadata && metadata.fetchedAt) || 'unknown',
      'X-Feed-Cache-Version': '2',
      'X-Feed-Rows': String(metadata?.rows || 0),
      'X-Feed-Bytes': String((metadata && metadata.bytes) || 0),
    },
  });
}
