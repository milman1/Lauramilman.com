import { describe, expect, it, vi } from 'vitest';
import {
  buildEngravingPrompt,
  corsHeaders,
  handleEngraving,
  normalizeImageUrl,
  validateEngravingRequest,
} from '../cloudflare-worker/engraving-render.js';

const IMAGE = '//lauramilman.com/cdn/shop/files/oval-solitaire.jpg?v=1&width=1024';
const ORIGIN = 'https://lauramilman.com';

function memoryKv() {
  const store = new Map<string, any>();
  return {
    store,
    async get(key: string) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key: string, value: any) {
      store.set(key, value);
    },
  };
}

function post(body: unknown, origin = ORIGIN, ip = '203.0.113.9') {
  return new Request('https://worker.example/engraving/render', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });
}

function fakeFetch() {
  const webp = new Uint8Array([82, 73, 70, 70]);
  const b64 = Buffer.from(webp).toString('base64');
  return vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    const href = String(url);
    if (href.startsWith('https://api.openai.com/')) {
      return new Response(JSON.stringify({ data: [{ b64_json: b64 }] }), { status: 200 });
    }
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } });
  });
}

describe('engraving render: input rules', () => {
  it('accepts Shopify product photos only', () => {
    expect(normalizeImageUrl(IMAGE)).toBe('https://lauramilman.com/cdn/shop/files/oval-solitaire.jpg?v=1&width=1024');
    expect(normalizeImageUrl('https://cdn.shopify.com/s/files/1/2170/1117/files/ring.jpg')).not.toBeNull();
    expect(normalizeImageUrl('https://evil.example/cdn/shop/files/x.jpg')).toBeNull();
    expect(normalizeImageUrl('http://lauramilman.com/cdn/shop/files/x.jpg')).toBeNull();
    expect(normalizeImageUrl('https://lauramilman.com/pages/about')).toBeNull();
    expect(normalizeImageUrl('https://cdn.shopify.com/other/x.jpg')).toBeNull();
  });

  it('validates the inscription and falls back to safe font and metal', () => {
    const ok = validateEngravingRequest({ text: '  Forever   yours ♥ ', font: 'Nope', metal: 'x', image: IMAGE });
    expect(ok).toEqual({
      ok: true,
      value: { text: 'Forever yours ♥', font: 'Script', metal: 'yellow', image: expect.any(String) },
    });
    expect(validateEngravingRequest({ text: '', image: IMAGE })).toEqual({ ok: false, error: 'text_required' });
    expect(validateEngravingRequest({ text: 'x'.repeat(31), image: IMAGE })).toEqual({ ok: false, error: 'text_too_long' });
    expect(validateEngravingRequest({ text: '<script>', image: IMAGE })).toEqual({ ok: false, error: 'text_characters' });
    expect(validateEngravingRequest({ text: 'A & B', image: 'https://x.test/a.jpg' })).toEqual({
      ok: false,
      error: 'image_not_allowed',
    });
    expect(validateEngravingRequest({ text: 'Zoë 12.06.26', image: IMAGE }).ok).toBe(true);
  });

  it('spells the inscription out and keeps the ring unchanged', () => {
    const prompt = buildEngravingPrompt({ text: 'A & B', font: 'Block', metal: 'platinum' });
    expect(prompt).toContain('reads exactly: "A & B"');
    expect(prompt).toContain('A (space) & (space) B');
    expect(prompt).toContain('platinum');
    expect(prompt).toContain('nothing added or changed from the reference piece');
  });

  it('only opens CORS to the store origins', () => {
    expect(corsHeaders(ORIGIN)['Access-Control-Allow-Origin']).toBe(ORIGIN);
    expect(corsHeaders('https://www.lauramilman.com')['Access-Control-Allow-Origin']).toBe('https://www.lauramilman.com');
    expect(corsHeaders('https://evil.example')['Access-Control-Allow-Origin']).toBeUndefined();
    expect(
      corsHeaders('https://preview.example', { ENGRAVING_ALLOWED_ORIGINS: 'https://preview.example/' })[
        'Access-Control-Allow-Origin'
      ],
    ).toBe('https://preview.example');
  });
});

describe('engraving render: handler', () => {
  const body = { text: 'Always', font: 'Script', metal: 'rose', image: IMAGE };

  it('stays off until the API key is set', async () => {
    const res = await handleEngraving(post(body), { FEED_CACHE: memoryKv() }, undefined, fakeFetch());
    expect(res.status).toBe(503);
  });

  it('refuses other origins and non-POST methods', async () => {
    const env = { OPENAI_API_KEY: 'k', FEED_CACHE: memoryKv() };
    expect((await handleEngraving(post(body, 'https://evil.example'), env, undefined, fakeFetch())).status).toBe(403);
    const get = new Request('https://worker.example/engraving/render', { headers: { Origin: ORIGIN } });
    expect((await handleEngraving(get, env, undefined, fakeFetch())).status).toBe(405);
    const preflight = new Request('https://worker.example/engraving/render', {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN },
    });
    const pre = await handleEngraving(preflight, env, undefined, fakeFetch());
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('renders once, then serves the same request from cache', async () => {
    const kv = memoryKv();
    const env = { OPENAI_API_KEY: 'k', FEED_CACHE: kv };
    const fetchImpl = fakeFetch();

    const first = await handleEngraving(post(body), env, undefined, fetchImpl);
    expect(first.status).toBe(200);
    expect(first.headers.get('Content-Type')).toBe('image/webp');
    expect(first.headers.get('X-Engraving-Cache')).toBe('miss');
    expect(new Uint8Array(await first.arrayBuffer())).toEqual(new Uint8Array([82, 73, 70, 70]));

    const modelCall = fetchImpl.mock.calls.find((c) => String(c[0]).startsWith('https://api.openai.com/'));
    expect(modelCall).toBeDefined();
    const form = modelCall![1]!.body as FormData;
    expect(form.get('model')).toBe('gpt-image-1');
    expect(String(form.get('prompt'))).toContain('"Always"');

    const second = await handleEngraving(post(body), env, undefined, fetchImpl);
    expect(second.headers.get('X-Engraving-Cache')).toBe('hit');
    expect(fetchImpl.mock.calls.filter((c) => String(c[0]).startsWith('https://api.openai.com/'))).toHaveLength(1);
  });

  it('enforces the per-visitor and daily caps', async () => {
    const env = { OPENAI_API_KEY: 'k', FEED_CACHE: memoryKv(), ENGRAVING_PER_IP_HOURLY: '2', ENGRAVING_DAILY_CAP: '3' };
    const fetchImpl = fakeFetch();
    const statuses: number[] = [];
    for (const text of ['One', 'Two', 'Three']) {
      statuses.push((await handleEngraving(post({ ...body, text }), env, undefined, fetchImpl)).status);
    }
    expect(statuses).toEqual([200, 200, 429]);
    const other = await handleEngraving(post({ ...body, text: 'Four' }, ORIGIN, '198.51.100.4'), env, undefined, fetchImpl);
    expect(other.status).toBe(200);
    const capped = await handleEngraving(post({ ...body, text: 'Five' }, ORIGIN, '198.51.100.5'), env, undefined, fetchImpl);
    expect(capped.status).toBe(429);
    expect(await capped.json()).toEqual({ error: 'daily_limit' });
  });

  it('reports a model failure without leaking details', async () => {
    const env = { OPENAI_API_KEY: 'k', FEED_CACHE: memoryKv() };
    const failing = vi.fn(async (url: string | URL | Request, _init?: RequestInit) =>
      String(url).startsWith('https://api.openai.com/')
        ? new Response(JSON.stringify({ error: { message: 'secret detail' } }), { status: 400 })
        : new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'image/png' } }),
    );
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleEngraving(post(body), env, undefined, failing);
    spy.mockRestore();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'render_failed' });
  });
});
