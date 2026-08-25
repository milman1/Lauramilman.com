import { handleFor } from './product.js';
import type { FeedItem, WatchItem } from './types.js';

const BROWSER_UA = 'Mozilla/5.0 (compatible; LMNY-FeedSync/1.0; +https://lauramilman.com)';
const DNA_PAGE = (stockRef: string) =>
  `https://dna.dnalinks.in/w/${encodeURIComponent(stockRef)}`;
/** Typical complete watch gallery is the catalog shot plus two angles. */
const SHORT_GALLERY = 3;
const FETCH_TIMEOUT_MS = 8_000;
const CONCURRENCY = 8;

const IMAGE_SRC_RE = /<img[^>]+src="([^"]+)"/gi;
const VIDEO_SRC_RE = /<source[^>]+src="([^"]+)"/gi;
const IMAGE_EXT_RE = /\.(jpe?g|png|webp)(\?|$)/i;
const VIDEO_EXT_RE = /\.(mp4|mov|webm|m4v)(\?|$)/i;
const DETAIL_SHOT_RE = /_\d+\.(jpe?g|png|webp)(\?|$)/i;
const NUMBERED_JPG_RE = /_\d+\.jpg(\?|$)/i;

export interface DnaGallery {
  images: string[];
  videos: string[];
}

export interface GalleryEnrichment {
  enriched: number;
  extraImages: number;
  extraVideos: number;
  /** DNA host failed the first wave of fetches — remaining watches skipped. */
  aborted: boolean;
}

export interface WatchGalleryStats {
  none: number;
  one: number;
  two: number;
  threePlus: number;
  /** Stock refs still on one photo after DNA fill (supplier has no extras). */
  onePhotoRefs: string[];
}

export interface EnrichWatchGalleriesOptions {
  fetchHtml?: FetchHtml;
  /**
   * READY image counts from the current Shopify catalog, keyed by handle
   * (`w-t3743`). Missing handles are treated as 0 (new products). When
   * provided, DNA fill runs for every watch Shopify still shows with fewer
   * than 3 photos — even if the API listed three 404 `.jpg` extras.
   */
  shopifyImageCountByHandle?: Map<string, number>;
}

/** Stop hitting DNA if a full worker wave fails — the host is down. */
const DNA_FAIL_WAVE = CONCURRENCY;

/**
 * The Belgium Dia watch API lists ImageLink / ImageLink1 / ImageLink2, but
 * those fields are often empty or point at `{stock}_1.jpg` while the real
 * extras on the DNA page are `{stock}_1.jpeg`. Shopify then gets one photo.
 * The DNA viewer at dna.dnalinks.in/w/{stock} is the complete gallery.
 */
export function parseDnaGalleryHtml(html: string): DnaGallery {
  const images = uniqueHttps(matchSrc(html, IMAGE_SRC_RE, IMAGE_EXT_RE));
  const videos = uniqueHttps(matchSrc(html, VIDEO_SRC_RE, VIDEO_EXT_RE));
  return { images, videos };
}

/**
 * Numbered angle shots (`_1.jpeg`, `_2.jpg`) are the real photography.
 * Bare `{stock}.jpg` is a smaller catalog thumb — putting it first is why
 * collection cards and the PDP hero look like "only one (tiny) image"
 * even when extras attached.
 */
export function preferDetailShots(urls: string[]): string[] {
  const detail: string[] = [];
  const rest: string[] = [];
  for (const url of urls) {
    (DETAIL_SHOT_RE.test(url) ? detail : rest).push(url);
  }
  return [...detail, ...rest];
}

export function mergeMediaUrls(existing: string[], extra: string[]): string[] {
  const seen = new Set(existing.map((u) => u.toLowerCase()));
  const out = [...existing];
  for (const url of extra) {
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return preferDetailShots(dropJpgExtraWhenJpegPresent(out));
}

/**
 * ImageLink1 is often `{stock}_1.jpg` (404) while DNA serves `{stock}_1.jpeg`.
 * Adding the sibling URL is a fallback when DNA is empty this run — it must
 * not be how we decide a gallery is "full", or three 404 `.jpg` fields skip
 * the fill forever.
 */
export function expandJpgExtrasToJpeg(urls: string[]): string[] {
  const extra: string[] = [];
  for (const url of urls) {
    if (NUMBERED_JPG_RE.test(url)) {
      extra.push(url.replace(/\.jpg(\?|$)/i, '.jpeg$1'));
    }
  }
  return extra.length === 0 ? urls : mergeMediaUrls(urls, extra);
}

/** Keep the working `.jpeg` extra and drop the 404 `.jpg` twin (any host). */
export function dropJpgExtraWhenJpegPresent(urls: string[]): string[] {
  const jpegStems = new Set<string>();
  for (const url of urls) {
    const stem = numberedExtraStem(url, 'jpeg');
    if (stem) jpegStems.add(stem);
  }
  if (jpegStems.size === 0) return urls;
  return urls.filter((url) => {
    const stem = numberedExtraStem(url, 'jpg');
    return !(stem && jpegStems.has(stem));
  });
}

/** `t3741_1` from `.../T3741_1.jpeg` — host-independent so a 404 API `.jpg` drops when DNA has `.jpeg`. */
function numberedExtraStem(url: string, ext: 'jpg' | 'jpeg'): string | null {
  const m = url.toLowerCase().match(new RegExp(`([^/?#]+)_(\\d+)\\.${ext}(?:\\?|$)`));
  return m ? `${m[1]}_${m[2]}` : null;
}

/**
 * Pull DNA when Shopify still has fewer than 3 READY photos, or — without a
 * catalog count — when the feed list is short or padded with numbered `.jpg`
 * extras (the 404 pattern that used to look like a full gallery).
 */
export function needsDnaGallery(imageUrls: string[], shopifyImageCount?: number): boolean {
  if (shopifyImageCount != null) return shopifyImageCount < SHORT_GALLERY;
  if (imageUrls.length < SHORT_GALLERY) return true;
  return imageUrls.some((u) => NUMBERED_JPG_RE.test(u));
}

export function watchGalleryStats(items: FeedItem[]): WatchGalleryStats {
  const stats: WatchGalleryStats = { none: 0, one: 0, two: 0, threePlus: 0, onePhotoRefs: [] };
  for (const item of items) {
    if (item.kind !== 'watch') continue;
    const n = item.imageUrls.length;
    if (n <= 0) stats.none += 1;
    else if (n === 1) {
      stats.one += 1;
      if (stats.onePhotoRefs.length < 20) stats.onePhotoRefs.push(item.stockRef);
    } else if (n === 2) stats.two += 1;
    else stats.threePlus += 1;
  }
  return stats;
}

export type FetchHtml = (url: string) => Promise<string | null>;

export async function fetchDnaGallery(
  stockRef: string,
  fetchHtml: FetchHtml = defaultFetchHtml,
): Promise<DnaGallery> {
  const html = await fetchHtml(DNA_PAGE(stockRef));
  if (!html) return { images: [], videos: [] };
  return parseDnaGalleryHtml(html);
}

/**
 * For every watch Shopify still shows with fewer than 3 READY photos (or,
 * without a catalog, every short / `.jpg`-padded feed list), pull the DNA
 * viewer. Runs every sync so a new SKU or a late DNA upload is picked up on
 * the next hour — not only when someone notices the PDP.
 *
 * Fail-soft: a dead DNA host must not fail the sync. If a full worker wave
 * returns nothing, stop rather than stalling the hourly cadence. JPEG sibling
 * expansion is the fallback for that hour.
 *
 * Mutates `imageUrls` / `videoUrls` in place so the content hash and
 * productSet `files` list see the full gallery.
 */
export async function enrichWatchGalleries(
  items: FeedItem[],
  options: FetchHtml | EnrichWatchGalleriesOptions = {},
): Promise<GalleryEnrichment> {
  const fetchHtml = typeof options === 'function' ? options : (options.fetchHtml ?? defaultFetchHtml);
  const shopifyImageCountByHandle =
    typeof options === 'function' ? undefined : options.shopifyImageCountByHandle;

  const result: GalleryEnrichment = { enriched: 0, extraImages: 0, extraVideos: 0, aborted: false };
  const watches: WatchItem[] = [];
  for (const item of items) {
    if (item.kind !== 'watch') continue;
    const shopifyCount = shopifyImageCountByHandle
      ? (shopifyImageCountByHandle.get(handleFor(item)) ?? 0)
      : undefined;
    if (needsDnaGallery(item.imageUrls, shopifyCount)) watches.push(item);
  }
  if (watches.length === 0) return result;

  let fetchFailures = 0;
  let abort = false;
  await mapPool(watches, CONCURRENCY, async (watch) => {
    if (abort) {
      applyJpegFallback(watch, result);
      return;
    }
    let gallery: DnaGallery;
    try {
      gallery = await fetchDnaGallery(watch.stockRef, fetchHtml);
    } catch {
      fetchFailures += 1;
      if (fetchFailures >= DNA_FAIL_WAVE) {
        abort = true;
        result.aborted = true;
      }
      applyJpegFallback(watch, result);
      return;
    }
    if (gallery.images.length === 0 && gallery.videos.length === 0) {
      fetchFailures += 1;
      if (fetchFailures >= DNA_FAIL_WAVE) {
        abort = true;
        result.aborted = true;
      }
      applyJpegFallback(watch, result);
      return;
    }
    fetchFailures = 0;
    const images = mergeMediaUrls(watch.imageUrls, gallery.images);
    const videos = mergeMediaUrls(watch.videoUrls, gallery.videos);
    const addedImages = images.length - watch.imageUrls.length;
    const addedVideos = videos.length - watch.videoUrls.length;
    if (addedImages <= 0 && addedVideos <= 0) return;
    watch.imageUrls = images;
    watch.videoUrls = videos;
    result.enriched += 1;
    result.extraImages += addedImages;
    result.extraVideos += addedVideos;
  });
  return result;
}

function applyJpegFallback(watch: WatchItem, result: GalleryEnrichment): void {
  const images = expandJpgExtrasToJpeg(watch.imageUrls);
  if (sameUrlList(watch.imageUrls, images)) return;
  const added = images.length - watch.imageUrls.length;
  watch.imageUrls = images;
  result.enriched += 1;
  result.extraImages += Math.max(0, added);
}

function sameUrlList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((url, i) => url === b[i]);
}

async function defaultFetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'text/html', 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function matchSrc(html: string, re: RegExp, ext: RegExp): string[] {
  const out: string[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const url = m[1]?.trim();
    if (url && ext.test(url)) out.push(url);
  }
  return out;
}

function uniqueHttps(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    if (!/^https?:\/\//i.test(raw)) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      await fn(items[idx]!);
    }
  }
  const n = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
}
