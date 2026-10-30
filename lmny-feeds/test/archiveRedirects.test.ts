import { describe, expect, it, vi } from 'vitest';
import { reconcileArchiveRedirects } from '../src/archiveRedirects.js';
import type { Kind } from '../src/types.js';

const fetched = new Set<Kind>(['natural', 'lab']);
const archived = (handle: string) => ({ handle, status: 'ARCHIVED' as const });
const no = () => false;
const client = () => ({
  redirectPaths: vi.fn(async () => new Set<string>()),
  redirectProductUrl: vi.fn(async (_handle: string, _target: string): Promise<string[]> => []),
});

describe('archive redirect reconciliation', () => {
  it('repairs earlier archives, skips held, active, draft, unrelated and unavailable-feed products', async () => {
    const c = client();
    const result = await reconcileArchiveRedirects(c, [
      archived('nd-missing'), archived('lg-missing'), archived('nd-held'),
      archived('w-outage'), archived('other'),
      { handle: 'nd-active', status: 'ACTIVE' }, { handle: 'nd-draft', status: 'DRAFT' },
    ], fetched, new Set(['nd-held']), no);
    expect(result).toEqual({ ensured: 2, pending: 0, errors: [] });
    expect(c.redirectProductUrl.mock.calls).toEqual([
      ['nd-missing', '/collections/natural-diamonds'],
      ['lg-missing', '/collections/lab-grown-diamonds'],
    ]);
  });

  it('preserves existing redirects and drains a bounded backlog across runs', async () => {
    const c = client();
    const paths = new Set(['/products/nd-existing']);
    c.redirectPaths.mockImplementation(async () => paths);
    c.redirectProductUrl.mockImplementation(async (h) => { paths.add(`/products/${h}`); return []; });
    const catalog = ['nd-existing', 'nd-one', 'nd-two'].map(archived);
    expect(await reconcileArchiveRedirects(c, catalog, fetched, new Set(), no, 1))
      .toEqual({ ensured: 1, pending: 1, errors: [] });
    expect(await reconcileArchiveRedirects(c, catalog, fetched, new Set(), no, 1))
      .toEqual({ ensured: 1, pending: 0, errors: [] });
    expect(await reconcileArchiveRedirects(c, catalog, fetched, new Set(), no, 1))
      .toEqual({ ensured: 0, pending: 0, errors: [] });
    expect(c.redirectProductUrl).toHaveBeenCalledTimes(2);
  });

  it('reports lookup denial and retries the retained archive next run', async () => {
    const c = client();
    c.redirectPaths.mockRejectedValueOnce(new Error('Access denied'));
    const failed = await reconcileArchiveRedirects(c, [archived('nd-old')], fetched, new Set(), no);
    expect(failed).toMatchObject({ ensured: 0, pending: 1 });
    expect(failed.errors[0]).toContain('write_online_store_navigation');
    expect(c.redirectProductUrl).not.toHaveBeenCalled();
    expect(await reconcileArchiveRedirects(c, [archived('nd-old')], fetched, new Set(), no))
      .toEqual({ ensured: 1, pending: 0, errors: [] });
  });

  it('keeps user errors and thrown permission errors pending', async () => {
    const c = client();
    c.redirectProductUrl.mockResolvedValueOnce(['Invalid target']).mockRejectedValueOnce(new Error('Access denied'));
    const result = await reconcileArchiveRedirects(c, ['nd-a', 'nd-b', 'nd-c'].map(archived), fetched, new Set(), no);
    expect(result).toMatchObject({ ensured: 0, pending: 3 });
    expect(result.errors).toHaveLength(2);
    expect(c.redirectProductUrl).toHaveBeenCalledTimes(2);
  });

  it('keeps merchant-unavailable watch redirects without redirecting active products', async () => {
    const c = client();
    await reconcileArchiveRedirects(c, [archived('estate-watch'), { handle: 'active-watch', status: 'ACTIVE' }],
      new Set(), new Set(['estate-watch']), () => true);
    expect(c.redirectProductUrl.mock.calls).toEqual([['estate-watch', '/collections/time-pieces']]);
  });
});
