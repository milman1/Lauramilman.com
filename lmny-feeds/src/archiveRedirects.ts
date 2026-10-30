import { kindForHandle } from './diff.js';
import type { CatalogEntry, Kind } from './types.js';

const TARGETS: Record<Kind, string> = {
  natural: '/collections/natural-diamonds',
  lab: '/collections/lab-grown-diamonds',
  watch: '/collections/time-pieces',
};

interface RedirectClient {
  redirectPaths(): Promise<Set<string>>;
  redirectProductUrl(handle: string, target: string): Promise<string[]>;
}

/** Revisit retained archives each run so an earlier failed redirect is not lost.
 * Held and desired products, failed feed segments, and failed archives are
 * excluded. Existing redirects are preserved, including merchant overrides.
 * Archiving happens before this pass: navigation failures cannot keep stock live.
 */
export async function reconcileArchiveRedirects(
  client: RedirectClient,
  catalog: Pick<CatalogEntry, 'handle' | 'status'>[],
  fetchedKinds: Set<Kind>,
  present: Set<string>,
  merchantUnavailable: (handle: string) => boolean,
  budget = 100,
): Promise<{ ensured: number; pending: number; errors: string[] }> {
  const candidates = catalog.filter(p => {
    if (p.status !== 'ARCHIVED') return false;
    if (merchantUnavailable(p.handle)) return true;
    const kind = kindForHandle(p.handle);
    return kind !== null && fetchedKinds.has(kind) && !present.has(p.handle);
  });
  if (!candidates.length) return { ensured: 0, pending: 0, errors: [] };
  let existing: Set<string>;
  try {
    existing = await client.redirectPaths();
  } catch (err) {
    return { ensured: 0, pending: candidates.length, errors: [
      `redirect lookup failed: ${String(err)}; verify read_online_store_navigation / write_online_store_navigation`,
    ] };
  }
  const missing = candidates.filter(p => !existing.has(`/products/${p.handle}`));
  const errors: string[] = [];
  let ensured = 0;
  for (const p of missing.slice(0, budget)) {
    const target = TARGETS[merchantUnavailable(p.handle) ? 'watch' : kindForHandle(p.handle)!];
    try {
      const failures = await client.redirectProductUrl(p.handle, target);
      if (!failures.length) ensured++;
      errors.push(...failures.map(e => `redirect ${p.handle}: ${e}`));
    } catch (err) {
      errors.push(`redirect ${p.handle}: ${String(err)}; verify write_online_store_navigation`);
      // Auth/outage errors often affect every path. Keep the rest pending.
      break;
    }
  }
  return { ensured, pending: missing.length - ensured, errors };
}
