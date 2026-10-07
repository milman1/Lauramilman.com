import {
  DIAMOND,
  LAB_GUARDS,
  labRetailMultipleFromCost,
  NATURAL_PRICING,
  toBps,
} from '../config/pricing.js';
import type { CertComp, SpecComp } from './compProvider.js';
import type { Hold, PriceSource, Priced, StoneItem, WatchItem } from './types.js';
import { priceWatchFromCost } from './watchPricing.js';

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

/**
 * Lab ticket = round(Amount × chart multiple). Amount is invoice cost.
 */
function priceFromLmnyCost(item: StoneItem, multiple: number): PriceResult {
  if (!(item.costUsd > 0)) {
    return {
      ok: false,
      hold: {
        kind: item.kind,
        stockRef: item.stockRef,
        reason: 'lab_no_cost',
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
        reason: 'lab_margin_floor',
        detail: `margin ${(marginPct * 100).toFixed(1)}% < ${(DIAMOND.minMarginPct * 100).toFixed(0)}%`,
      },
    };
  }
  return { ok: true, priced: { retailUsd, marginPct } };
}

export interface NaturalComps {
  cert?: CertComp | null;
  spec?: SpecComp | null;
}

const BPS = 10_000;
const DAY_MS = 86_400_000;
const N = NATURAL_PRICING;
const GOOD_COLORS_D_H = new Set(['D', 'E', 'F', 'G', 'H']);
const WEAK_COLORS_I_L = new Set(['I', 'J', 'K', 'L']);

/** Dollars (feed) → integer cents, or undefined when null/zero/negative/unparseable. */
function costToCents(costUsd: unknown): number | undefined {
  if (typeof costUsd !== 'number' || !Number.isFinite(costUsd) || costUsd <= 0) return undefined;
  const cents = Math.round(costUsd * 100);
  return cents > 0 ? cents : undefined;
}

/** floor = max(cost × floorMult, cost + floorAbs), integer cents, rounded up. */
export function naturalFloorCents(costCents: number): number {
  const byMult = Math.ceil((costCents * toBps(N.floorMult)) / BPS);
  return Math.max(byMult, costCents + N.floorAbsCents);
}

/** k(segment) in basis points, clamped. */
export function rapKBps(item: StoneItem): number {
  const k = N.rapK;
  let bps = toBps(k.base);
  const color = item.color.trim().toUpperCase();
  const clarity = item.clarity.trim().toUpperCase();
  const cut = (item.cut ?? '').trim().toLowerCase();
  const polish = (item.polish ?? '').trim().toLowerCase();
  const sym = (item.symmetry ?? '').trim().toLowerCase();
  const fluor = (item.fluorescence ?? '').trim().toLowerCase();
  if (clarity === 'SI1' || clarity === 'SI2') bps += toBps(k.si1OrSi2);
  if (WEAK_COLORS_I_L.has(color)) bps += toBps(k.colorIJKL);
  if (item.carat < 1) bps += toBps(k.caratUnder1);
  if (item.carat >= 2) bps += toBps(k.carat2Plus);
  if ((cut === 'excellent' || cut === 'ideal') && polish === 'excellent' && sym === 'excellent') {
    bps += toBps(k.excellentCutPolishSymmetry);
  }
  if (cut === 'good' || cut === 'fair') bps += toBps(k.goodOrFairCut);
  if (['medium', 'strong', 'very strong'].includes(fluor) && GOOD_COLORS_D_H.has(color)) {
    bps += toBps(k.fluorMediumPlusOnColorDH);
  }
  return Math.min(toBps(k.max), Math.max(toBps(k.min), bps));
}

function fresh(asOf: string, now: Date): boolean {
  const t = Date.parse(asOf);
  return Number.isFinite(t) && now.getTime() - t <= N.compMaxAgeDays * DAY_MS;
}

/** First available anchor tier, in cents. Comps older than the max age or too thin are ignored. */
function naturalAnchor(
  item: StoneItem,
  costCents: number,
  comps: NaturalComps,
  now: Date,
): { anchorCents: number; source: PriceSource } {
  const undercut = toBps(N.compUndercut);
  const cert = comps.cert;
  if (cert && item.certNumber && cert.lowestCents > 0 && fresh(cert.asOf, now)) {
    return { anchorCents: Math.floor((cert.lowestCents * undercut) / BPS), source: 'cert' };
  }
  const spec = comps.spec;
  if (spec && spec.p25Cents > 0 && spec.count >= N.specCompMinCount && fresh(spec.asOf, now)) {
    return { anchorCents: Math.floor((spec.p25Cents * undercut) / BPS), source: 'spec' };
  }
  const rapPerCarat = item.rapPriceUsd;
  if (typeof rapPerCarat === 'number' && Number.isFinite(rapPerCarat) && rapPerCarat > 0) {
    // Feed Rap is per carat. Total = rap/ct × carat, in integer cents (carat in milli-carats).
    const rapTotalCents = Math.round((Math.round(rapPerCarat * 100) * Math.round(item.carat * 1000)) / 1000);
    return { anchorCents: Math.floor((rapTotalCents * rapKBps(item)) / BPS), source: 'rap' };
  }
  return { anchorCents: Math.floor((costCents * toBps(N.fallbackMultiple)) / BPS), source: 'fallback' };
}

/**
 * Natural retail: market anchor rounded down to $25, never below the floor
 * (and so never at or below cost). A stone whose anchor lands under the
 * floor is held, never rounded up.
 */
export function priceNatural(item: StoneItem, comps: NaturalComps = {}, now: Date = new Date()): PriceResult {
  const hold = (reason: string, detail?: string): PriceResult => ({
    ok: false,
    hold: { kind: item.kind, stockRef: item.stockRef, reason, detail },
  });
  const costCents = costToCents(item.costUsd);
  if (costCents === undefined) return hold('natural_no_cost');

  const floorCents = naturalFloorCents(costCents);
  const { anchorCents, source } = naturalAnchor(item, costCents, comps, now);
  const retailCents = Math.floor(anchorCents / N.roundDownCents) * N.roundDownCents;
  if (!(retailCents >= floorCents) || retailCents <= costCents) {
    return hold('natural_below_floor', `${source} retail ${retailCents}¢ < floor ${floorCents}¢ (cost ${costCents}¢)`);
  }
  return {
    ok: true,
    priced: {
      retailUsd: retailCents / 100,
      priceSource: source,
      marginPct: (retailCents - costCents) / retailCents,
    },
  };
}

/**
 * Independent write-path check, used right before a natural price is sent to
 * Shopify or the stones table. Recomputes the floor from the stone's cost and
 * does not trust the pricing function. Returns a reason string on failure.
 */
export function naturalFloorViolation(item: StoneItem, retailUsd: number): string | null {
  const costCents = costToCents(item.costUsd);
  if (costCents === undefined) return 'natural_no_cost';
  if (typeof retailUsd !== 'number' || !Number.isFinite(retailUsd)) return 'retail not a number';
  const retailCents = Math.round(retailUsd * 100);
  const floorCents = naturalFloorCents(costCents);
  if (retailCents <= costCents) return `retail ${retailCents}¢ <= cost ${costCents}¢`;
  if (retailCents < floorCents) return `retail ${retailCents}¢ < floor ${floorCents}¢`;
  return null;
}

/**
 * Lab-grown: 3× invoice cost at every size, after fail-closed mapping guards.
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

  const priced = priceFromLmnyCost(item, labRetailMultipleFromCost(item.costUsd));
  if (!priced.ok) return priced;

  if (
    item.carat >= LAB_GUARDS.minCaratForRetailFloor &&
    priced.priced.retailUsd < LAB_GUARDS.minRetailUsd
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
 * Watches: `WATCH_SALE` via watchPricing.ts. No Hours mid. Retail is the
 * lowest $100 that leaves 10% of the price after the eBay watch fee and
 * seller-paid shipping when that price is $10,000 or under, and 5% above
 * that. A stock number in `WATCH_RETAIL_CAP_BY_STOCK` may lower it only
 * while the sale still nets at least cost after shipping.
 */
export function priceWatch(item: WatchItem): PriceResult {
  const outcome = priceWatchFromCost({
    costUsd: item.costUsd,
    stockRef: item.stockRef,
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
