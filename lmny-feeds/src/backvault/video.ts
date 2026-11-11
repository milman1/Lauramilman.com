/**
 * Supplier product videos for estate pieces (merchant decisions 2026-11-11).
 *
 * The supplier's products.json, which the sync reads, has no video. Its
 * per-product `/products/<handle>.js` does: a Shopify-hosted turntable on about
 * one piece in six (sampled 2026-11-11; every video checked was a plain
 * white-background shot with no logo, watermark or text).
 *
 * The video is NOT copied into this store. The first live run tried that and
 * hit the plan's cap of 250 videos and 3D models ("Your plan does not permit
 * more than 250 videos and 3D models"). Instead the piece remembers the
 * supplier's own renditions (HLS, 1080p and 720p MP4 on cdn.shopify.com — no
 * supplier name in the URL) and its poster, and the theme plays them first in
 * the gallery (sections/main-product.liquid), hiding the slide if the file is
 * ever gone. This is how loose-diamond videos already work.
 *
 * Metafields on the product:
 *
 *   backvault_feed.video             json: { sources, poster, durationMs }, the
 *                                    player data the theme reads; absent when
 *                                    the piece has no video
 *   backvault_feed.video_source      the primary MP4 URL, or "none"
 *   backvault_feed.video_checked_at  when that was decided
 *
 * productSet deletes metafields it is not sent, so buildProductSetInput carries
 * all three through every rewrite (videoMetafields below).
 *
 * A piece is a candidate when it is ACTIVE, in this run's in-stock set, has no
 * video of its own on Shopify, and either:
 *  - nothing is remembered (never looked up),
 *  - a video was found but its player data is missing, or
 *  - "none" was decided more than VIDEO_RECHECK_DAYS ago (the supplier may
 *    have filmed it since), or the date cannot be read.
 */

/**
 * The feed's own metafield namespace (product.ts METAFIELD_NAMESPACE), written
 * out here so this module and product.ts do not import each other.
 */
export const VIDEO_METAFIELD_NAMESPACE = 'backvault_feed';

/** Supplier lookups per run. The live catalog (~670 pieces) is covered in about five runs. */
export const VIDEO_LOOKUP_BUDGET = 150;
/** Pause between supplier lookups. 126 back-to-back lookups drew HTTP 429 on 2026-11-11. */
export const VIDEO_LOOKUP_DELAY_MS = 1500;
/** How long a "no video" answer is trusted before the supplier is asked again. */
export const VIDEO_RECHECK_DAYS = 30;
/** The stored value for "the supplier has no video for this piece". */
export const NO_VIDEO = 'none';

const HLS_TYPE = 'application/x-mpegURL';
const DAY_MS = 24 * 60 * 60 * 1000;

export interface VideoSource {
  url: string;
  /** MIME type for the <source> tag. */
  type: string;
  height: number;
}

/** What the theme needs to play a supplier video. */
export interface FeedVideo {
  /**
   * In the order a browser should try them: HLS first (Safari and iOS stream
   * it adaptively), then MP4 from the tallest rendition up to 1080p down to
   * 720p. Other browsers skip HLS and take the first MP4 they can play.
   */
  sources: VideoSource[];
  poster: string | null;
  durationMs: number | null;
}

export interface VideoRecord {
  /** The primary MP4 URL, or NO_VIDEO. */
  source: string | null;
  checkedAt: string | null;
  /** The raw `backvault_feed.video` JSON, carried through rewrites untouched. */
  feedVideo?: string | null;
}

interface RawMediaSource {
  format?: unknown;
  url?: unknown;
  height?: unknown;
  mime_type?: unknown;
}

interface RawMedia {
  media_type?: unknown;
  sources?: unknown;
  duration?: unknown;
  preview_image?: { src?: unknown } | null;
}

const isHttps = (u: unknown): u is string => typeof u === 'string' && /^https:\/\/cdn\.shopify\.com\//.test(u);

/**
 * The player data for the first native video in a supplier
 * `/products/<handle>.js` body. External videos (YouTube, Vimeo) are skipped.
 * Only cdn.shopify.com URLs are kept. Null when the piece has no usable video.
 */
export function pickSupplierVideo(productJs: unknown): FeedVideo | null {
  if (productJs === null || typeof productJs !== 'object') return null;
  const media = (productJs as { media?: unknown }).media;
  if (!Array.isArray(media)) return null;
  for (const m of media as RawMedia[]) {
    if (m?.media_type !== 'video' || !Array.isArray(m.sources)) continue;
    const raw = m.sources as RawMediaSource[];
    const height = (s: RawMediaSource) => (typeof s.height === 'number' ? s.height : 0);
    const mp4 = raw
      .filter((s) => s?.format === 'mp4' && isHttps(s.url) && height(s) >= 720 && height(s) <= 1080)
      .sort((a, b) => height(b) - height(a))
      .map((s) => ({ url: s.url as string, type: 'video/mp4', height: height(s) }));
    if (mp4.length === 0) {
      // No 720p–1080p file: take whatever MP4 exists rather than nothing.
      const any = raw.find((s) => s?.format === 'mp4' && isHttps(s.url));
      if (any) mp4.push({ url: any.url as string, type: 'video/mp4', height: height(any) });
    }
    if (mp4.length === 0) continue;
    const hls = raw.find((s) => s?.format === 'm3u8' && isHttps(s.url));
    const sources = hls ? [{ url: hls.url as string, type: HLS_TYPE, height: height(hls) }, ...mp4] : mp4;
    const poster = isHttps(m.preview_image?.src) ? (m.preview_image!.src as string) : null;
    const durationMs = typeof m.duration === 'number' && m.duration > 0 ? m.duration : null;
    return { sources, poster, durationMs };
  }
  return null;
}

/** The URL remembered as `video_source`: the best MP4. */
export function primaryVideoUrl(video: FeedVideo): string {
  return video.sources.find((s) => s.type === 'video/mp4')?.url ?? video.sources[0]!.url;
}

export type VideoCandidateReason = 'never_checked' | 'video_missing' | 'recheck';

/** Why this piece should be looked up this run, or null when it should not. */
export function videoCandidateReason(
  entry: { status: string; videoCount: number; video: VideoRecord },
  now: number,
): VideoCandidateReason | null {
  if (entry.status !== 'ACTIVE') return null;
  if (entry.videoCount > 0) return null; // a video of its own on Shopify already
  const { source, checkedAt, feedVideo } = entry.video;
  if (!source) return 'never_checked';
  if (source !== NO_VIDEO) return feedVideo ? null : 'video_missing';
  const at = checkedAt ? Date.parse(checkedAt) : Number.NaN;
  if (!Number.isFinite(at)) return 'recheck';
  return now - at > VIDEO_RECHECK_DAYS * DAY_MS ? 'recheck' : null;
}

type MetafieldInput = { namespace: string; key: string; type: string; value: string };

/**
 * The remembered video record as productSet metafields, so a rewrite of the
 * product does not delete it. Empty when nothing is remembered.
 */
export function videoMetafields(video: VideoRecord | undefined): MetafieldInput[] {
  if (!video?.source) return [];
  const ns = VIDEO_METAFIELD_NAMESPACE;
  const fields: MetafieldInput[] = [{ namespace: ns, key: 'video_source', type: 'single_line_text_field', value: video.source }];
  if (video.checkedAt) fields.push({ namespace: ns, key: 'video_checked_at', type: 'date_time', value: video.checkedAt });
  if (video.source !== NO_VIDEO && video.feedVideo) {
    fields.push({ namespace: ns, key: 'video', type: 'json', value: video.feedVideo });
  }
  return fields;
}

/** The metafields to write once a lookup has decided the piece. */
export function videoRecordWrite(
  ownerId: string,
  found: FeedVideo | null,
  checkedAt: string,
): Array<MetafieldInput & { ownerId: string }> {
  const record: VideoRecord = found
    ? { source: primaryVideoUrl(found), checkedAt, feedVideo: JSON.stringify(found) }
    : { source: NO_VIDEO, checkedAt };
  return videoMetafields(record).map((f) => ({ ownerId, ...f }));
}
