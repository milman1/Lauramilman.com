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
 * DEPLOYMENT STEPS:
 * 1. https://dash.cloudflare.com → Workers & Pages → Create → Create Worker
 * 2. Name it: lmny-feed-cache → paste this file → Save and Deploy
 * 3. Settings → Variables and Secrets → Add → type "Secret":
 *      name API_KEY, value = the Belgium Dia API key
 * 4. Storage & Databases → KV → Create namespace: LMNY_FEEDS
 *    Then Worker → Settings → Bindings → Add → KV namespace:
 *      variable name FEED_CACHE → select LMNY_FEEDS
 * 5. Worker → Settings → Triggers → Cron Triggers → Add:
 *      7,27,47 * * * *
 *    (:07 natural, :27 lab, :47 watch — 20 minutes apart, limit is 15)
 * 6. In GitHub → Settings → Secrets and variables → Actions → Variables →
 *    New repository variable:
 *      BELGIUMDIA_API_URL = https://lmny-feed-cache.<subdomain>.workers.dev
 *    Nothing else changes — the sync already honors that override and
 *    already sends the key, which this Worker checks before serving.
 *
 * NOTE: the lab feed (~19k rows) is stored gzip-compressed to fit KV's
 * 25 MiB value limit. If the :27 lab refresh ever fails on CPU limits,
 * move the Worker to the $5 paid plan (30s CPU vs 10ms free).
 */

const UPSTREAM = 'https://belgiumdia.com';
const FEEDS = ['natural', 'lab', 'watch'];
/** Cron fires at :07 / :27 / :47 — minute picks the feed to refresh. */
const CRON_SLOTS = { 7: 'natural', 27: 'lab', 47: 'watch' };

function upstreamUrl(kind, key) {
  const url = new URL(
    UPSTREAM + (kind === 'watch' ? '/api/developer-api/watch' : '/api/developer-api/diamond'),
  );
  if (kind !== 'watch') {
    url.searchParams.set('type', kind);
    url.searchParams.set('page', '1');
  }
  url.searchParams.set('key', key);
  return url.toString();
}

/** Rows out of the API's {"data":[...]} envelope (or a bare array). */
function rowCount(payload) {
  const rows = Array.isArray(payload) ? payload : payload && payload.data;
  return Array.isArray(rows) ? rows.length : 0;
}

async function gzipBytes(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * One upstream fetch. Returns true if the cache was refreshed; false when
 * the API answered empty (rate-limited or down) — the old cache is kept,
 * which is the whole point: stale beats empty.
 */
async function refreshFeed(kind, env) {
  const res = await fetch(upstreamUrl(kind, env.API_KEY), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return false;
  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return false;
  }
  const rows = rowCount(payload);
  if (rows === 0) return false; // limiter's empty answer — keep what we have
  const bytes = await gzipBytes(text);
  await env.FEED_CACHE.put(`feed:${kind}`, bytes, {
    metadata: { fetchedAt: new Date().toISOString(), rows },
  });
  return true;
}

export default {
  async scheduled(controller, env, ctx) {
    const minute = new Date(controller.scheduledTime).getUTCMinutes();
    const kind = CRON_SLOTS[minute] ?? FEEDS[minute % FEEDS.length];
    ctx.waitUntil(refreshFeed(kind, env));
  },

  async fetch(request, env, ctx) {
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    if (!env.API_KEY) return new Response('Worker misconfigured: API_KEY secret not set', { status: 500 });
    if (!env.FEED_CACHE) return new Response('Worker misconfigured: FEED_CACHE KV binding not set', { status: 500 });

    const url = new URL(request.url);

    // The sync sends the real key as ?key= — require it, so the cached feed
    // isn't publicly readable.
    if (url.searchParams.get('key') !== env.API_KEY) {
      return new Response('Forbidden', { status: 403 });
    }

    // Auth'd freshness check: /__status
    if (url.pathname === '/__status') {
      const status = {};
      for (const kind of FEEDS) {
        const { metadata } = await env.FEED_CACHE.getWithMetadata(`feed:${kind}`);
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

    // The feeds are single-page (the API ignores `page`); answer the sync's
    // page-2 terminator request from here instead of spending upstream calls.
    const page = url.searchParams.get('page') ?? '1';
    if (kind !== 'watch' && page !== '1') {
      return new Response('{"data":[]}', { headers: { 'Content-Type': 'application/json' } });
    }

    const { value, metadata } = await env.FEED_CACHE.getWithMetadata(`feed:${kind}`, { type: 'arrayBuffer' });

    if (!value) {
      // Cold start: try upstream once, then serve whatever landed.
      await refreshFeed(kind, env);
      const retry = await env.FEED_CACHE.getWithMetadata(`feed:${kind}`, { type: 'arrayBuffer' });
      if (!retry.value) {
        // Upstream is limited and there's no cache yet. The sync's 0-row
        // outage guard treats this correctly (no archives).
        return new Response('{"data":[]}', { headers: { 'Content-Type': 'application/json' } });
      }
      return gzipResponse(retry.value, retry.metadata);
    }

    return gzipResponse(value, metadata);
  },
};

function gzipResponse(bytes, metadata) {
  return new Response(bytes, {
    encodeBody: 'manual',
    headers: {
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
      'X-Feed-Fetched-At': (metadata && metadata.fetchedAt) || 'unknown',
      'X-Feed-Rows': String((metadata && metadata.rows) || 0),
    },
  });
}
