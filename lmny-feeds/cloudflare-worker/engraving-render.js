/**
 * LMNY — AI engraving render for the engagement-ring product page.
 *
 * POST /engraving/render  { image, text, font, metal }
 *   → image/webp: a photoreal visualization of the shopper's inscription
 *     inside the band of the ring in `image` (the product photo).
 *
 * The storefront always shows an instant, exact preview drawn in the
 * browser; this render is the optional "see it on your ring" step. The
 * order is engraved from the text the shopper typed, never from the image.
 *
 * SETUP (Cloudflare dashboard → Workers → lauramilman-com → Settings):
 *   Secret  OPENAI_API_KEY            required; without it the route answers 503
 *   Var     ENGRAVING_IMAGE_MODEL     default gpt-image-1
 *   Var     ENGRAVING_ALLOWED_ORIGINS comma list; default the two lauramilman.com hosts
 *   Var     ENGRAVING_DAILY_CAP       renders per UTC day, store-wide; default 150
 *   Var     ENGRAVING_PER_IP_HOURLY   renders per visitor per hour; default 6
 * Then paste https://lauramilman-com.<subdomain>.workers.dev/engraving/render
 * into the theme editor: Product page → "AI engraving render endpoint".
 *
 * Spend is bounded by the two caps. Repeat requests for the same ring, text,
 * font, and metal are served from KV for 7 days and cost nothing.
 */

export const ENGRAVING_ROUTE = '/engraving/render';
export const MAX_ENGRAVING_CHARS = 30;
export const FONTS = {
  Script: 'flowing hand-script (copperplate) lettering',
  Classic: 'classic engraved serif (Roman) lettering',
  Block: 'clean block capital lettering with wide letter spacing',
};
export const METALS = {
  yellow: '14K/18K yellow gold',
  white: 'rhodium-plated white gold',
  rose: 'rose gold',
  platinum: 'platinum',
};

const DEFAULT_ORIGINS = ['https://lauramilman.com', 'https://www.lauramilman.com'];
const DEFAULT_MODEL = 'gpt-image-1';
const CACHE_TTL = 7 * 24 * 3600;
// Letters (any script), digits, and the punctuation people put inside rings.
const ALLOWED_TEXT = /^[\p{L}\p{N} .,'&+\-:/#♥∞]+$/u;

export function allowedOrigins(env) {
  const raw = (env && env.ENGRAVING_ALLOWED_ORIGINS) || '';
  const list = raw.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
  return list.length ? list : DEFAULT_ORIGINS;
}

export function corsHeaders(origin, env) {
  const headers = { Vary: 'Origin' };
  if (origin && allowedOrigins(env).includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

/**
 * Only product photos served by Shopify are rendered: cdn.shopify.com, or the
 * store's own /cdn/shop/ path on an allowed origin. Anything else is refused
 * so the endpoint cannot be pointed at arbitrary images.
 */
export function normalizeImageUrl(raw, env) {
  if (typeof raw !== 'string' || raw.length > 1000) return null;
  let url;
  try {
    url = new URL(raw.startsWith('//') ? `https:${raw}` : raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const storeHosts = allowedOrigins(env).map((o) => {
    try {
      return new URL(o).host;
    } catch {
      return '';
    }
  });
  const shopifyCdn = url.host === 'cdn.shopify.com' && url.pathname.startsWith('/s/files/');
  const storeCdn = storeHosts.includes(url.host) && url.pathname.startsWith('/cdn/shop/');
  if (!shopifyCdn && !storeCdn) return null;
  url.hash = '';
  return url.toString();
}

export function normalizeEngravingText(raw) {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Returns { ok: true, value } or { ok: false, error } — never throws. */
export function validateEngravingRequest(body, env) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad_request' };
  const text = normalizeEngravingText(body.text);
  if (!text) return { ok: false, error: 'text_required' };
  if ([...text].length > MAX_ENGRAVING_CHARS) return { ok: false, error: 'text_too_long' };
  if (!ALLOWED_TEXT.test(text)) return { ok: false, error: 'text_characters' };
  const font = Object.prototype.hasOwnProperty.call(FONTS, body.font) ? body.font : 'Script';
  const metal = Object.prototype.hasOwnProperty.call(METALS, body.metal) ? body.metal : 'yellow';
  const image = normalizeImageUrl(body.image, env);
  if (!image) return { ok: false, error: 'image_not_allowed' };
  return { ok: true, value: { text, font, metal, image } };
}

export function buildEngravingPrompt({ text, font, metal }) {
  const spelled = [...text].map((c) => (c === ' ' ? '(space)' : c)).join(' ');
  return [
    'Photorealistic jewelry macro photograph of this exact ring, tilted so the inside of the band is clearly visible.',
    `The inner surface of the band carries a finely laser-engraved inscription that reads exactly: "${text}".`,
    `Spelled character by character: ${spelled}. Reproduce it exactly, with no extra, missing, or changed characters, and no other text anywhere in the image.`,
    `Lettering style: ${FONTS[font]}, cut shallow into polished ${METALS[metal]}, catching the light.`,
    'Keep the ring design, setting, center stone, and metal color identical to the reference photo; nothing added or changed from the reference piece except the inscription.',
    'Soft studio lighting on a warm cream background, no hands, no props, no watermark.',
  ].join(' ');
}

export async function cacheKey({ text, font, metal, image }) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify([image, text, font, metal])),
  );
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `engrave:img:${hex}`;
}

function json(status, payload, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function positiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function bump(kv, key, ttl) {
  const next = positiveInt(await kv.get(key), 0) + 1;
  await kv.put(key, String(next), { expirationTtl: ttl });
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function renderWithModel(value, env, fetchImpl) {
  const photo = await fetchImpl(value.image);
  if (!photo.ok) throw new Error(`product image ${photo.status}`);
  const type = (photo.headers.get('Content-Type') || 'image/jpeg').split(';')[0];
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  const form = new FormData();
  form.append('model', env.ENGRAVING_IMAGE_MODEL || DEFAULT_MODEL);
  form.append('image', new Blob([await photo.arrayBuffer()], { type }), `ring.${ext}`);
  form.append('prompt', buildEngravingPrompt(value));
  form.append('size', '1024x1024');
  form.append('quality', 'medium');
  form.append('output_format', 'webp');
  form.append('output_compression', '80');
  form.append('n', '1');
  const res = await fetchImpl('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
  if (!res.ok || !b64) {
    throw new Error(`image model ${res.status}: ${(data && data.error && data.error.message) || 'no image'}`);
  }
  return base64ToBytes(b64);
}

export async function handleEngraving(request, env, ctx, fetchImpl = fetch) {
  const origin = request.headers.get('Origin') || '';
  const cors = corsHeaders(origin, env);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, cors);
  if (!cors['Access-Control-Allow-Origin']) return json(403, { error: 'origin_not_allowed' }, cors);
  if (!env.OPENAI_API_KEY) return json(503, { error: 'not_configured' }, cors);
  if (!env.FEED_CACHE) return json(500, { error: 'kv_missing' }, cors);

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'bad_request' }, cors);
  }
  const checked = validateEngravingRequest(body, env);
  if (!checked.ok) return json(400, { error: checked.error }, cors);
  const value = checked.value;

  const imageHeaders = {
    ...cors,
    'Content-Type': 'image/webp',
    'Cache-Control': 'private, max-age=3600',
  };
  const key = await cacheKey(value);
  const cached = await env.FEED_CACHE.get(key, { type: 'arrayBuffer' });
  if (cached) return new Response(cached, { headers: { ...imageHeaders, 'X-Engraving-Cache': 'hit' } });

  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const hour = now.slice(0, 13);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const dayKey = `engrave:day:${day}`;
  const ipKey = `engrave:ip:${ip}:${hour}`;
  const dailyCap = positiveInt(env.ENGRAVING_DAILY_CAP, 150);
  const ipCap = positiveInt(env.ENGRAVING_PER_IP_HOURLY, 6);
  if (positiveInt(await env.FEED_CACHE.get(dayKey), 0) >= dailyCap) {
    return json(429, { error: 'daily_limit' }, cors);
  }
  if (positiveInt(await env.FEED_CACHE.get(ipKey), 0) >= ipCap) {
    return json(429, { error: 'visitor_limit' }, cors);
  }
  // Count the attempt before calling the model so a burst cannot outrun the caps.
  await Promise.all([bump(env.FEED_CACHE, dayKey, 2 * 86400), bump(env.FEED_CACHE, ipKey, 2 * 3600)]);

  let bytes;
  try {
    bytes = await renderWithModel(value, env, fetchImpl);
  } catch (err) {
    console.error('engraving render failed', err && err.message);
    return json(502, { error: 'render_failed' }, cors);
  }
  const store = env.FEED_CACHE.put(key, bytes, { expirationTtl: CACHE_TTL });
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(store);
  else await store;
  return new Response(bytes, { headers: { ...imageHeaders, 'X-Engraving-Cache': 'miss' } });
}
