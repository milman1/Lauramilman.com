/**
 * Supplier product videos for estate pieces (merchant decision 2026-11-11).
 *
 * The supplier's products.json, which the sync reads, has no video. Its
 * per-product `/products/<handle>.js` does: a Shopify-hosted MP4 turntable on
 * about one piece in six (sampled 2026-11-11; every video checked was a plain
 * white-background shot with no logo, watermark or text). Shopify takes VIDEO
 * media only from a staged upload, so each video is downloaded and re-hosted
 * (ShopifyClient.rehostVideo), then attached to the product. The theme plays
 * video first in the gallery (sections/main-product.liquid).
 *
 * Each piece remembers what was found in two metafields, because a lookup is a
 * request to the supplier and an upload is a full download:
 *
 *   backvault_feed.video_source      the supplier MP4 URL that was attached,
 *                                    or "none" when the piece has no video
 *   backvault_feed.video_checked_at  when that was decided
 *
 * productSet deletes metafields it is not sent, so buildProductSetInput carries
 * these two through every rewrite (videoMetafields below).
 *
 * A piece is a candidate when it is ACTIVE, in this run's in-stock set, has no
 * live video on Shopify, and either:
 *  - nothing is remembered (never looked up),
 *  - a video was attached but is no longer on the product (a photo resend
 *    replaces all media, or the video failed to process), or
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
/** Downloads + uploads per run. Each is ~10–25 MB. */
export const VIDEO_UPLOAD_BUDGET = 25;
/** How long a "no video" answer is trusted before the supplier is asked again. */
export const VIDEO_RECHECK_DAYS = 30;
/** The stored value for "the supplier has no video for this piece". */
export const NO_VIDEO = 'none';
/** Tallest MP4 rendition to download: the 1080p file is plenty for a product page. */
const MAX_HEIGHT = 1080;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface VideoRecord {
  /** Supplier MP4 URL that was attached, or NO_VIDEO. */
  source: string | null;
  checkedAt: string | null;
}

interface RawMediaSource {
  format?: unknown;
  url?: unknown;
  height?: unknown;
}

interface RawMedia {
  media_type?: unknown;
  sources?: unknown;
}

/**
 * The MP4 to re-host from a supplier `/products/<handle>.js` body: the first
 * native video, at the tallest rendition up to 1080p. External videos
 * (YouTube, Vimeo) cannot be downloaded and are skipped. Null when the piece
 * has no usable video.
 */
export function pickSupplierVideo(productJs: unknown): string | null {
  if (productJs === null || typeof productJs !== 'object') return null;
  const media = (productJs as { media?: unknown }).media;
  if (!Array.isArray(media)) return null;
  for (const m of media as RawMedia[]) {
    if (m?.media_type !== 'video' || !Array.isArray(m.sources)) continue;
    const mp4 = (m.sources as RawMediaSource[])
      .filter((s) => s?.format === 'mp4' && typeof s.url === 'string' && /^https:\/\//.test(s.url))
      .map((s) => ({ url: s.url as string, height: typeof s.height === 'number' ? s.height : 0 }));
    if (mp4.length === 0) continue;
    const fitting = mp4.filter((s) => s.height <= MAX_HEIGHT);
    const pool = fitting.length > 0 ? fitting : mp4;
    pool.sort((a, b) => b.height - a.height);
    return pool[0]!.url;
  }
  return null;
}

export type VideoCandidateReason = 'never_checked' | 'video_missing' | 'recheck';

/** Why this piece should be looked up this run, or null when it should not. */
export function videoCandidateReason(
  entry: { status: string; videoCount: number; video: VideoRecord },
  now: number,
): VideoCandidateReason | null {
  if (entry.status !== 'ACTIVE') return null;
  if (entry.videoCount > 0) return null;
  const { source, checkedAt } = entry.video;
  if (!source) return 'never_checked';
  if (source !== NO_VIDEO) return 'video_missing';
  const at = checkedAt ? Date.parse(checkedAt) : Number.NaN;
  if (!Number.isFinite(at)) return 'recheck';
  return now - at > VIDEO_RECHECK_DAYS * DAY_MS ? 'recheck' : null;
}

/**
 * The remembered video record as productSet metafields, so a rewrite of the
 * product does not delete it. Empty when nothing is remembered.
 */
export function videoMetafields(
  video: VideoRecord | undefined,
): Array<{ namespace: string; key: string; type: string; value: string }> {
  if (!video?.source) return [];
  const fields = [{ namespace: VIDEO_METAFIELD_NAMESPACE, key: 'video_source', type: 'single_line_text_field', value: video.source }];
  if (video.checkedAt) {
    fields.push({ namespace: VIDEO_METAFIELD_NAMESPACE, key: 'video_checked_at', type: 'date_time', value: video.checkedAt });
  }
  return fields;
}

/** The two metafields to write once a lookup or an attach has decided the piece. */
export function videoRecordWrite(
  ownerId: string,
  source: string,
  checkedAt: string,
): Array<{ ownerId: string; namespace: string; key: string; type: string; value: string }> {
  return videoMetafields({ source, checkedAt }).map((f) => ({ ownerId, ...f }));
}
