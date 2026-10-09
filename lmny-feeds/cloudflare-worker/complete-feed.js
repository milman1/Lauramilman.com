// Only commit a cache snapshot after every supplier page succeeds.
export function rowsFrom(payload, depth = 0) {
  if (depth > 4 || !payload || typeof payload !== 'object') return null;
  if (Array.isArray(payload)) return payload.every(r => r && typeof r === 'object') ? payload : null;
  for (const name of ['data', 'items', 'results', 'diamonds', 'stones', 'watches', 'products', 'rows']) {
    if (!(name in payload)) continue;
    const rows = rowsFrom(payload[name], depth + 1);
    if (rows !== null) return rows;
  }
  return null;
}

export async function collectFeed(kind, fetchPage, maxPages = 500) {
  const all = [];
  const signatures = new Set();
  let expectedTotal;
  for (let page = 1; page <= maxPages; page++) {
    const response = await fetchPage(page);
    if (!response.ok) throw new Error(`Feed ${kind} page ${page}: HTTP ${response.status}`);
    const payload = await response.json();
    // HTTP 200 rate-limit/error bodies must never masquerade as the terminator.
    if (payload && !Array.isArray(payload) &&
        (payload.success === false || payload.error || /limit|error|unauthor|forbidden/i.test(String(payload.message || '')))) {
      throw new Error(`Feed ${kind} page ${page}: supplier refused request`);
    }
    const rows = rowsFrom(payload);
    if (rows === null) throw new Error(`Feed ${kind} page ${page}: missing row array`);
    const total = payload?.meta?.total ?? payload?.pagination?.total ?? payload?.data?.total ?? payload?.total;
    if (total != null && Number.isFinite(Number(total))) {
      if (expectedTotal != null && expectedTotal !== Number(total)) throw new Error(`Feed ${kind}: total changed during pagination`);
      expectedTotal = Number(total);
    }
    if (!rows.length) {
      if (!all.length || (expectedTotal != null && all.length !== expectedTotal)) throw new Error(`Feed ${kind}: incomplete or empty snapshot`);
      return all;
    }
    // Some supplier endpoints ignore page. Accept that only when page two
    // exactly repeats the entire first page, and any declared total agrees.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(rows)));
    const signature = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    if (signatures.has(signature)) {
      if (page === 2 && (expectedTotal == null || expectedTotal === all.length)) return all;
      throw new Error(`Feed ${kind}: repeated page before completion`);
    }
    signatures.add(signature);
    for (const row of rows) all.push(row);
    if (kind === 'watch' || (expectedTotal != null && all.length === expectedTotal)) return all;
    if (expectedTotal != null && all.length > expectedTotal) throw new Error(`Feed ${kind}: rows exceed declared total`);
  }
  throw new Error(`Feed ${kind}: pagination safety cap reached`);
}
