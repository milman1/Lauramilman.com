import {
  LAB_GUARDS,
  LAB_TIERS as FALLBACK_RULES,
  LOOSE_DIAMOND,
  NATURAL,
  WATCH,
} from '../config/pricing.js';
import type { Hold, Priced, StoneItem, WatchItem } from './types.js';

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
  return band?.minUsd ?? LAB_GUARDS.minCostPerCarat.at(-1)!.minUsd;
}

/** Loose natural: retail = round(deal-API wholesale × 5). */
export function priceNatural(item: StoneItem): PriceResult {
  if (!(item.costUsd > 0)) {
    return { ok: false, hold: { kind: item.kind, stockRef: item.stockRef, reason: 'natural_no_cost' } };
  }
  const retailUsd = round(item.costUsd * LOOSE_DIAMOND.wholesaleMultiple);
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
  if (marginPct < NATURAL.minMarginPct) {
    return {
      ok: false,
      hold: {
        kind: item.kind,
        stockRef: item.stockRef,
        reason: 'natural_margin_floor',
        detail: `margin ${(marginPct * 100).toFixed(1)}% < ${(NATURAL.minMarginPct * 100).toFixed(0)}%`,
      },
    };
  }
  return { ok: true, priced: { retailUsd, marginPct } };
}

/**
 * Lab-grown: flat 5× on **total** feed cost (Buy_Price × carat).
 * Fail-closed guards catch a regress to treating $/ct as total.
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
  const retailUsd = round(item.costUsd * tier.multiplier);

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

  if (
    item.carat >= LAB_GUARDS.minCaratForRetailFloor &&
    retailUsd < LAB_GUARDS.minRetailUsd
  ) {
    return {
      ok: false,
      hold: {
        kind: item.kind,
        stockRef: item.stockRef,
        reason: 'lab_retail_floor',
        detail: `retail ${retailUsd} < $${LAB_GUARDS.minRetailUsd} at ${item.carat}ct`,
      },
    };
  }

  return { ok: true, priced: { retailUsd, marginPct: margin(retailUsd, item.costUsd) } };
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
 * Watches: round(comp_mid × 0.97). No mid → round(cost × 1.10).
 * Comp mid is the sole market signal; accessory state and listing-low blends
 * do not move the published price.
 */
export function priceWatch(item: WatchItem, comp: WatchComp | null): PriceResult {
  if (comp && comp.midUsd > 0) {
    const retailUsd = round(comp.midUsd * WATCH.compDiscount);
    return {
      ok: true,
      priced: {
        retailUsd,
        marginPct: margin(retailUsd, item.costUsd),
        compMidUsd: comp.midUsd,
        compLowUsd: comp.lowUsd,
        compAsOf: comp.asOf,
      },
    };
  }
  const retailUsd = round(item.costUsd * WATCH.noCompMultiple);
  return {
    ok: true,
    priced: {
      retailUsd,
      marginPct: margin(retailUsd, item.costUsd),
    },
  };
}
