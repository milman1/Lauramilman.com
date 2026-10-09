import { kindForHandle } from './diff.js';
import type { CatalogEntry, Decision } from './types.js';

/** A truncated nonempty response is just as dangerous as an empty feed.
 * Block the entire write phase, including Supabase unavailable marking.
 * A genuine large supplier withdrawal needs investigation, not an override.
 */
export function assertSafeDiamondRemovals(
  decisions: Pick<Decision, 'handle' | 'action'>[],
  catalog: Pick<CatalogEntry, 'handle'>[],
): void {
  for (const kind of ['natural', 'lab'] as const) {
    const existing = new Set(catalog.filter(p => kindForHandle(p.handle) === kind).map(p => p.handle)).size;
    const removals = new Set(decisions.filter(d => kindForHandle(d.handle) === kind &&
      (d.action === 'delete' || d.action === 'archive')).map(d => d.handle)).size;
    if (removals >= 20 && removals / existing > 0.2) {
      throw new Error(`Refusing all writes: ${kind} feed would remove ${removals}/${existing} diamonds (>20%). Check feed completeness.`);
    }
  }
}
