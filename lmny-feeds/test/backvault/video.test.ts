import { describe, expect, it } from 'vitest';
import { METAFIELD_NAMESPACE } from '../../src/backvault/product.js';
import {
  NO_VIDEO,
  pickSupplierVideo,
  primaryVideoUrl,
  VIDEO_METAFIELD_NAMESPACE,
  VIDEO_RECHECK_DAYS,
  videoCandidateReason,
  videoMetafields,
  videoRecordWrite,
} from '../../src/backvault/video.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-11T12:00:00Z');
const ago = (d: number) => new Date(NOW - d * DAY).toISOString();
const CDN = 'https://cdn.shopify.com/videos/c/vp/a/';

describe('pickSupplierVideo', () => {
  const js = {
    media: [
      { media_type: 'image' },
      {
        media_type: 'video',
        duration: 26100,
        preview_image: { src: 'https://cdn.shopify.com/s/files/1/x/preview_images/a.thumbnail.jpg' },
        sources: [
          { format: 'mp4', height: 480, url: CDN + 'a-480.mp4' },
          { format: 'mp4', height: 720, url: CDN + 'a-720.mp4' },
          { format: 'mp4', height: 1080, url: CDN + 'a-1080.mp4' },
          { format: 'mp4', height: 2160, url: CDN + 'a-4k.mp4' },
          { format: 'm3u8', height: 1080, url: CDN + 'a.m3u8' },
        ],
      },
    ],
  };

  it('orders HLS first, then 1080p and 720p MP4, with the poster and duration', () => {
    const v = pickSupplierVideo(js)!;
    expect(v.sources.map((s) => [s.type, s.height])).toEqual([
      ['application/x-mpegURL', 1080],
      ['video/mp4', 1080],
      ['video/mp4', 720],
    ]);
    expect(v.poster).toContain('a.thumbnail.jpg');
    expect(v.durationMs).toBe(26100);
    expect(primaryVideoUrl(v)).toBe(CDN + 'a-1080.mp4');
  });

  it('takes a lone small MP4 rather than nothing', () => {
    const v = pickSupplierVideo({ media: [{ media_type: 'video', sources: [{ format: 'mp4', height: 480, url: CDN + 'b.mp4' }] }] })!;
    expect(v.sources).toEqual([{ url: CDN + 'b.mp4', type: 'video/mp4', height: 480 }]);
    expect(v.poster).toBeNull();
  });

  it('is null for no media, images only, an external video, or a file off cdn.shopify.com', () => {
    expect(pickSupplierVideo(null)).toBeNull();
    expect(pickSupplierVideo({})).toBeNull();
    expect(pickSupplierVideo({ media: [{ media_type: 'image' }] })).toBeNull();
    expect(pickSupplierVideo({ media: [{ media_type: 'external_video', host: 'youtube' }] })).toBeNull();
    expect(
      pickSupplierVideo({ media: [{ media_type: 'video', sources: [{ format: 'mp4', height: 720, url: 'https://example.com/a.mp4' }] }] }),
    ).toBeNull();
  });
});

describe('videoCandidateReason', () => {
  const entry = (o: Partial<{ status: string; videoCount: number; source: string | null; checkedAt: string | null; feedVideo: string | null }>) => ({
    status: o.status ?? 'ACTIVE',
    videoCount: o.videoCount ?? 0,
    video: { source: o.source ?? null, checkedAt: o.checkedAt ?? null, feedVideo: o.feedVideo ?? null },
  });

  it('looks up a piece never checked, and one whose saved video data is missing', () => {
    expect(videoCandidateReason(entry({}), NOW)).toBe('never_checked');
    expect(videoCandidateReason(entry({ source: CDN + 'a.mp4', checkedAt: ago(1) }), NOW)).toBe('video_missing');
    expect(videoCandidateReason(entry({ source: CDN + 'a.mp4', checkedAt: ago(1), feedVideo: '{}' }), NOW)).toBeNull();
  });

  it('trusts a recent "none" and rechecks an old or undated one', () => {
    expect(videoCandidateReason(entry({ source: NO_VIDEO, checkedAt: ago(VIDEO_RECHECK_DAYS - 1) }), NOW)).toBeNull();
    expect(videoCandidateReason(entry({ source: NO_VIDEO, checkedAt: ago(VIDEO_RECHECK_DAYS + 1) }), NOW)).toBe('recheck');
    expect(videoCandidateReason(entry({ source: NO_VIDEO, checkedAt: null }), NOW)).toBe('recheck');
  });

  it('never touches a draft or a piece that already has a video of its own', () => {
    expect(videoCandidateReason(entry({ status: 'DRAFT' }), NOW)).toBeNull();
    expect(videoCandidateReason(entry({ videoCount: 1 }), NOW)).toBeNull();
  });
});

describe('video metafields', () => {
  it('writes into the feed namespace, and nothing when nothing is remembered', () => {
    expect(VIDEO_METAFIELD_NAMESPACE).toBe(METAFIELD_NAMESPACE);
    expect(videoMetafields(undefined)).toEqual([]);
    expect(videoMetafields({ source: null, checkedAt: null })).toEqual([]);
  });

  it('records "none" without player data, and a found video with it', () => {
    expect(videoRecordWrite('gid://p/1', null, ago(0)).map((f) => f.key)).toEqual(['video_source', 'video_checked_at']);
    const found = { sources: [{ url: CDN + 'a.mp4', type: 'video/mp4', height: 720 }], poster: null, durationMs: null };
    const fields = videoRecordWrite('gid://p/1', found, ago(0));
    expect(fields.map((f) => f.key)).toEqual(['video_source', 'video_checked_at', 'video']);
    expect(fields[2]).toMatchObject({ ownerId: 'gid://p/1', type: 'json', value: JSON.stringify(found) });
  });
});
