import { LAB_GUARDS, LAB_TIERS as FALLBACK_RULES, NATURAL, WATCH } from '../config/pricing.js';
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

/** Naturals: Rapaport list × 0.75, held below the 20% margin floor. */
export function priceNatural(item: StoneItem): PriceResult {
  if (!item.rapPriceUsd) {
    return { ok: false, hold: { kind: item.kind, stockRef: item.stockRef, reason: 'natural_no_rap_price' } };
  }
  const retailUsd = round(item.rapPriceUsd * NATURAL.rapDiscount);
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
 * Lab-grown: tiered multiplier on **total** feed cost (Buy_Price × carat).
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
  /** Listing low when the provider returns a range. Used to de-bias mid. */
  lowUsd?: number;
  /** Number of listings backing the mid. Below WATCH.minSourceCount → hold. */
  sourceCount?: number;
  asOf?: string;
}

/** Hours comps are full-set references; haircut incomplete sets. */
export function accessoryHaircut(item: WatchItem): number {
  if (item.isNaked || (!item.box && !item.papers)) return WATCH.nakedHaircut;
  if (item.box && item.papers) return 1;
  return WATCH.partialHaircut;
}

/**
 * Blend Hours low→mid toward a market anchor. Falls back to mid when no low.
 * Exposed for tests / reporting.
 */
export function marketAnchor(comp: WatchComp): number {
  if (
    comp.lowUsd !== undefined &&
    comp.lowUsd > 0 &&
    comp.lowUsd <= comp.midUsd
  ) {
    return comp.lowUsd + (comp.midUsd - comp.lowUsd) * WATCH.midBlend;
  }
  return comp.midUsd;
}

/**
 * Watches: marketAnchor × accessory haircut × 0.97, floored at cost × 1.05.
 * No comp / weak sourceCount → hold. Floor above target → feed already at
 * market → hold. Only genuinely-below-market pieces publish.
 */
export function priceWatch(item: WatchItem, comp: WatchComp | null): PriceResult {
  if (!comp) {
    return { ok: false, hold: { kind: item.kind, stockRef: item.stockRef, reason: 'watch_no_market_comp' } };
  }
  if (
    comp.sourceCount !== undefined &&
    comp.sourceCount < WATCH.minSourceCount
  ) {
    return {
      ok: false,
      hold: {
        kind: item.kind,
        stockRef: item.stockRef,
        reason: 'watch_weak_comp',
        detail: `sourceCount ${comp.sourceCount} < ${WATCH.minSourceCount}`,
      },
    };
  }
  const haircut = accessoryHaircut(item);
  const anchor = marketAnchor(comp);
  const target = anchor * haircut * WATCH.compDiscount;
  const floor = item.costUsd * WATCH.minCostMultiple;
  if (target < floor) {
    return {
      ok: false,
      hold: {
        kind: item.kind,
        stockRef: item.stockRef,
        reason: 'watch_feed_price_at_market',
        detail: `anchor×haircut×${WATCH.compDiscount} = ${Math.round(target)} < cost×${WATCH.minCostMultiple} = ${Math.round(floor)}`,
      },
    };
  }
  const retailUsd = round(target);
  return {
    ok: true,
    priced: {
      retailUsd,
      marginPct: margin(retailUsd, item.costUsd),
      compMidUsd: comp.midUsd,
      compAsOf: comp.asOf,
    },
  };
}
