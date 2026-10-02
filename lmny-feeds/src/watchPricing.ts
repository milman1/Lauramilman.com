/**
 * Watch retail from supplier unit cost only. No Hours / market mid.
 *
 * The sale rule lives in `config/pricing.ts` (`WATCH_SALE`) — the single
 * source of truth. Retail is the lowest $100 price that leaves the required
 * share of the selling price after the eBay watch fee and seller-paid shipping.
 */

import {
  EBAY_WATCH_FEE,
  WATCH_RETAIL_CAP_BY_STOCK,
  WATCH_SALE,
} from '../config/pricing.js';

export { EBAY_WATCH_FEE, WATCH_RETAIL_CAP_BY_STOCK, WATCH_SALE };

export type WatchPricingOutcome =
  | { status: 'priced'; retailUsd: number }
  | { status: 'excluded'; reason: 'aftermarket' }
  | { status: 'no_cost' };

export interface WatchPricingInput {
  /** Supplier unit cost in USD. Missing / ≤0 → no_cost. */
  costUsd?: number | null;
  /** Feed stock number. When set, a retail ceiling in the chart may apply. */
  stockRef?: string | null;
  /** Feed condition aftermarket — excluded entirely. */
  aftermarket?: boolean;
}

/** Round up to the next $100 (already on a hundred stays put). */
export function roundUpTo100(usd: number): number {
  if (!(usd > 0)) return 0;
  // Subtract a tiny epsilon so float noise does not jump an extra hundred.
  return Math.ceil((usd - 1e-6) / 100) * 100;
}

/** Seller-paid postage, signature, packing, and jewelry insurance. */
export function watchShippingUsd(priceUsd: number): number {
  if (!(priceUsd > 0)) return WATCH_SALE.shippingFlatUsd;
  return WATCH_SALE.shippingFlatUsd + WATCH_SALE.shippingInsuranceRate * priceUsd;
}

/** eBay Watches, Parts & Accessories final value fee, plus the per-order fee. */
export function ebayWatchFeeUsd(priceUsd: number): number {
  if (!(priceUsd > 0)) return EBAY_WATCH_FEE.perOrderUsd;
  let fee = EBAY_WATCH_FEE.perOrderUsd;
  let prev = 0;
  let left = priceUsd;
  for (const band of EBAY_WATCH_FEE.bands) {
    const slice = Math.min(left, band.upToUsd - prev);
    if (slice > 0) fee += slice * band.rate;
    left -= slice;
    prev = band.upToUsd;
    if (left <= 1e-9) break;
  }
  return fee;
}

/** Price minus the eBay watch fee, seller-paid shipping, and cost. */
export function watchNetAfterSaleUsd(priceUsd: number, costUsd: number): number {
  return priceUsd - ebayWatchFeeUsd(priceUsd) - watchShippingUsd(priceUsd) - costUsd;
}

interface FeeSpan {
  start: number;
  end: number;
  rate: number;
}

function feeSpans(): FeeSpan[] {
  const spans: FeeSpan[] = [];
  let start = 0;
  for (const band of EBAY_WATCH_FEE.bands) {
    spans.push({ start, end: band.upToUsd, rate: band.rate });
    start = band.upToUsd;
  }
  return spans;
}

/**
 * Unrounded price that leaves `marginOfPrice` of the price after the eBay
 * watch fee and seller-paid shipping. The fee is piecewise linear, so the
 * closed form is solved per band and the band that contains the result wins.
 */
function rawRetailLeavingMargin(costUsd: number, marginOfPrice: number): number {
  const insurance = WATCH_SALE.shippingInsuranceRate;
  const flat = WATCH_SALE.shippingFlatUsd;
  const spans = feeSpans();
  for (let i = spans.length - 1; i >= 0; i--) {
    const span = spans[i]!;
    const feeAtStart = span.start === 0 ? EBAY_WATCH_FEE.perOrderUsd : ebayWatchFeeUsd(span.start);
    const denom = 1 - insurance - marginOfPrice - span.rate;
    if (!(denom > 0)) {
      throw new Error(`Watch pricing: margin ${marginOfPrice} does not fit fee rate ${span.rate}`);
    }
    const numer = costUsd + flat + feeAtStart - span.rate * span.start;
    const candidate = numer / denom;
    const inSpan = candidate >= span.start - 1e-6 && candidate <= span.end + 1e-6;
    const aboveTop = i === spans.length - 1 && candidate >= span.start - 1e-6;
    if (inSpan || aboveTop) return Math.max(candidate, 0);
  }
  return costUsd + flat;
}

/**
 * Lowest $100 price that leaves `marginOfPrice` of the price after the eBay
 * watch fee and seller-paid shipping. `0` is the break-even price.
 */
export function minRetailLeavingMargin(costUsd: number, marginOfPrice: number): number {
  if (!(costUsd > 0) || !Number.isFinite(costUsd)) {
    throw new Error(`Watch pricing: invalid cost ${costUsd}`);
  }
  if (!(marginOfPrice >= 0) || marginOfPrice >= 1 || !Number.isFinite(marginOfPrice)) {
    throw new Error(`Watch pricing: invalid margin ${marginOfPrice}`);
  }
  let price = roundUpTo100(rawRetailLeavingMargin(costUsd, marginOfPrice));
  if (price < 100) price = 100;
  while (watchNetAfterSaleUsd(price, costUsd) + 1e-6 < marginOfPrice * price) price += 100;
  return price;
}

/**
 * Standard retail. A price under $10,000 leaves 10% of the sale. Above
 * $10,000 it leaves 5%. The result never falls below $10,000 once the 10%
 * price has crossed that line, so retail does not step down as cost rises.
 */
export function retailFromCost(costUsd: number): number {
  const rich = minRetailLeavingMargin(costUsd, WATCH_SALE.higherMinNetMarginOfPrice);
  if (rich <= WATCH_SALE.higherMarginMaxPriceUsd) return rich;
  const thin = minRetailLeavingMargin(costUsd, WATCH_SALE.minNetMarginOfPrice);
  return Math.max(thin, WATCH_SALE.higherMarginMaxPriceUsd);
}

/**
 * Standard retail, then a stock-number ceiling when that ceiling still nets
 * at least cost after the eBay watch fee and shipping. A ceiling that would
 * not is ignored.
 */
export function retailForWatch(costUsd: number, stockRef?: string | null): number {
  const standard = retailFromCost(costUsd);
  const floor = minRetailLeavingMargin(costUsd, 0);
  const cap = stockRef ? WATCH_RETAIL_CAP_BY_STOCK[stockRef] : undefined;
  if (cap != null && cap < standard && cap >= floor) return cap;
  return standard;
}

/**
 * Price a feed watch from supplier cost.
 *
 * Outcomes:
 *  - priced        → safe to publish / update variant price
 *  - excluded      → aftermarket; do not import
 *  - no_cost       → missing cost; do not publish / do not overwrite price
 */
export function priceWatchFromCost(input: WatchPricingInput): WatchPricingOutcome {
  if (input.aftermarket) {
    return { status: 'excluded', reason: 'aftermarket' };
  }

  const cost = input.costUsd;
  if (cost == null || !(cost > 0) || !Number.isFinite(cost)) {
    return { status: 'no_cost' };
  }

  return { status: 'priced', retailUsd: retailForWatch(cost, input.stockRef) };
}
