const ORIGIN = 'https://www.lauramilman.com';
/** Read-only HTTP verification. Never follow a redirect outside the storefront. */
export async function checkRedirect(row, fetcher = fetch) {
  let url = new URL(row.path, ORIGIN);
  let redirected = false;
  const visited = new Set();
  try {
    for (let hop = 0; hop < 6; hop++) {
      if (!['www.lauramilman.com', 'lauramilman.com'].includes(url.hostname) || url.protocol !== 'https:')
        return {path:row.path, status:'external_target'};
      if (visited.has(url.href)) return {path:row.path, status:'loop'};
      visited.add(url.href);
      const response = await fetcher(url.href, {method:'GET', redirect:'manual', signal:AbortSignal.timeout(15000)});
      await response.body?.cancel();
      if ([301,302,303,307,308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) return {path:row.path,status:'missing_location'};
        url = new URL(location,url); redirected = true; continue;
      }
      if (response.status !== 200) return {path:row.path,status:'http_' + response.status};
      if (!redirected) return {path:row.path,status:'live_product'};
      const expected = new URL(row.target,ORIGIN);
      if (url.pathname !== expected.pathname) return {path:row.path,status:'wrong_destination'};
      for (const [key,value] of expected.searchParams)
        if (url.searchParams.get(key) !== value) return {path:row.path,status:'lost_filter_or_marker'};
      return {path:row.path,status:'redirect_ok'};
    }
    return {path:row.path,status:'too_many_hops'};
  } catch { return {path:row.path,status:'request_failed'}; }
}
