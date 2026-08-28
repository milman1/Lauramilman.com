import { describe, expect, it } from 'vitest';
import { DIAMOND, lmnyStoneCost } from '../config/pricing.js';
import { priceLab, priceNatural } from '../src/markup.js';
import { normalizeStones } from '../src/normalize.js';

/** Live Belgium Dia inventory row for the 5.01ct emerald invoiced at ~$71k. */
const stock350393 = {
  Stock_No: '350393',
  Shape: 'Emerald',
  Weight: '5.01',
  Color: 'G',
  Clarity: 'VS1',
  Lab: 'GIA',
  Certificate: '6233583386',
  Rap_Price: '42500',
  Buy_Price: '0',
  Buy_Price_Discount_PER: '-50.00',
  Amount: '106463',
  'Price/Carat': '21250',
  ImageLink: 'https://dnalinks.in/350393/still.jpg',
};

describe('LMNY Amount × 2/3 diamond cost', () => {
  it('is exactly two-thirds of portal Amount, matching the $71k invoice', () => {
    expect(DIAMOND.supplierAmountShare).toBe(2 / 3);
    expect(lmnyStoneCost(106_463)).toBe(70_975.33);
    expect(Math.round(lmnyStoneCost(106_463) / 1000)).toBe(71);
  });

  it('prices stock 350393 at $88,719 (1.25× the $70,975.33 cost)', () => {
    const { items, holds } = normalizeStones([stock350393], 'natural');
    expect(holds).toEqual([]);
    const stone = items[0]!;
    if (stone.kind === 'watch') throw new Error('expected a stone');
    expect(stone).toMatchObject({
      kind: 'natural',
      stockRef: '350393',
      carat: 5.01,
      listAmountUsd: 106_463,
      costUsd: 70_975.33,
    });
    const priced = priceNatural(stone);
    expect(priced.ok && priced.priced.retailUsd).toBe(88_719);
  });

  it('prefers Amount over Rap × 0.75 (the live under-wholesale bug)', () => {
    const { items } = normalizeStones([stock350393], 'natural');
    const stone = items[0]!;
    if (stone.kind === 'watch') throw new Error('expected a stone');
    expect(stone.costUsd).toBe(70_975.33);
    expect(stone.costUsd).not.toBe(31_875);
    const priced = priceNatural(stone);
    expect(priced.ok && priced.priced.retailUsd).not.toBe(31_875);
  });

  it('applies the same 2/3 share to lab-grown Amount', () => {
    const { items, holds } = normalizeStones(
      [
        {
          Stock_No: 'L-71',
          Shape: 'ROUND',
          Weight: '1.50',
          Color: 'E',
          Clarity: 'VS1',
          Lab: 'IGI',
          Amount: '900',
          Buy_Price: '400',
          ImageLink: 'https://dnalinks.in/L-71.jpg',
        },
      ],
      'lab',
    );
    expect(holds).toEqual([]);
    const stone = items[0]!;
    if (stone.kind !== 'lab') throw new Error('expected a lab stone');
    expect(stone).toMatchObject({
      kind: 'lab',
      listAmountUsd: 900,
      costUsd: 600,
    });
    const priced = priceLab(stone);
    expect(priced.ok && priced.priced.retailUsd).toBe(972); // 600 × 1.62
  });
});
