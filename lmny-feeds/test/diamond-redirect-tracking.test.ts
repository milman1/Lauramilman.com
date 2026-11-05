import { describe, expect, it, vi } from 'vitest';
import { trackedDiamondTarget, reconcileColoredRedirects, REDIRECT_OPS } from '../src/diamondRedirectTracking.mjs';

describe('diamond redirect tracking and colored coverage', () => {
  it('preserves collection filters and replaces only its own marker', () => {
    expect(trackedDiamondTarget('lg-123', '/collections/lab-grown-diamonds?shape=Oval&min_carat=2'))
      .toBe('/collections/lab-grown-diamonds?shape=Oval&min_carat=2&lmny_redirect=lg-123');
    expect(trackedDiamondTarget('nd-abc', '/collections/natural-diamonds?lmny_redirect=old'))
      .toBe('/collections/natural-diamonds?lmny_redirect=nd-abc');
    for (const handle of ['w-123', '../bad', 'lg-a?email=x'])
      expect(trackedDiamondTarget(handle, '/collections/test')).toBe('/collections/test');
    expect(trackedDiamondTarget('lg-123', 'https://outside.example/collections/test')).toBe('https://outside.example/collections/test');
  });
  it('retries absent owned drafts and archives, preserves overrides, and independently verifies writes', async () => {
    const rows = [{ id: 'existing', path: '/products/lg-color-existing', target: '/collections/custom' }];
    const gql = vi.fn(async (query, variables) => {
      if (query === REDIRECT_OPS.list) return {urlRedirects: {nodes: [...rows], pageInfo: {hasNextPage: false}}};
      rows.push({id: 'created', ...variables.redirect});
      return {urlRedirectCreate: {userErrors: []}};
    });
    const catalog = [
      {handle: 'lg-color-old', status: 'DRAFT', tags: ['feed']},
      {handle: 'lg-color-archive', status: 'ARCHIVED', tags: ['feed']},
      {handle: 'lg-color-existing', status: 'DRAFT', tags: ['feed']},
      {handle: 'lg-color-live', status: 'ACTIVE', tags: ['feed']},
      {handle: 'lg-color-held', status: 'DRAFT', tags: ['feed']},
      {handle: 'lg-color-other', status: 'DRAFT', tags: []},
    ];
    expect(await reconcileColoredRedirects(gql,catalog,new Set(['lg-color-held']),'feed',1))
      .toEqual({ensured: 1, pending: 1});
    expect(await reconcileColoredRedirects(gql,catalog,new Set(['lg-color-held']),'feed'))
      .toEqual({ensured: 1, pending: 0});
    expect(rows[0]!.target).toBe('/collections/custom');
    expect(rows[1]!.target).toBe('/collections/colored-lab-grown-diamonds?lmny_redirect=lg-color-old');
    expect(rows).toHaveLength(3);
  });
  it('does not call an unverified creation successful', async () => {
    const gql = vi.fn(async query => query === REDIRECT_OPS.list
      ? {urlRedirects: {nodes: [], pageInfo: {hasNextPage: false}}}
      : {urlRedirectCreate: {userErrors: []}});
    await expect(reconcileColoredRedirects(gql,[{handle:'lg-color-old',status:'DRAFT',tags:['feed']}],new Set(),'feed'))
      .rejects.toThrow('verification failed');
  });
});
