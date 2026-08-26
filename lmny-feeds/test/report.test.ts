import { describe, expect, it } from 'vitest';
import { renderMarkdown, type SyncReport } from '../src/report.js';

function report(overrides: Partial<SyncReport> = {}): SyncReport {
  return {
    dryRun: true,
    startedAt: '2026-08-25T00:00:00.000Z',
    finishedAt: '2026-08-25T00:01:00.000Z',
    enabledFeeds: ['watch'],
    feeds: {
      natural: { fetched: 0, publishable: 0, held: 0, skipped: true },
      lab: { fetched: 0, publishable: 0, held: 0, skipped: true },
      watch: { fetched: 10, publishable: 8, held: 2 },
    },
    holdHistogram: {},
    naturalMargins: { p25: null, median: null, p75: null, rejectedByFloor: 0 },
    labPricing: { published: 0, held: 0, bands: [], sample: [] },
    watchPricing: { lines: [] },
    watchGalleries: { none: 0, one: 3, two: 1, threePlus: 4, onePhotoRefs: ['RW3102', 'T3743'] },
    sampleNaturals: [],
    decisions: {
      create: [],
      update: [],
      delete: [],
      archive: [],
      archivedHeldInFeed: [],
      skipped: 0,
    },
    writeErrors: [],
    mediaQuarantined: [],
    mediaVideosAttached: 0,
    collectionsCreated: [],
    notes: [],
    ...overrides,
  };
}

describe('renderMarkdown watch galleries', () => {
  it('prints the hourly photo histogram and sample 1-photo SKUs', () => {
    const md = renderMarkdown(report());
    expect(md).toContain('## Watch galleries');
    expect(md).toContain('- **1 photo:** 3');
    expect(md).toContain('- **3+ photos:** 4');
    expect(md).toContain('Sample 1-photo SKUs: `RW3102`, `T3743`');
  });
});
