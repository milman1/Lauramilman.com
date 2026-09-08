import { handleFor } from './product.js';
import type { BackVaultItem } from './types.js';

export interface AvailabilityResult {
  /** New-arrivals items plus store items still in stock elsewhere on the supplier. */
  desired: BackVaultItem[];
  /** Store items that left new-arrivals but are still in stock — kept, not archived. */
  retained: number;
}

/**
 * Weekly availability check.
 *
 * New arrivals drive what gets *created*. But once a piece is on the store
 * it should stay listed for as long as the supplier still has it in stock,
 * even after it rolls off the new-arrivals collection. So every product
 * already tagged backvault-feed that is missing from new-arrivals is looked
 * up in the supplier's full in-stock catalog; if it is there (and matched a
 * top designer, so it normalized), it is retained with its current data.
 * Anything not in either set is sold/withdrawn and archives as before.
 *
 * Pure: takes already-normalized item lists so it is unit-testable without
 * the network.
 */
export function mergeAvailability(
  arrivals: BackVaultItem[],
  fullCatalog: BackVaultItem[],
  storeHandles: Iterable<string>,
): AvailabilityResult {
  const seen = new Set(arrivals.map((item) => handleFor(item)));
  const onStore = new Set(storeHandles);
  const desired = [...arrivals];
  let retained = 0;
  for (const item of fullCatalog) {
    const handle = handleFor(item);
    if (seen.has(handle) || !onStore.has(handle)) continue;
    seen.add(handle);
    desired.push(item);
    retained += 1;
  }
  return { desired, retained };
}
