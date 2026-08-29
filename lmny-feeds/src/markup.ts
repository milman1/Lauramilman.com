import { DIAMOND, LAB_GUARDS, LAB_TIERS as FALLBACK_RULES } from '../config/pricing.js';
import type { Hold, Priced, StoneItem, WatchItem } from './types.js';
import { priceWatchFromCost } from './watchPricing.js';

export { FALLBACK_RULES };

export type PriceResult =
  | { ok: true; priced: Priced }
  | { ok: false; hold: Hold };

function round(usd: number): number {
  return Math.round(usd);
}

function margin(retail: number, cost: number): number {
  return (retail - cost) / retail;
}

function minCostPerCaratFloor(carat: number): number {
  const band = LAB_GUARDS.minCostPerCarat.find((b) => carat <= b.maxCarat);
  const listed = band?.minUsd ?? LAB_GUARDS.minCostPerCarat.at(-1)!.minUsd;
  // Floors were tuned to portal Amount $/ct; LMNY cost is 2/3 of that.
  return listed * DIAMOND.supplierAmountShare;
}

/**
 * Natural ticket: round(LMNY cost × 1.25). Cost is already Amount × 2/3.
 */
function priceFromLmnyCost(item: StoneItem, multiple: number): PriceResult {
  if (!(item.costUsd > 0)) {
    return {
      ok: false,
      hold: {
        kind: item.kind,
        stockRef: item.stockRef,
        reason: item.kind === 'lab' ? 'lab_no_cost' : 'natural_no_cost',
      },
    };
  }
  const retailUsd = round(item.costUsd * multiple);
  if (retailUsd < item.costUsd) {
    return {
      ok: false,
      hold: {
        kind: item.kind,
        stockRef: item.stockRef,
        reason: 'retail_below_cost',
        detail: `retail ${retailUsd} < cost ${item.costUsd}`,
      },
    };
  }
  const marginPct = margin(retailUsd, item.costUsd);
  // 1.25× is exactly 20% before rounding; round(cost × 1.25) can sit a
  // fraction of a cent under the floor (stock 350393: 19.9999%).
  if (marginPct < DIAMOND.minMarginPct - 1e-4) {
    return {
      ok: false,
      hold: {
        kind: item.kind,
        stockRef: item.stockRef,
        reason: item.kind === 'lab' ? 'lab_margin_floor' : 'natural_margin_floor',
        detail: `margin ${(marginPct * 100).toFixed(1)}% < ${(DIAMOND.minMarginPct * 100).toFixed(0)}%`,
      },
    };
  }
  return { ok: true, priced: { retailUsd, marginPct } };
}

export function priceNatural(item: StoneItem): PriceResult {
  return priceFromLmnyCost(item, DIAMOND.amountMultiple);
}

/**
 * Lab-grown: modest extra markup on cheap stones, 1.25× above $4k,
 * after fail-closed mapping guards.
 */
export function priceLab(item: StoneItem): PriceResult {
  const ppc = item.pricePerCaratUsd ?? (item.carat > 0 ? item.costUsd / item.carat : 0);
  const floor = minCostPerCaratFloor(item.carat);
  if (!(ppc >= floor)) {
    return {
      ok: false,
      hold: {
        kind: item.kind,
        stockRef: item.stockRef,
        reason: 'lab_cost_per_carat_floor',
        detail: `$${ppc.toFixed(2)}/ct < floor $${floor}/ct at ${item.carat}ct — likely $/ct used as total`,
      },
    };
  }

  // The live bug: costUsd was set to Buy_Price (per-carat) without × carat.
  // For ≥1.5ct, total must be within 15% of ppc × carat.
  if (item.carat >= 1.5 && ppc > 0) {
    const expected = ppc * item.carat;
    if (item.costUsd < expected * 0.85) {
      return {
        ok: false,
        hold: {
          kind: item.kind,
          stockRef: item.stockRef,
          reason: 'lab_cost_not_multiplied',
          detail: `cost ${item.costUsd} << ppc×carat ${expected.toFixed(2)} — Buy_Price used as total`,
        },
      };
    }
  }

  const tier = FALLBACK_RULES.find((t) => item.costUsd <= t.maxCostUsd);
  if (!tier) {
    return { ok: false, hold: { kind: item.kind, stockRef: item.stockRef, reason: 'lab_no_markup_tier' } };
  }

  const priced = priceFromLmnyCost(item, tier.multiplier);
  if (!priced.ok) return priced;

  if (
    item.carat >= LAB_GUARDS.minCaratForRetailFloor &&
    priced.priced.retailUsd < LAB_GUARDS.minRetailUsd * DIAMOND.supplierAmountShare
  ) {
    return {
      ok: false,
      hold: {
        kind: item.kind,
        stockRef: item.stockRef,
        reason: 'lab_retail_floor',
        detail: `retail ${priced.priced.retailUsd} < $${LAB_GUARDS.minRetailUsd} at ${item.carat}ct`,
      },
    };
  }

  return priced;
}

export interface WatchComp {
  midUsd: number;
  /** Listing low when the provider returns a range. Stored for audit only. */
  lowUsd?: number;
  /** Number of listings backing the mid. Informational; does not gate pricing. */
  sourceCount?: number;
  asOf?: string;
}

/**
 * Watches: supplier-cost tiers via watchPricing.ts. No Hours mid — retail is
 * cost × chart multiplier, rounded up to $100, with the chart band floors.
 */
export function priceWatch(item: WatchItem): PriceResult {
  const outcome = priceWatchFromCost({
    costUsd: item.costUsd,
    aftermarket: false, // normalize already excludes aftermarket
  });

  if (outcome.status === 'no_cost') {
    return {
      ok: false,
      hold: { kind: item.kind, stockRef: item.stockRef, reason: 'watch_no_cost' },
    };
  }
  if (outcome.status === 'excluded') {
    return {
      ok: false,
      hold: {
        kind: item.kind,
        stockRef: item.stockRef,
        reason: 'watch_aftermarket',
        detail: outcome.reason,
      },
    };
  }

  const retailUsd = outcome.retailUsd;
  return {
    ok: true,
    priced: {
      retailUsd,
      marginPct: margin(retailUsd, item.costUsd),
    },
  };
}
