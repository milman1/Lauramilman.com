import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { assertRoyalChainPublicScrubbed, ROYALCHAIN_MINIMUM_IMAGES } from './listing.js';
import { sniffImageMime } from '../shopify.js';

export type GeneratedImageKind = 'detail' | 'onbody' | 'wrist';

export interface GeneratedRoyalChainImage {
  baseHandle: string;
  kind: GeneratedImageKind;
  filename: string;
  path: string;
}

export interface RoyalChainMediaPlanProduct {
  handle: string;
  title: string;
  productType: string;
}

export interface RoyalChainMediaTarget extends RoyalChainMediaPlanProduct {
  baseHandle: string;
  images: Partial<Record<GeneratedImageKind, GeneratedRoyalChainImage>>;
  alt: Partial<Record<GeneratedImageKind, string>>;
  attachmentKinds: GeneratedImageKind[];
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

const IMAGE_FILENAME = /^(.*)-(detail|onbody|wrist)\.(?:png|jpe?g|webp)$/i;
const CONTACT_SHEET_ARTIFACT = /^contact-sheet[^/]*\.png$/i;

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Only this basename is sent to Shopify's staged upload endpoint. */
export function assertSafeRoyalChainPublicFilename(filename: string): void {
  if (!filename || path.basename(filename) !== filename) throw new Error('unsafe public staged filename');
  assertRoyalChainPublicScrubbed({ filename });
}

/** Review contact sheets are local QA artifacts, never approved product media. */
export function isRoyalChainReviewArtifact(filename: string): boolean {
  return CONTACT_SHEET_ARTIFACT.test(filename);
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
  expectedWristBaseHandles: Iterable<string>,
): Map<string, Partial<Record<GeneratedImageKind, GeneratedRoyalChainImage>>> {
  const expected = new Set([...expectedBaseHandles].map(clean));
  const expectedWrist = new Set([...expectedWristBaseHandles].map(clean));
  if (expected.size !== 21) throw new Error(`expected 21 base handles, received ${expected.size}`);
  if (expectedWrist.size !== 11 || [...expectedWrist].some((handle) => !expected.has(handle))) {
    throw new Error(`expected 11 approved wrist-image base handles, received ${expectedWrist.size}`);
  }
  const images = paths
    .filter((imagePath) => !isRoyalChainReviewArtifact(path.basename(imagePath)))
    .map((imagePath) => {
    const filename = path.basename(imagePath);
    const match = IMAGE_FILENAME.exec(filename);
    if (!match) throw new Error(`unexpected generated-image filename: ${filename}`);
    const baseHandle = clean(match[1] ?? '');
    const kind = match[2]?.toLowerCase() as GeneratedImageKind;
    if (!expected.has(baseHandle) || (kind === 'wrist' && !expectedWrist.has(baseHandle))) throw new Error(`generated image is not in the approved plan: ${filename}`);
    assertSafeRoyalChainPublicFilename(filename);
    assertRoyalChainPublicScrubbed({ baseHandle });
    return { baseHandle, kind, filename, path: imagePath };
  });
  if (images.length !== 53) throw new Error(`expected exactly 53 generated images, found ${images.length}`);

  const byBase = new Map<string, Partial<Record<GeneratedImageKind, GeneratedRoyalChainImage>>>();
  for (const image of images) {
    const set = byBase.get(image.baseHandle) ?? {};
    if (set[image.kind]) throw new Error(`duplicate ${image.kind} image for ${image.baseHandle}`);
    set[image.kind] = image;
    byBase.set(image.baseHandle, set);
  }

  const complete = new Map<string, Partial<Record<GeneratedImageKind, GeneratedRoyalChainImage>>>();
  for (const baseHandle of expected) {
    const set = byBase.get(baseHandle);
    if (!set?.detail || !set.onbody) throw new Error(`${baseHandle}: expected one detail and one onbody image`);
    if (expectedWrist.has(baseHandle) && !set.wrist) throw new Error(`${baseHandle}: expected one wrist image`);
    if (!expectedWrist.has(baseHandle) && set.wrist) throw new Error(`${baseHandle}: unexpected wrist image`);
    complete.set(baseHandle, { detail: set.detail, onbody: set.onbody });
    if (set.wrist) complete.get(baseHandle)!.wrist = set.wrist;
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
  images: Map<string, Partial<Record<GeneratedImageKind, GeneratedRoyalChainImage>>>,
  expectedBasePairs = 21,
): Promise<Map<string, Partial<Record<GeneratedImageKind, VerifiedGeneratedRoyalChainImage>>>> {
  const verified = new Map<string, Partial<Record<GeneratedImageKind, VerifiedGeneratedRoyalChainImage>>>();
  for (const [baseHandle, pair] of images) {
    const checked: Partial<Record<GeneratedImageKind, VerifiedGeneratedRoyalChainImage>> = {};
    for (const kind of ['detail', 'onbody', 'wrist'] as const) {
      const image = pair[kind];
      if (!image) continue;
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
  if (verified.size !== expectedBasePairs) throw new Error(`expected ${expectedBasePairs} verified base image pairs, found ${verified.size}`);
  return verified;
}

/** Re-check the exact bytes immediately before staging an approved asset. */
export async function assertGeneratedImageStillMatches(
  image: GeneratedRoyalChainImage,
  expected: Pick<VerifiedGeneratedRoyalChainImage, 'filename' | 'mimeType' | 'bytes' | 'sha256'>,
): Promise<void> {
  const verified = await verifyGeneratedRoyalChainImages(new Map([[image.baseHandle, { [image.kind]: image }]]), 1);
  const current = verified.get(image.baseHandle)?.[image.kind];
  if (!current || current.filename !== expected.filename || current.mimeType !== expected.mimeType
    || current.bytes !== expected.bytes || current.sha256 !== expected.sha256) {
    throw new Error(`${image.filename}: generated image changed after review; refusing staging upload`);
  }
}

/** Convert the committed product plan plus generated files into the fixed upload work list. */
export function buildRoyalChainMediaTargets(
  products: RoyalChainMediaPlanProduct[],
  images: Map<string, Partial<Record<GeneratedImageKind, GeneratedRoyalChainImage>>>,
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
    const attachmentKinds: GeneratedImageKind[] = handle.endsWith('-bracelet')
      ? ['detail', 'wrist']
      : product.productType === 'Bracelets'
        ? ['detail', 'onbody']
        : product.productType === 'Necklaces'
          ? ['detail', 'onbody']
          : (() => { throw new Error(`${handle}: unsupported product type for media`); })();
    if (attachmentKinds.some((kind) => !pair[kind])) throw new Error(`${handle}: missing approved ${attachmentKinds.join(' and ')} media`);
    const alt: Partial<Record<GeneratedImageKind, string>> = {
      detail: `${title} — detail view`,
      onbody: `${title} — on-body view`,
      wrist: `${title} — on-wrist view`,
    };
    assertRoyalChainPublicScrubbed({ handle, baseHandle, title, filenames: Object.values(pair).map((image) => image!.filename), alt });
    return { ...product, handle, baseHandle, images: pair, alt, attachmentKinds };
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

export function assertRoyalChainMediaProductDraft(handle: string, status: string): void {
  if (status !== 'DRAFT') throw new Error(`${handle}: refusing non-DRAFT product (${status})`);
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
    && target.attachmentKinds.every((kind) => {
      const image = target.images[kind];
      const alt = target.alt[kind];
      return Boolean(image && alt && hasMediaIdentity(media.filter((entry) => entry.status === 'READY'), image, alt));
    });
}
