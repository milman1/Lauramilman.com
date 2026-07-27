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
  Condition: 'MINT',
  Box: 'NO',
  Paper: 'NO',
  Price: '17500',
  ImageLink: 'https://dnalinks.in/2115.jpg',
  VideoLink: 'https://dnalinks.in/2115.mp4',
};

describe('Belgium Dia real-schema diamond record', () => {
  it('maps grading fields and derives cost from Rap × (1 + buy discount)', () => {
    const { items, holds } = normalizeStones([naturalRecord], 'natural');
    expect(holds).toEqual([]);
    const s = items[0]!;
    expect(s).toMatchObject({
      stockRef: 'D3632',
      shape: 'Round',
      carat: 1.32,
      color: 'F',
      clarity: 'VS1',
      cut: 'EX',
      lab: 'GIA',
      rapPriceUsd: 20000,
      costUsd: 12000, // 20000 × (1 − 0.40)
    });
    expect(s.kind === 'natural' && s.certNumber).toBe('2205551234');
    expect(s.kind === 'natural' && s.imageUrls).toEqual(['https://dnalinks.in/KD320632/still.jpg']);
  });

  it('holds a stone with no Rap and no buy price (0-rap supplier record)', () => {
    const { holds } = normalizeStones([{ ...naturalRecord, Rap_Price: '0' }], 'natural');
    expect(holds[0]?.reason).toBe('missing_cost');
  });
});

describe('Belgium Dia real-schema watch record', () => {
  it('maps brand/model/reference, price, and Paper (singular)', () => {
    const { items, holds } = normalizeWatches([watchRecord]);
    expect(holds).toEqual([]);
    const w = items[0]!;
    expect(w).toMatchObject({ stockRef: '2115', brand: 'ROLEX', reference: '116610LV', costUsd: 17500, box: false, papers: false, isNaked: true });
    expect(w.kind === 'watch' && w.imageUrls[0]).toBe('https://dnalinks.in/2115.jpg');
  });
});
