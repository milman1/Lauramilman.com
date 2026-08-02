import { afterEach, describe, expect, it, vi } from 'vitest';
import { HoursClient, resolveUrl } from '../src/feeds/hours.js';

describe('Hours URL resolution', () => {
  it('appends the function path to a bare Supabase origin', () => {
    expect(resolveUrl('https://uvgizqmfjraopucphbli.supabase.co')).toBe(
      'https://uvgizqmfjraopucphbli.supabase.co/functions/v1/comps',
    );
    // trailing slash tolerated
    expect(resolveUrl('https://uvgizqmfjraopucphbli.supabase.co/')).toBe(
      'https://uvgizqmfjraopucphbli.supabase.co/functions/v1/comps',
    );
  });

  it('leaves a full Supabase function URL untouched', () => {
    const full = 'https://uvgizqmfjraopucphbli.supabase.co/functions/v1/comps';
    expect(resolveUrl(full)).toBe(full);
  });

  it('appends /api/comps to a plain site root', () => {
    expect(resolveUrl('https://gethoursapp.com')).toBe('https://gethoursapp.com/api/comps');
  });

  it('leaves an explicit /api path untouched', () => {
    expect(resolveUrl('https://gethoursapp.com/api/comps')).toBe('https://gethoursapp.com/api/comps');
  });

  it('throws when unset', () => {
    expect(() => resolveUrl(undefined)).toThrow(/HOURS_API_URL/);
  });
});

describe('Hours comp parsing (real camelCase response)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses midUsd/asOf from the live response shape', async () => {
    process.env.HOURS_API_URL = 'https://uvgizqmfjraopucphbli.supabase.co/functions/v1/comps';
    process.env.HOURS_API_KEY = 'test';
    vi.stubGlobal('fetch', async () =>
      new Response(JSON.stringify({ asOf: '2026-07-27T17:09:14.001Z', lowUsd: 21721, midUsd: 26374, sourceCount: 44 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const comp = await new HoursClient().compFor('Rolex', '126710BLRO');
    expect(comp).toEqual({ midUsd: 26374, lowUsd: 21721, sourceCount: 44, asOf: '2026-07-27' });
  });

  it('returns null (hold) on a 404', async () => {
    process.env.HOURS_API_URL = 'https://uvgizqmfjraopucphbli.supabase.co/functions/v1/comps';
    process.env.HOURS_API_KEY = 'test';
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }));
    expect(await new HoursClient().compFor('Rolex', 'NOPE')).toBeNull();
  });
});
