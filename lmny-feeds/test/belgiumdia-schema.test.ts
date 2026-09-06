import { describe, expect, it } from 'vitest';
import { normalizeStones, normalizeWatches } from '../src/normalize.js';

// Records shaped exactly like the Belgium Dia developer API responses.
const naturalRecord = {
  Stock_No: 'D3632',
  Shape: 'Round',
  Weight: '1.32',
  Color: 'F',
  Clarity: 'VS1',
  Cut_Grade: 'EX',
  Polish: 'EX',
  Symmetry: 'EX',
  Fluorescence_Intensity: 'M',
  Measurements: '6.97 X 7.02 X 4.36',
  Lab: 'GIA',
  Certificate: '2205551234',
  CertificateLink: 'https://www.gia.edu/report-check?reportno=2205551234',
  Rap_Price: '20000',
  Buy_Price: '0',
  Buy_Price_Discount_PER: '-40.00',
  ImageLink: 'https://dnalinks.in/KD320632/still.jpg',
  VideoLink: '',
};

const watchRecord = {
  Stock: '2115',
  Brand: 'ROLEX',
  Model: 'SUBMARINER DATE',
  Reference: '116610LV',
  Year: '2014',
  Condition: 'MINT',
  Box: 'NO',
  Paper: 'NO',
  MM: '40',
  Metal: 'STEEL',
  Bracelet: 'OYSTER',
  Dial: 'GREEN',
  Bezel: 'CERACHROM',
  Links: '2',
  Comment: 'NAKED',
  Price: '17500',
  ImageLink: 'https://dnalinks.in/2115.jpg',
  VideoLink: 'https://dnalinks.in/2115.mp4',
};

describe('Belgium Dia real-schema diamond record', () => {
  it('maps grading fields and uses Amount-equivalent as invoice cost', () => {
    const { items, holds } = normalizeStones([naturalRecord], 'natural');
    expect(holds).toEqual([]);
    const s = items[0]!;
    expect(s).toMatchObject({
      stockRef: 'D3632',
      shape: 'Round',
      carat: 1.32,
      color: 'F',
      clarity: 'VS1',
      cut: 'Excellent', // feed says EX
      lab: 'GIA',
      rapPriceUsd: 20000,
      // Rap $20,000/ct × 60% × 1.32ct = $15,840 (Amount fallback = cost)
      listAmountUsd: 15840,
      costUsd: 15840,
    });
    expect(s.kind === 'natural' && s.certNumber).toBe('2205551234');
    expect(s.kind === 'natural' && s.imageUrls).toEqual(['https://dnalinks.in/KD320632/still.jpg']);
  });

  it('holds a stone with no Rap and no buy price (0-rap supplier record)', () => {
    const { holds } = normalizeStones([{ ...naturalRecord, Rap_Price: '0' }], 'natural');
    expect(holds[0]?.reason).toBe('missing_cost');
  });
});

/** Lab feed uses the same PascalCase schema; colour/clarity/cut must all land. */
const labRecord = {
  Stock_No: 'L919753',
  Shape: 'ROUND',
  Weight: '2.22',
  Color: 'F',
  Clarity: 'VVS2',
  Cut_Grade: 'I', // IGI Ideal
  Polish: 'EX',
  Symmetry: 'EX',
  Fluorescence_Intensity: 'NON',
  Measurements: '6.79 - 6.84 x 4.21',
  Lab: 'IGI',
  Certificate: '6455949159',
  CertificateLink: 'https://www.igi.org/verify-your-report/?r=6455949159',
  Buy_Price: '480',
  ImageLink: 'https://dnalinks.in/L919753/still.jpg',
  VideoLink: '',
};

describe('Belgium Dia real-schema lab record', () => {
  it('maps colour, clarity and cut the same way as naturals', () => {
    const { items, holds } = normalizeStones([labRecord], 'lab');
    expect(holds).toEqual([]);
    expect(items[0]).toMatchObject({
      kind: 'lab',
      stockRef: 'L919753',
      shape: 'Round',
      carat: 2.22,
      color: 'F',
      clarity: 'VVS2',
      cut: 'Ideal',
      lab: 'IGI',
      // Buy_Price is per-carat → cost = 480 × 2.22 = 1065.6
      listAmountUsd: 1065.6,
      pricePerCaratUsd: 480,
      costUsd: 1065.6,
    });
  });

  it('multiplies Buy_Price by carat across size bands (the live bug was using Buy_Price as total)', () => {
    const rows = [
      { ...labRecord, Stock_No: 'A', Weight: '2.00', Buy_Price: '120' },
      { ...labRecord, Stock_No: 'B', Weight: '2.50', Buy_Price: '120' },
      { ...labRecord, Stock_No: 'C', Weight: '3.00', Buy_Price: '120' },
      { ...labRecord, Stock_No: 'D', Weight: '4.00', Buy_Price: '120' },
      { ...labRecord, Stock_No: 'E', Weight: '6.00', Buy_Price: '120' },
      { ...labRecord, Stock_No: 'F', Weight: '10.00', Buy_Price: '120' },
    ];
    const { items, holds } = normalizeStones(rows, 'lab');
    expect(holds).toEqual([]);
    const costs = items.map((i) => (i.kind === 'lab' ? i.costUsd : 0));
    expect(costs).toEqual([240, 300, 360, 480, 720, 1200]);
  });
});

describe('Belgium Dia real-schema watch record', () => {
  it('maps brand/model/reference, price, Paper (singular), and physical specs', () => {
    const { items, holds } = normalizeWatches([watchRecord]);
    expect(holds).toEqual([]);
    const w = items[0]!;
    expect(w).toMatchObject({
      stockRef: '2115',
      brand: 'ROLEX',
      reference: '116610LV',
      costUsd: 17500,
      box: false,
      papers: false,
      isNaked: true,
      year: '2014',
      caseSizeMm: '40',
      metal: 'STEEL',
      dial: 'GREEN',
      bezel: 'CERACHROM',
      bracelet: 'OYSTER',
      link: '2',
      comment: 'NAKED',
    });
    expect(w.kind === 'watch' && w.imageUrls[0]).toBe('https://dnalinks.in/2115.jpg');
  });

  it('maps the live API Links field (plural) and keeps negative link counts', () => {
    const { items, holds } = normalizeWatches([{ ...watchRecord, Stock: '10005', Links: '-5' }]);
    expect(holds).toEqual([]);
    expect(items[0]).toMatchObject({ stockRef: '10005', link: '-5' });
  });
});
