import { describe, expect, it } from 'vitest';
import { METAFIELD_NAMESPACE } from '../../src/backvault/product.js';
import {
  NO_VIDEO,
  pickSupplierVideo,
  VIDEO_METAFIELD_NAMESPACE,
  VIDEO_RECHECK_DAYS,
  videoCandidateReason,
  videoMetafields,
} from '../../src/backvault/video.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-11T12:00:00Z');
const ago = (d: number) => new Date(NOW - d * DAY).toISOString();

describe('pickSupplierVideo', () => {
  it('takes the tallest MP4 up to 1080p from the first native video', () => {
    const js = {
      media: [
        { media_type: 'image' },
        {
          media_type: 'video',
          sources: [
            { format: 'mp4', height: 720, url: 'https://cdn.shopify.com/v/a-720.mp4' },
            { format: 'mp4', height: 1080, url: 'https://cdn.shopify.com/v/a-1080.mp4' },
            { format: 'mp4', height: 2160, url: 'https://cdn.shopify.com/v/a-4k.mp4' },
            { format: 'm3u8', height: 1080, url: 'https://cdn.shopify.com/v/a.m3u8' },
          ],
        },
      ],
    };
    expect(pickSupplierVideo(js)).toBe('https://cdn.shopify.com/v/a-1080.mp4');
  });

  it('is null for no media, images only, an external video, or a non-https source', () => {
    expect(pickSupplierVideo(null)).toBeNull();
    expect(pickSupplierVideo({})).toBeNull();
    expect(pickSupplierVideo({ media: [{ media_type: 'image' }] })).toBeNull();
    expect(pickSupplierVideo({ media: [{ media_type: 'external_video', host: 'youtube' }] })).toBeNull();
    expect(
      pickSupplierVideo({ media: [{ media_type: 'video', sources: [{ format: 'mp4', height: 720, url: 'http://x/a.mp4' }] }] }),
    ).toBeNull();
  });
});

describe('videoCandidateReason', () => {
  const entry = (o: Partial<{ status: string; videoCount: number; source: string | null; checkedAt: string | null }>) => ({
    status: o.status ?? 'ACTIVE',
    videoCount: o.videoCount ?? 0,
    video: { source: o.source ?? null, checkedAt: o.checkedAt ?? null },
  });

  it('looks up a piece never checked, and one whose attached video went missing', () => {
    expect(videoCandidateReason(entry({}), NOW)).toBe('never_checked');
    expect(videoCandidateReason(entry({ source: 'https://cdn.shopify.com/v/a.mp4', checkedAt: ago(1) }), NOW)).toBe('video_missing');
  });

  it('trusts a recent "none" and rechecks an old or undated one', () => {
    expect(videoCandidateReason(entry({ source: NO_VIDEO, checkedAt: ago(VIDEO_RECHECK_DAYS - 1) }), NOW)).toBeNull();
    expect(videoCandidateReason(entry({ source: NO_VIDEO, checkedAt: ago(VIDEO_RECHECK_DAYS + 1) }), NOW)).toBe('recheck');
    expect(videoCandidateReason(entry({ source: NO_VIDEO, checkedAt: null }), NOW)).toBe('recheck');
  });

  it('never touches a draft or a piece that already has a video', () => {
    expect(videoCandidateReason(entry({ status: 'DRAFT' }), NOW)).toBeNull();
    expect(videoCandidateReason(entry({ videoCount: 1 }), NOW)).toBeNull();
  });
});

describe('videoMetafields', () => {
  it('writes into the feed namespace, and nothing when nothing is remembered', () => {
    expect(VIDEO_METAFIELD_NAMESPACE).toBe(METAFIELD_NAMESPACE);
    expect(videoMetafields(undefined)).toEqual([]);
    expect(videoMetafields({ source: null, checkedAt: null })).toEqual([]);
    expect(videoMetafields({ source: NO_VIDEO, checkedAt: ago(0) }).map((f) => f.key)).toEqual(['video_source', 'video_checked_at']);
  });
});
