import { LAB_TIERS as FALLBACK_RULES, NATURAL, WATCH } from '../config/pricing.js';
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

/** Naturals: Rapaport list × 0.75, held below the 20% margin floor. */
export function priceNatural(item: StoneItem): PriceResult {
  if (!item.rapPriceUsd) {
    return { ok: false, hold: { kind: item.kind, stockRef: item.stockRef, reason: 'natural_no_rap_price' } };
  }
  const retailUsd = round(item.rapPriceUsd * NATURAL.rapDiscount);
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

/** Lab-grown: tiered multiplier on feed cost, by carat. */
export function priceLab(item: StoneItem): PriceResult {
  const tier = FALLBACK_RULES.find((t) => item.carat <= t.maxCarat);
  if (!tier) {
    return { ok: false, hold: { kind: item.kind, stockRef: item.stockRef, reason: 'lab_no_markup_tier' } };
  }
  const retailUsd = round(item.costUsd * tier.multiplier);
  return { ok: true, priced: { retailUsd, marginPct: margin(retailUsd, item.costUsd) } };
}

export interface WatchComp {
  midUsd: number;
  asOf?: string;
}

/**
 * Watches: Hours comp mid × 0.97, floored at cost × 1.05.
 * No comp (provider 404) → hold. Floor above comp price → the feed's price is
 * already at market → hold. Only genuinely-below-market pieces publish.
 */
export function priceWatch(item: WatchItem, comp: WatchComp | null): PriceResult {
  if (!comp) {
    return { ok: false, hold: { kind: item.kind, stockRef: item.stockRef, reason: 'watch_no_market_comp' } };
  }
  const target = comp.midUsd * WATCH.compDiscount;
  const floor = item.costUsd * WATCH.minCostMultiple;
  if (target < floor) {
    return {
      ok: false,
      hold: {
        kind: item.kind,
        stockRef: item.stockRef,
        reason: 'watch_feed_price_at_market',
        detail: `comp×${WATCH.compDiscount} = ${Math.round(target)} < cost×${WATCH.minCostMultiple} = ${Math.round(floor)}`,
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
