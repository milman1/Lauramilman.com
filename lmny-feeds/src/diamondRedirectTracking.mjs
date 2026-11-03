// Public product handles only; no customer data or campaign attribution changes.
export function trackedDiamondTarget(handle, target) {
  if (!/^(lg|nd)-[a-z0-9-]{1,96}$/.test(handle)) return target;
  if (!/^\/collections\/[a-z0-9-]+(?:\?|$)/.test(target)) return target;
  const url = new URL(target, 'https://www.lauramilman.com');
  url.searchParams.set('lmny_redirect', handle);
  return url.pathname + url.search + url.hash;
}

export const REDIRECT_OPS = {
  list: `query($after: String) { urlRedirects(first: 250, after: $after) {
    nodes { id path target } pageInfo { hasNextPage endCursor }
  } }`,
  create: `mutation($redirect: UrlRedirectInput!) { urlRedirectCreate(urlRedirect: $redirect) {
    urlRedirect { id } userErrors { code message }
  } }`,
};

export async function readRedirects(gql) {
  const rows = []; let after = null;
  for (let page = 0; page < 1000; page++) {
    const result = (await gql(REDIRECT_OPS.list, { after })).urlRedirects;
    rows.push(...result.nodes);
    if (!result.pageInfo.hasNextPage) return rows;
    const next = result.pageInfo.endCursor;
    if (!next || next === after) throw new Error('Redirect pagination incomplete');
    after = next;
  }
  throw new Error('Redirect page limit exceeded');
}

/** Full colored feed runs only. Never change product status or a merchant redirect.
 * Missing drafts/archives are revisited so a previous failed write is retried.
 */
export async function reconcileColoredRedirects(gql, catalog, available, feedTag, budget = 500) {
  const candidates = catalog.filter(p => /^lg-color-[a-z0-9-]+$/.test(p.handle)
    && p.tags.includes(feedTag) && ['DRAFT', 'ARCHIVED'].includes(p.status)
    && !available.has(p.handle));
  if (!candidates.length) return { ensured: 0, pending: 0 };
  const existing = new Set((await readRedirects(gql)).map(r => r.path));
  const missing = candidates.filter(p => !existing.has('/products/' + p.handle));
  for (const p of missing.slice(0, budget)) {
    const result = (await gql(REDIRECT_OPS.create, { redirect: {
      path: '/products/' + p.handle,
      target: trackedDiamondTarget(p.handle, '/collections/colored-lab-grown-diamonds'),
    } })).urlRedirectCreate;
    if (result.userErrors.some(e => e.code !== 'TAKEN')) throw new Error('Colored redirect write failed');
  }
  // A mutation response alone is not evidence that the redirect exists.
  const verified = new Set((await readRedirects(gql)).map(r => r.path));
  const attempted = missing.slice(0, budget);
  if (attempted.some(p => !verified.has('/products/' + p.handle))) throw new Error('Colored redirect verification failed');
  return { ensured: attempted.length, pending: missing.length - attempted.length };
}
