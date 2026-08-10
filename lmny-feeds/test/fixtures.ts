import type { Priced, StoneItem, WatchItem } from '../src/types.js';

export function naturalStone(overrides: Partial<StoneItem> = {}): StoneItem {
  return {
    kind: 'natural',
    stockRef: 'BD-1234',
    shape: 'Round Brilliant',
    carat: 2.01,
    color: 'F',
    clarity: 'VS1',
    cut: 'Excellent',
    lab: 'GIA',
    certNumber: '2205551234',
    certUrl: 'https://www.gia.edu/report-check?reportno=2205551234',
    costUsd: 10000,
    rapPriceUsd: 20000,
    imageUrls: ['https://dnalinks.in/img/BD-1234.jpg'],
    videoUrls: ['https://dnalinks.in/video/BD-1234.mp4'],
    ...overrides,
  };
}

export function labStone(overrides: Partial<StoneItem> = {}): StoneItem {
  return {
    ...naturalStone(),
    kind: 'lab',
    stockRef: 'LGD 55/7',
    lab: 'IGI',
    costUsd: 1000,
    rapPriceUsd: undefined,
    ...overrides,
  };
}

export function watch(overrides: Partial<WatchItem> = {}): WatchItem {
  return {
    kind: 'watch',
    stockRef: 'W-889',
    brand: 'Rolex',
    model: 'Submariner',
    reference: '126610LN',
    condition: 'Excellent',
    box: true,
    papers: false,
    isNaked: false,
    caseSizeMm: '41',
    metal: 'STEEL',
    dial: 'BLACK',
    bezel: 'CERACHROM',
    bracelet: 'OYSTER',
    link: '2',
    costUsd: 9000,
    imageUrls: ['https://dnalinks.in/img/W-889.jpg'],
    videoUrls: [],
    ...overrides,
  };
}

export function priced(overrides: Partial<Priced> = {}): Priced {
  return { retailUsd: 15000, marginPct: 0.33, ...overrides };
}
