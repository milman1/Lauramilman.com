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

export interface DnaGallery {
  images: string[];
  videos: string[];
}

export interface GalleryEnrichment {
  enriched: number;
  extraImages: number;
  extraVideos: number;
}

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
  return preferDetailShots(out);
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
 * For every watch whose API fields produced fewer than three photos, pull
 * the DNA viewer and merge any extra stills / videos. Fail-soft: a dead
 * DNA host must not fail the sync.
 *
 * Mutates `imageUrls` / `videoUrls` in place so the content hash and
 * productSet `files` list see the full gallery.
 */
export async function enrichWatchGalleries(
  items: FeedItem[],
  fetchHtml: FetchHtml = defaultFetchHtml,
): Promise<GalleryEnrichment> {
  const watches = items.filter(
    (item): item is WatchItem => item.kind === 'watch' && item.imageUrls.length < SHORT_GALLERY,
  );
  const result: GalleryEnrichment = { enriched: 0, extraImages: 0, extraVideos: 0 };
  if (watches.length === 0) return result;

  await mapPool(watches, CONCURRENCY, async (watch) => {
    let gallery: DnaGallery;
    try {
      gallery = await fetchDnaGallery(watch.stockRef, fetchHtml);
    } catch {
      return;
    }
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
