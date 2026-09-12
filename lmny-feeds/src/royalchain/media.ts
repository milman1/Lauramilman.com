import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { assertRoyalChainPublicScrubbed, ROYALCHAIN_MINIMUM_IMAGES } from './listing.js';
import { sniffImageMime } from '../shopify.js';

export type GeneratedImageKind = 'detail' | 'onbody';

export interface GeneratedRoyalChainImage {
  baseHandle: string;
  kind: GeneratedImageKind;
  filename: string;
  path: string;
}

export interface RoyalChainMediaPlanProduct {
  handle: string;
  title: string;
}

export interface RoyalChainMediaTarget extends RoyalChainMediaPlanProduct {
  baseHandle: string;
  images: Record<GeneratedImageKind, GeneratedRoyalChainImage>;
  alt: Record<GeneratedImageKind, string>;
}

export interface ShopifyImageMedia {
  id: string;
  alt: string | null;
  url: string | null;
  status: string;
}

export interface VerifiedGeneratedRoyalChainImage extends GeneratedRoyalChainImage {
  bytes: number;
  mimeType: string;
  sha256: string;
}

const IMAGE_FILENAME = /^(.*)-(detail|onbody)\.(?:png|jpe?g|webp)$/i;

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Only this basename is sent to Shopify's staged upload endpoint. */
export function assertSafeRoyalChainPublicFilename(filename: string): void {
  if (!filename || path.basename(filename) !== filename) throw new Error('unsafe public staged filename');
  assertRoyalChainPublicScrubbed({ filename });
}

/** The bracelet split reuses the approved pair for its matching chain. */
export function baseHandleForMedia(handle: string): string {
  const base = handle.endsWith('-bracelet') ? handle.slice(0, -'-bracelet'.length) : handle;
  assertRoyalChainPublicScrubbed({ handle, baseHandle: base });
  return base;
}

/**
 * Parse the exactly-two-per-chain generated set. This intentionally rejects a
 * near match, a duplicate kind, or an unplanned filename before a Shopify
 * mutation is possible.
 */
export function parseGeneratedRoyalChainImages(
  paths: string[],
  expectedBaseHandles: Iterable<string>,
): Map<string, Record<GeneratedImageKind, GeneratedRoyalChainImage>> {
  const expected = new Set([...expectedBaseHandles].map(clean));
  if (expected.size !== 21) throw new Error(`expected 21 base handles, received ${expected.size}`);
  const images = paths.map((imagePath) => {
    const filename = path.basename(imagePath);
    const match = IMAGE_FILENAME.exec(filename);
    if (!match) throw new Error(`unexpected generated-image filename: ${filename}`);
    const baseHandle = clean(match[1] ?? '');
    const kind = match[2]?.toLowerCase() as GeneratedImageKind;
    if (!expected.has(baseHandle)) throw new Error(`generated image is not in the approved plan: ${filename}`);
    assertSafeRoyalChainPublicFilename(filename);
    assertRoyalChainPublicScrubbed({ baseHandle });
    return { baseHandle, kind, filename, path: imagePath };
  });
  if (images.length !== 42) throw new Error(`expected exactly 42 generated images, found ${images.length}`);

  const byBase = new Map<string, Partial<Record<GeneratedImageKind, GeneratedRoyalChainImage>>>();
  for (const image of images) {
    const set = byBase.get(image.baseHandle) ?? {};
    if (set[image.kind]) throw new Error(`duplicate ${image.kind} image for ${image.baseHandle}`);
    set[image.kind] = image;
    byBase.set(image.baseHandle, set);
  }

  const complete = new Map<string, Record<GeneratedImageKind, GeneratedRoyalChainImage>>();
  for (const baseHandle of expected) {
    const set = byBase.get(baseHandle);
    if (!set?.detail || !set.onbody) throw new Error(`${baseHandle}: expected one detail and one onbody image`);
    complete.set(baseHandle, { detail: set.detail, onbody: set.onbody });
  }
  if (byBase.size !== expected.size) throw new Error('generated-image base handle set differs from plan');
  return complete;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Read every approved image before reaching Shopify. A filename extension is
 * not trusted: the magic bytes must describe the same supported image type.
 */
export async function verifyGeneratedRoyalChainImages(
  images: Map<string, Record<GeneratedImageKind, GeneratedRoyalChainImage>>,
): Promise<Map<string, Record<GeneratedImageKind, VerifiedGeneratedRoyalChainImage>>> {
  const verified = new Map<string, Record<GeneratedImageKind, VerifiedGeneratedRoyalChainImage>>();
  for (const [baseHandle, pair] of images) {
    const checked = {} as Record<GeneratedImageKind, VerifiedGeneratedRoyalChainImage>;
    for (const kind of ['detail', 'onbody'] as const) {
      const image = pair[kind];
      // The local directory may retain a private supplier label; only the
      // filename is sent to Shopify, so that is the public boundary.
      assertRoyalChainPublicScrubbed({ baseHandle, filename: image.filename });
      const extension = path.extname(image.filename).toLowerCase();
      const expectedMime = MIME_BY_EXTENSION[extension];
      if (!expectedMime) throw new Error(`${image.filename}: unsupported image extension`);
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(await readFile(image.path));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${image.filename}: cannot read generated image (${message})`);
      }
      const mimeType = sniffImageMime(bytes);
      if (!mimeType) throw new Error(`${image.filename}: unsupported or corrupt image bytes`);
      if (mimeType !== expectedMime) throw new Error(`${image.filename}: extension ${extension} does not match ${mimeType}`);
      checked[kind] = { ...image, bytes: bytes.byteLength, mimeType, sha256: createHash('sha256').update(bytes).digest('hex') };
    }
    verified.set(baseHandle, checked);
  }
  if (verified.size !== 21) throw new Error(`expected 21 verified base image pairs, found ${verified.size}`);
  return verified;
}

/** Convert the committed product plan plus generated files into the fixed upload work list. */
export function buildRoyalChainMediaTargets(
  products: RoyalChainMediaPlanProduct[],
  images: Map<string, Record<GeneratedImageKind, GeneratedRoyalChainImage>>,
): RoyalChainMediaTarget[] {
  if (products.length !== 32) throw new Error(`expected 32 planned products, found ${products.length}`);
  const handles = products.map((product) => clean(product.handle));
  if (handles.some((handle) => !handle) || new Set(handles).size !== 32) throw new Error('planned product handles are not unique');
  const bases = new Set(handles.map(baseHandleForMedia));
  if (bases.size !== 21) throw new Error(`expected 21 base product handles, found ${bases.size}`);
  if (images.size !== bases.size || [...bases].some((base) => !images.has(base))) {
    throw new Error('generated-image set does not cover every planned product');
  }

  return products.map((product) => {
    const title = clean(product.title);
    const handle = clean(product.handle);
    const baseHandle = baseHandleForMedia(handle);
    const pair = images.get(baseHandle);
    if (!title || !pair) throw new Error(`${handle}: incomplete product media plan`);
    const alt = {
      detail: `${title} — detail view`,
      onbody: `${title} — on-body view`,
    };
    assertRoyalChainPublicScrubbed({ handle, baseHandle, title, filenames: [pair.detail.filename, pair.onbody.filename], alt });
    return { ...product, handle, baseHandle, images: pair, alt };
  });
}

function filenameIdentity(url: string | null, filename: string): boolean {
  if (!url) return false;
  try {
    const value = decodeURIComponent(new URL(url).pathname).toLowerCase();
    const stem = filename.replace(/\.[^.]+$/, '').toLowerCase();
    return value.includes(filename.toLowerCase()) || value.includes(stem);
  } catch {
    return url.toLowerCase().includes(filename.toLowerCase());
  }
}

/** A non-failed matching media row blocks a re-upload while Shopify processes it. */
export function hasMediaIdentity(
  media: ShopifyImageMedia[],
  image: GeneratedRoyalChainImage,
  alt: string,
): boolean {
  return media.some((entry) => entry.status !== 'FAILED' && (
    clean(entry.alt ?? '') === alt || filenameIdentity(entry.url, image.filename)
  ));
}

export function readyImageCount(media: ShopifyImageMedia[]): number {
  return media.filter((entry) => entry.status === 'READY' && Boolean(entry.url)).length;
}

/** Gate for removing media-missing. It never changes product status. */
export function mayClearRoyalChainMediaMissing(
  status: string,
  media: ShopifyImageMedia[],
  target: RoyalChainMediaTarget,
): boolean {
  return status === 'DRAFT'
    && readyImageCount(media) >= ROYALCHAIN_MINIMUM_IMAGES
    && hasMediaIdentity(media.filter((entry) => entry.status === 'READY'), target.images.detail, target.alt.detail)
    && hasMediaIdentity(media.filter((entry) => entry.status === 'READY'), target.images.onbody, target.alt.onbody);
}
