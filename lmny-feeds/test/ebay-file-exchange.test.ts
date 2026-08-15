import { describe, expect, it } from 'vitest';
import {
  EBAY_TITLE_MAX,
  fitEbayTitle,
  fixEbayFileExchange,
  isEbayResultsFile,
  looksLikePolicyIdSuffix,
  looksTruncatedEbayTitle,
  parseEbayFileExchange,
  repairEbayTitle,
  serializeEbayFileExchange,
  stripPolicyIdSuffix,
} from '../src/ebay-file-exchange.js';

const SAMPLE = `Info,Version=1.0.0,Template=fx_category_template_EBAY_US
CustomLabel,*Title,*Description,PaymentProfileName,ShippingProfileName
w-10026,Rolex Oyster Perpetual Date 6827 Womens Pre-Owned Watch No Box/Papers,"Pre-Owned Rolex Oyster Perpetual Date 6827. Offered on its own, without box or papers.",eBay Managed Payments (24683219020),Daily Deals - 1Handling Day
w-3286,Audemars Piguet Royal Oak Selfwinding 15510ST Mens Mint Watch Full Set Box &,Pre-Owned Audemars Piguet Royal Oak Selfwinding 15510ST. Full set with box and papers. Mint condition.,eBay Managed Payments (24683219020),Daily Deals - 1Handling Day
w-6197,Audemars Piguet Royal Oak Selfwinding 26240BA.OO.1320BA.02 Mens Unworn Watch w/,"Unworn Audemars Piguet Royal Oak Selfwinding 26240BA.OO.1320BA.02 from April 2026. Offered with papers, but without the original box.",eBay Managed Payments (24683219020),Daily Deals - 1Handling Day
`;

describe('stripPolicyIdSuffix', () => {
  it('removes a trailing parenthetical number from a payment policy name', () => {
    expect(stripPolicyIdSuffix('eBay Managed Payments (24683219020)')).toBe('eBay Managed Payments');
  });

  it('leaves a plain policy name alone', () => {
    expect(stripPolicyIdSuffix('eBay Managed Payments')).toBe('eBay Managed Payments');
  });

  it('leaves a digits-only policy id alone', () => {
    expect(stripPolicyIdSuffix('123456789012')).toBe('123456789012');
    expect(looksLikePolicyIdSuffix('123456789012')).toBe(false);
  });
});

describe('repairEbayTitle', () => {
  it('completes a Full Set title truncated at Box &', () => {
    const raw = 'Audemars Piguet Royal Oak Selfwinding 15510ST Mens Mint Watch Full Set Box &';
    const desc = 'Pre-Owned Audemars Piguet Royal Oak Selfwinding 15510ST. Full set with box and papers. Mint condition.';
    const { title, changed } = repairEbayTitle(raw, desc);
    expect(changed).toBe(true);
    expect(looksTruncatedEbayTitle(title)).toBe(false);
    expect(title.length).toBeLessThanOrEqual(EBAY_TITLE_MAX);
    expect(title).toMatch(/Full Set Box & Papers|Full Set/);
  });

  it('completes a papers title truncated at Watch w/', () => {
    const raw = 'Audemars Piguet Royal Oak Selfwinding 26240BA.OO.1320BA.02 Mens Unworn Watch w/';
    const desc =
      'Unworn Audemars Piguet Royal Oak Selfwinding 26240BA.OO.1320BA.02 from April 2026. Offered with papers, but without the original box.';
    const { title, changed } = repairEbayTitle(raw, desc);
    expect(changed).toBe(true);
    expect(looksTruncatedEbayTitle(title)).toBe(false);
    expect(title.length).toBeLessThanOrEqual(EBAY_TITLE_MAX);
    expect(title).toContain('26240BA.OO.1320BA.02');
    expect(title).toMatch(/Papers/);
  });

  it('leaves a title that already fits', () => {
    const raw = 'Rolex Submariner Date 126610LN Mens Pre-Owned Watch No Box/Papers';
    expect(repairEbayTitle(raw, 'watch only').changed).toBe(false);
  });

  it('never returns more than 80 characters', () => {
    const long = 'Audemars Piguet Royal Oak Selfwinding 26240BA.OO.1320BA.02 Mens Unworn Watch Full Set Box & Papers Extra';
    expect(fitEbayTitle(long).length).toBeLessThanOrEqual(80);
  });
});

describe('fixEbayFileExchange', () => {
  it('strips the invalid payment-policy id on every row and repairs truncated titles', () => {
    const result = fixEbayFileExchange(SAMPLE);
    expect(result.rows).toHaveLength(3);
    expect(result.rows.every((r) => r.PaymentProfileName === 'eBay Managed Payments')).toBe(true);
    expect(result.rows.every((r) => r.ShippingProfileName === 'Daily Deals - 1Handling Day')).toBe(true);

    const payChanges = result.changes.filter((c) => c.field === 'PaymentProfileName');
    expect(payChanges).toHaveLength(3);
    expect(payChanges[0]?.from).toBe('eBay Managed Payments (24683219020)');

    const titles = Object.fromEntries(result.rows.map((r) => [r.CustomLabel, r['*Title']]));
    expect(titles['w-10026']).toBe('Rolex Oyster Perpetual Date 6827 Womens Pre-Owned Watch No Box/Papers');
    expect(titles['w-3286']!.length).toBeLessThanOrEqual(80);
    expect(titles['w-6197']!.length).toBeLessThanOrEqual(80);
    expect(looksTruncatedEbayTitle(titles['w-3286']!)).toBe(false);
    expect(looksTruncatedEbayTitle(titles['w-6197']!)).toBe(false);
  });

  it('honors --payment-profile override', () => {
    const result = fixEbayFileExchange(SAMPLE, { paymentProfileName: 'eBay Payments' });
    expect(result.rows.every((r) => r.PaymentProfileName === 'eBay Payments')).toBe(true);
  });

  it('round-trips Info line, headers, and quoted commas', () => {
    const result = fixEbayFileExchange(SAMPLE);
    const csv = serializeEbayFileExchange(result.infoLine, result.headers, result.rows);
    const again = parseEbayFileExchange(csv);
    expect(again.infoLine).toBe('Info,Version=1.0.0,Template=fx_category_template_EBAY_US');
    expect(again.rows[0]?.['*Description']).toContain('without box or papers');
    expect(again.rows[0]?.PaymentProfileName).toBe('eBay Managed Payments');
  });

  it('writes UTF-8 BOM and CRLF so Seller Hub can identify the template', () => {
    const result = fixEbayFileExchange(SAMPLE);
    const csv = serializeEbayFileExchange(result.infoLine, result.headers, result.rows);
    expect(csv.startsWith('\uFEFFInfo,Version=1.0.0,Template=fx_category_template_EBAY_US\r\n')).toBe(true);
    expect(csv.includes('\n') && !csv.replace(/\r\n/g, '').includes('\n')).toBe(true);
  });

  it('rejects an eBay results file instead of treating it as a template', () => {
    const results = '\uFEFFLine Number,Action,Status,ErrorCode\n2,Add,Failure,21917328\n';
    expect(isEbayResultsFile(results)).toBe(true);
    expect(() => fixEbayFileExchange(results)).toThrow(/results\/error file/);
  });
});
