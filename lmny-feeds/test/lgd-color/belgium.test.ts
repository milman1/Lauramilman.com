import { describe, expect, it } from 'vitest';
import { BELGIUM_TAG, FEED_TAG, normalizeRow, ownsBelgium, ownsLgd, payloadFor } from '../../src/lgd-color/catalog.mjs';
import { planFor } from '../../src/lgd-color/sync.mjs';
import { fetchBelgiumLabRows, isColoredRow, normalizeBelgiumFeed, normalizeBelgiumRow, parseColor } from '../../src/lgd-color/belgium.js';

const row = (over: Record<string, unknown> = {}) => ({
  Stock_No: 'BX100', Shape: 'OVAL', Color: 'PINK', Fancy_Color_Intensity: 'Fancy Intense', Clarity: 'VS1',
  Weight: '2.00', Buy_Price: '150', Lab: 'IGI', Report_No: 'LG612345678',
  CertificateLink: 'https://api.igi.org/viewpdf.php?r=x/LG612345678.pdf',
  ImageLink: 'https://cdn.example.com/stone.jpg', VideoLink: 'https://cdn.example.com/stone.mp4',
  ...over,
});

describe('Belgium Dia colored lab stones', () => {
  it('only takes rows the white sync cannot list', () => {
    expect(isColoredRow(row())).toBe(true);
    expect(isColoredRow(row({ Color: 'E' }))).toBe(false);
    expect(normalizeBelgiumFeed([row({ Color: 'G' })]).stones).toHaveLength(0);
  });

  it('prices on the white lab-grown tiers from Buy_Price x Weight, same as LGD', () => {
    const stone = normalizeBelgiumRow(row()).stone!;
    expect(stone).toMatchObject({ cost: 300, retail: 675, handle: 'lg-color-bd-bx100', color: 'Pink', intensity: 'Fancy Intense', certificate: 'LG612345678', sourceTag: BELGIUM_TAG });
  });

  it('reads intensity from the Color value when the intensity field is blank', () => {
    expect(parseColor('FANCY VIVID GREEN', '')).toEqual({ color: 'GREEN', intensity: 'Fancy Vivid' });
    expect(parseColor('BLUE', 'FANCY')).toEqual({ color: 'BLUE', intensity: 'Fancy' });
  });

  it('holds what LGD rules would not list instead of guessing', () => {
    const reason = (over: Record<string, unknown>) => normalizeBelgiumRow(row(over)).reason;
    expect(reason({ Color: 'YELLOWISH GREEN' })).toBe('scope');
    expect(reason({ Fancy_Color_Intensity: '' })).toBe('scope');
    expect(reason({ Lab: 'GIA' })).toBe('lab_not_igi');
    expect(reason({ Clarity: 'I1' })).toBe('grading_or_certificate');
    expect(reason({ Report_No: '', CertificateLink: '' })).toBe('grading_or_certificate');
    expect(reason({ VideoLink: 'https://v360.example.com/viewer/BX100' })).toBe('photo_or_video');
    expect(reason({ ImageLink: 'http://cdn.example.com/stone.jpg' })).toBe('photo_or_video');
    expect(reason({ Availability: 'Memo' })).toBe('unavailable');
    expect(reason({ Buy_Price: '' })).toBe('cost_mismatch');
  });

  it('refuses a per-carat price that reads as a total', () => {
    expect(normalizeBelgiumRow(row({ Weight: '3.00', Buy_Price: '1' })).reason).toBe('cost_mismatch');
  });

  it('builds the same listing as LGD, plus its own source tag', () => {
    const stone = normalizeBelgiumRow(row()).stone!;
    const p = payloadFor(stone, undefined, 'DRAFT');
    expect(p.status).toBe('DRAFT');
    expect(p.tags).toEqual(expect.arrayContaining([FEED_TAG, BELGIUM_TAG, 'Colored Lab-Grown Diamond', 'Pink', 'Fancy Intense']));
    expect(p.title).toBe('2.00ct Oval Lab-Grown Diamond — Fancy Intense Pink VS1, IGI Certified');
    expect(p.variants[0].price).toBe('675.00');
  });

  it('listing copy meets the SEO/GEO guide for loose diamonds', () => {
    const scrubbed = (v: string) => !/belgium|lgd|supplier|stunning|must-have|breathtaking|ethical|sustainable/i.test(v);
    for (const over of [{}, { Shape: 'CUSHION BRILLIANT', Color: 'YELLOW', Fancy_Color_Intensity: 'Fancy Intense', Clarity: 'VVS2', Weight: '12.34', Measurements: '12.01x10.55x7.30' }]) {
      const p = payloadFor(normalizeBelgiumRow(row(over)).stone!, undefined, 'DRAFT');
      expect(p.title).toMatch(/^\d+\.\d\dct [A-Za-z ]+ Lab-Grown Diamond — Fancy [A-Za-z ]+ [A-Z0-9]+, IGI Certified$/);
      expect(p.seo.title.length).toBeLessThanOrEqual(60);
      expect(p.seo.title).toMatch(/ \| IGI$/);
      expect(p.seo.title).toMatch(/Pink|Yellow/);
      expect(p.seo.description.length).toBeLessThanOrEqual(160);
      expect(p.descriptionHtml).toMatch(/^<p>[^<]+<\/p>$/);
      const words = p.descriptionHtml.replace(/<[^>]+>/g, '').split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(40);
      expect(words).toBeLessThanOrEqual(60);
      for (const v of [p.title, p.seo.title, p.seo.description, p.descriptionHtml]) expect(scrubbed(v)).toBe(true);
      const meta = Object.fromEntries(p.metafields.map((m: { key: string; value: string }) => [m.key, m.value]));
      expect(p.title).toContain(meta.color);
      expect(p.descriptionHtml).toContain(meta.clarity);
    }
  });

  it('each source owns, and withdraws, only its own stones', () => {
    const bd = { id: 'b', handle: 'lg-color-bd-gone', tags: [FEED_TAG, BELGIUM_TAG], status: 'ACTIVE' };
    const lgd = { id: 'l', handle: 'lg-color-gone', tags: [FEED_TAG], status: 'ACTIVE' };
    expect([ownsBelgium(bd), ownsLgd(bd), ownsBelgium(lgd), ownsLgd(lgd)]).toEqual([true, false, false, true]);
    const stone = normalizeBelgiumRow(row()).stone!;
    expect(planFor([stone], [bd, lgd], { owns: ownsBelgium }).holds.map((h: { handle: string }) => h.handle)).toEqual(['lg-color-bd-gone']);
    const lgdStone = normalizeRow({ Stock_No: 'L1', Shape: 'OVAL', Color: 'BLUE', Fancy_Color_Intensity: 'Fancy', Clarity: 'VS1', Weight: '1', Buy_Price: '200', Buy_Price_Total: '200', Diamond_Type: 'Lab Grown', Lab: 'IGI', Availability: 'Available', ImageLink: 'https://e.com/a.jpg', Video_HTML: 'https://e.com/a.mp4', CertificateLink: 'https://e.com/LG99999999.pdf' }).stone!;
    expect(planFor([lgdStone], [bd, lgd]).holds.map((h: { handle: string }) => h.handle)).toEqual(['lg-color-gone']);
  });

  it('skips a stone whose IGI report is already listed by LGD', () => {
    const stone = normalizeBelgiumRow(row()).stone!;
    const lgdListing = { id: 'l', handle: 'lg-color-x1', tags: [FEED_TAG], status: 'ACTIVE', certificate: 'LG612345678' };
    const plan = planFor([stone], [lgdListing], { owns: ownsBelgium });
    expect(plan.writes).toHaveLength(0);
    expect(plan.skipped).toEqual([expect.objectContaining({ reason: 'duplicate_certificate' })]);
    expect(plan.holds).toHaveLength(0);
  });

  it('an LGD stock starting with bd- cannot take over the Belgium handle space', () => {
    expect(normalizeRow({ Stock_No: 'bd-1' }).reason).toBe('stock');
  });

  it('refuses a short feed so a truncated read cannot withdraw stones', async () => {
    await expect(fetchBelgiumLabRows(async () => [row()])).rejects.toThrow(/refusing to sync/);
  });
});
