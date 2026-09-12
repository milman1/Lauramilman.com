/**
 * Attach the reviewed Royal Chain supplemental images to its 32 imported DRAFT
 * products. This is deliberately dry-run by default. --apply is the only
 * mutation mode, and it refuses any non-DRAFT record before it stages a file.
 *
 * Usage:
 *   npx tsx scripts/upload-royalchain-generated-media.ts \
 *     --plan=/approved/royalchain-products.jsonl \
 *     --image-dir=/approved/93-royal-chain-generated-images
 *   npx tsx scripts/upload-royalchain-generated-media.ts --apply ...
 */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exchangeClientCredentials, ShopifyClient } from '../src/shopify.js';
import {
  assertGeneratedImageStillMatches,
  assertRoyalChainMediaProductDraft,
  assertSafeRoyalChainPublicFilename,
  baseHandleForMedia,
  buildRoyalChainMediaTargets,
  executeReviewedMediaAttachments,
  hasMediaIdentity,
  mayClearRoyalChainMediaMissing,
  parseGeneratedRoyalChainImages,
  readyImageCount,
  verifyGeneratedRoyalChainImages,
  type GeneratedImageKind,
  type RoyalChainMediaPlanProduct,
  type RoyalChainMediaTarget,
  type ShopifyImageMedia,
  type VerifiedGeneratedRoyalChainImage,
} from '../src/royalchain/media.js';

const OUT_DIR = 'out';
const IMAGE_EXTENSION = /\.(?:png|jpe?g|webp)$/i;
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 10 * 60_000;

interface ProductSnapshot {
  id: string;
  handle: string;
  title: string;
  status: string;
  tags: string[];
  media: ShopifyImageMedia[];
}

interface SnapshotTarget {
  handle: string;
  baseHandle: string;
  title: string;
  alt: Partial<Record<GeneratedImageKind, string>>;
  images: Partial<Record<GeneratedImageKind, Pick<VerifiedGeneratedRoyalChainImage, 'filename' | 'mimeType' | 'bytes' | 'sha256'>>>;
  attachmentKinds: GeneratedImageKind[];
  /** Immutable dry-run decision: no apply-time reclassification from live media. */
  addKinds: GeneratedImageKind[];
  expected: ProductSnapshot;
}

interface ReviewedSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  sourcePlanSha256: string;
  generatedImages: number;
  targets: SnapshotTarget[];
}

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function requireArg(name: string): string {
  const value = arg(name);
  if (!value) throw new Error(`--${name}=... is required`);
  return value;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function token(domain: string): Promise<string> {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  if (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET) {
    return (await exchangeClientCredentials(domain, process.env.SHOPIFY_CLIENT_ID, process.env.SHOPIFY_CLIENT_SECRET)).token;
  }
  throw new Error('Set SHOPIFY_ADMIN_TOKEN or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET');
}

const PRODUCT_BY_HANDLE = `#graphql
  query RoyalChainProductByHandle($query: String!) {
    products(first: 10, query: $query) {
      nodes {
        id handle title status tags
        media(first: 250) {
          nodes {
            id alt mediaContentType status
            ... on MediaImage { image { url altText } }
          }
        }
      }
    }
  }
`;

async function fetchProduct(shopify: ShopifyClient, handle: string): Promise<ProductSnapshot> {
  const data = await shopify.gql<{
    products: { nodes: Array<{
      id: string; handle: string; title: string; status: string; tags: string[];
      media: { nodes: Array<{ id: string; alt?: string | null; mediaContentType: string; status: string; image?: { url?: string | null; altText?: string | null } | null }> };
    }> };
  }>(PRODUCT_BY_HANDLE, { query: `handle:'${handle}'` });
  const matches = data.products.nodes.filter((product) => product.handle === handle);
  if (matches.length !== 1) throw new Error(`${handle}: expected one Shopify product, found ${matches.length}`);
  const product = matches[0]!;
  return {
    ...product,
    media: product.media.nodes
      .filter((media) => media.mediaContentType === 'IMAGE')
      .map((media) => ({ id: media.id, alt: media.alt ?? media.image?.altText ?? null, url: media.image?.url ?? null, status: media.status })),
  };
}

async function readPlan(planPath: string): Promise<RoyalChainMediaPlanProduct[]> {
  const rows = (await readFile(planPath, 'utf8')).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
  return rows.map((row) => ({ handle: String(row.handle ?? ''), title: String(row.title ?? ''), productType: String(row.productType ?? '') }));
}

async function generatedImagePaths(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && IMAGE_EXTENSION.test(entry.name))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function canonicalProduct(product: ProductSnapshot): ProductSnapshot {
  return {
    ...product,
    tags: [...product.tags].sort(),
    media: [...product.media].map((media) => ({ ...media })).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function snapshotTarget(
  target: RoyalChainMediaTarget,
  verified: Map<string, Partial<Record<GeneratedImageKind, VerifiedGeneratedRoyalChainImage>>>,
  product: ProductSnapshot,
): SnapshotTarget {
  const verifiedImages = verified.get(target.baseHandle);
  if (!verifiedImages) throw new Error(`${target.handle}: missing verified image pair`);
  const images: SnapshotTarget['images'] = {};
  for (const kind of target.attachmentKinds) {
    const image = verifiedImages[kind];
    if (!image) throw new Error(`${target.handle}: missing verified ${kind} image`);
    images[kind] = { filename: image.filename, mimeType: image.mimeType, bytes: image.bytes, sha256: image.sha256 };
  }
  return {
    handle: target.handle,
    baseHandle: target.baseHandle,
    title: target.title,
    alt: target.alt,
    images,
    attachmentKinds: target.attachmentKinds,
    addKinds: target.attachmentKinds.filter((kind) => {
      const image = target.images[kind];
      const alt = target.alt[kind];
      if (!image || !alt) throw new Error(`${target.handle}: incomplete approved ${kind} media`);
      return !hasMediaIdentity(product.media, image, alt);
    }),
    expected: canonicalProduct(product),
  };
}

function assertReviewedSnapshot(
  raw: unknown,
  expectedPlanHash: string,
  targets: RoyalChainMediaTarget[],
  verified: Map<string, Partial<Record<GeneratedImageKind, VerifiedGeneratedRoyalChainImage>>>,
): asserts raw is ReviewedSnapshot {
  const snapshot = raw as Partial<ReviewedSnapshot>;
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.targets) || snapshot.sourcePlanSha256 !== expectedPlanHash) {
    throw new Error('reviewed media snapshot is invalid or does not match the current product plan');
  }
  if (snapshot.targets.length !== 32 || snapshot.generatedImages !== 53) throw new Error('reviewed media snapshot has an unexpected scope');
  const byHandle = new Map(snapshot.targets.map((target) => [target.handle, target]));
  if (byHandle.size !== 32) throw new Error('reviewed media snapshot has duplicate product handles');
  for (const target of targets) {
    const saved = byHandle.get(target.handle);
    const checked = verified.get(target.baseHandle);
    if (!saved || !checked || saved.baseHandle !== target.baseHandle || saved.title !== target.title
      || JSON.stringify(saved.attachmentKinds) !== JSON.stringify(target.attachmentKinds)
      || !Array.isArray(saved.addKinds) || saved.addKinds.some((kind) => !target.attachmentKinds.includes(kind))) {
      throw new Error(`${target.handle}: reviewed media snapshot does not match the verified files and plan`);
    }
    for (const kind of target.attachmentKinds) {
      const image = target.images[kind];
      const verifiedImage = checked[kind];
      const savedImage = saved.images[kind];
      if (!image || !verifiedImage || !savedImage || saved.alt[kind] !== target.alt[kind]
        || savedImage.filename !== verifiedImage.filename || savedImage.mimeType !== verifiedImage.mimeType
        || savedImage.bytes !== verifiedImage.bytes || savedImage.sha256 !== verifiedImage.sha256) {
        throw new Error(`${target.handle}: reviewed media snapshot does not match approved ${kind} media`);
      }
    }
    const expectedKinds = target.attachmentKinds.filter((kind) => {
      const image = target.images[kind];
      const alt = target.alt[kind];
      return Boolean(image && alt && !hasMediaIdentity(saved.expected.media, image, alt));
    });
    if (JSON.stringify([...saved.addKinds].sort()) !== JSON.stringify(expectedKinds)) {
      throw new Error(`${target.handle}: reviewed media snapshot attachment decision is invalid`);
    }
  }
}

function assertNoCatalogDrift(snapshot: ReviewedSnapshot, live: Map<string, ProductSnapshot>): void {
  for (const target of snapshot.targets) {
    const current = live.get(target.handle);
    if (!current || JSON.stringify(canonicalProduct(current)) !== JSON.stringify(target.expected)) {
      throw new Error(`${target.handle}: Shopify state drifted after the reviewed dry run; no writes made`);
    }
  }
}

function reportRow(target: RoyalChainMediaTarget, product: ProductSnapshot, mode: 'dry-run' | 'apply') {
  const attachmentState = Object.fromEntries(target.attachmentKinds.map((kind) => {
    const image = target.images[kind];
    const alt = target.alt[kind];
    return [kind, Boolean(image && alt && hasMediaIdentity(product.media, image, alt))];
  }));
  return {
    handle: target.handle,
    baseHandle: target.baseHandle,
    status: product.status,
    title: product.title,
    existingReadyImages: readyImageCount(product.media),
    attachments: attachmentState,
    mediaMissing: product.tags.includes('media-missing'),
    mode,
  };
}

function assertDraft(target: RoyalChainMediaTarget, product: ProductSnapshot): void {
  assertRoyalChainMediaProductDraft(target.handle, product.status);
}

async function waitForMediaGate(shopify: ShopifyClient, target: RoyalChainMediaTarget): Promise<ProductSnapshot> {
  const started = Date.now();
  for (;;) {
    const product = await fetchProduct(shopify, target.handle);
    assertDraft(target, product);
    if (mayClearRoyalChainMediaMissing(product.status, product.media, target)) return product;
    if (Date.now() - started >= POLL_TIMEOUT_MS) {
      throw new Error(`${target.handle}: timed out waiting for two generated images and ${3} total READY images`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function applyTarget(
  shopify: ShopifyClient,
  target: RoyalChainMediaTarget,
  reviewed: SnapshotTarget,
  staged: Map<string, string>,
): Promise<ProductSnapshot> {
  assertDraft(target, reviewed.expected);
  // The reviewed snapshot fixes the attachment decisions. Apply never uses a
  // newer catalog read to decide whether an image should be attached.
  await executeReviewedMediaAttachments({
    kinds: reviewed.addKinds,
    needsStaging: (kind) => {
      const image = target.images[kind];
      if (!image) throw new Error(`${target.handle}: missing reviewed ${kind} media`);
      return !staged.has(image.path);
    },
    assertDraftNow: async () => {
      const current = await fetchProduct(shopify, target.handle);
      assertDraft(target, current);
      if (current.id !== reviewed.expected.id) throw new Error(`${target.handle}: Shopify product identity drifted; refusing mutation`);
    },
    stage: async (kind) => {
      const image = target.images[kind];
      const expectedImage = reviewed.images[kind];
      if (!image || !expectedImage) throw new Error(`${target.handle}: missing reviewed ${kind} media`);
      assertSafeRoyalChainPublicFilename(image.filename);
      await assertGeneratedImageStillMatches(image, expectedImage);
      staged.set(image.path, await shopify.stageLocalImage(image.path, image.filename));
    },
    attach: async (kind) => {
      const image = target.images[kind];
      const alt = target.alt[kind];
      const resourceUrl = image ? staged.get(image.path) : undefined;
      if (!image || !alt || !resourceUrl) throw new Error(`${target.handle}: missing staged ${kind} media`);
      const errors = await shopify.attachMedia(reviewed.expected.id, resourceUrl, alt, 'IMAGE');
      if (errors.length) throw new Error(`${target.handle}: ${kind} media attach failed: ${errors.join('; ')}`);
    },
  });
  const ready = await waitForMediaGate(shopify, target);
  if (reviewed.expected.tags.includes('media-missing')) {
    // A fresh DRAFT assertion immediately precedes the sole tag mutation.
    const beforeTagRemove = await fetchProduct(shopify, target.handle);
    assertDraft(target, beforeTagRemove);
    const errors = await shopify.removeProductTags(beforeTagRemove.id, ['media-missing']);
    if (errors.length) throw new Error(`${target.handle}: removing media-missing failed: ${errors.join('; ')}`);
  }
  const after = await fetchProduct(shopify, target.handle);
  assertDraft(target, after);
  if (!mayClearRoyalChainMediaMissing(after.status, after.media, target) || after.tags.includes('media-missing')) {
    throw new Error(`${target.handle}: post-write media gate failed`);
  }
  return after;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const planPath = requireArg('plan');
  const imageDirectory = requireArg('image-dir');
  const planBytes = await readFile(planPath);
  const planHash = sha256(planBytes);
  const plan = (await readPlan(planPath));
  const baseHandles = new Set(plan.map((product) => baseHandleForMedia(product.handle)));
  const wristBaseHandles = new Set(plan.filter((product) => product.handle.endsWith('-bracelet')).map((product) => baseHandleForMedia(product.handle)));
  const images = parseGeneratedRoyalChainImages(await generatedImagePaths(imageDirectory), baseHandles, wristBaseHandles);
  // Full byte-level preflight comes before authentication or any possible
  // Shopify mutation. The reviewed plan records these exact checksums.
  const verified = await verifyGeneratedRoyalChainImages(images);
  const targets = buildRoyalChainMediaTargets(plan, images);
  let reviewed: ReviewedSnapshot | null = null;
  if (apply) {
    const reviewedPath = requireArg('reviewed-plan');
    const reviewedHash = requireArg('plan-sha256').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(reviewedHash)) throw new Error('--plan-sha256 must be a SHA-256 hex digest');
    const reviewedBytes = await readFile(reviewedPath);
    if (sha256(reviewedBytes) !== reviewedHash) throw new Error('reviewed media snapshot SHA-256 mismatch');
    const parsed = JSON.parse(reviewedBytes.toString('utf8')) as unknown;
    assertReviewedSnapshot(parsed, planHash, targets, verified);
    reviewed = parsed;
  }
  const domain = requireEnv('SHOPIFY_STORE_DOMAIN');
  const shopify = new ShopifyClient(domain, await token(domain));
  await shopify.verifyAuth();

  // Complete every read and every DRAFT check before the first possible write.
  const before = new Map<string, ProductSnapshot>();
  for (const target of targets) {
    const product = await fetchProduct(shopify, target.handle);
    assertDraft(target, product);
    before.set(target.handle, product);
  }
  const mode = apply ? 'apply' : 'dry-run';
  await mkdir(OUT_DIR, { recursive: true });
  if (!apply) {
    const snapshot: ReviewedSnapshot = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      sourcePlanSha256: planHash,
      generatedImages: 53,
      targets: targets.map((target) => snapshotTarget(target, verified, before.get(target.handle)!)),
    };
    const snapshotBytes = `${JSON.stringify(snapshot, null, 2)}\n`;
    const snapshotPath = path.join(OUT_DIR, 'royal-chain-generated-media-plan.json');
    await writeFile(snapshotPath, snapshotBytes);
    await writeFile(path.join(OUT_DIR, 'royal-chain-generated-media-report.json'), `${JSON.stringify({
      mode,
      snapshotPath,
      snapshotSha256: sha256(snapshotBytes),
      generatedImages: 53,
      targetProducts: targets.length,
      targetBaseHandles: baseHandles.size,
      before: targets.map((target) => reportRow(target, before.get(target.handle)!, mode)),
    }, null, 2)}\n`);
    console.log(`DRY RUN: wrote reviewed snapshot for ${targets.length} DRAFT products and 53 verified images; no Shopify writes.`);
    return;
  }

  assertNoCatalogDrift(reviewed!, before);
  const staged = new Map<string, string>();
  const after: Array<Record<string, unknown>> = [];
  const reviewedByHandle = new Map(reviewed!.targets.map((target) => [target.handle, target]));
  for (const target of targets) {
    const saved = reviewedByHandle.get(target.handle);
    if (!saved) throw new Error(`${target.handle}: missing reviewed snapshot target`);
    after.push(reportRow(target, await applyTarget(shopify, target, saved, staged), mode));
  }
  await writeFile(path.join(OUT_DIR, 'royal-chain-generated-media-report.json'), `${JSON.stringify({
    mode,
    reviewedPlanSha256: arg('plan-sha256'),
    generatedImages: 53,
    targetProducts: targets.length,
    stagedLocalFiles: staged.size,
    after,
  }, null, 2)}\n`);
  console.log(`APPLY: attached generated media to ${targets.length} DRAFT products; all passed the 3-image gate and remain DRAFT.`);
}

main().catch(async (error) => {
  await mkdir(OUT_DIR, { recursive: true });
  const message = error instanceof Error ? error.message : String(error);
  await writeFile(path.join(OUT_DIR, 'royal-chain-generated-media-errors.txt'), `${message}\n`);
  console.error(message);
  process.exitCode = 1;
});
