import { describe, expect, it } from 'vitest';
import { resolveUrl } from '../src/feeds/hours.js';

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
