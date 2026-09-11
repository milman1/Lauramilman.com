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

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exchangeClientCredentials, ShopifyClient } from '../src/shopify.js';
import {
  baseHandleForMedia,
  buildRoyalChainMediaTargets,
  hasMediaIdentity,
  mayClearRoyalChainMediaMissing,
  parseGeneratedRoyalChainImages,
  readyImageCount,
  type RoyalChainMediaPlanProduct,
  type RoyalChainMediaTarget,
  type ShopifyImageMedia,
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
  return rows.map((row) => ({ handle: String(row.handle ?? ''), title: String(row.title ?? '') }));
}

async function generatedImagePaths(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && IMAGE_EXTENSION.test(entry.name))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function reportRow(target: RoyalChainMediaTarget, product: ProductSnapshot, mode: 'dry-run' | 'apply') {
  return {
    handle: target.handle,
    baseHandle: target.baseHandle,
    status: product.status,
    title: product.title,
    existingReadyImages: readyImageCount(product.media),
    detailAlreadyAttached: hasMediaIdentity(product.media, target.images.detail, target.alt.detail),
    onbodyAlreadyAttached: hasMediaIdentity(product.media, target.images.onbody, target.alt.onbody),
    mediaMissing: product.tags.includes('media-missing'),
    mode,
  };
}

function assertDraft(target: RoyalChainMediaTarget, product: ProductSnapshot): void {
  if (product.status !== 'DRAFT') throw new Error(`${target.handle}: refusing non-DRAFT product (${product.status})`);
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
  staged: Map<string, string>,
): Promise<ProductSnapshot> {
  let product = await fetchProduct(shopify, target.handle);
  assertDraft(target, product);
  for (const kind of ['detail', 'onbody'] as const) {
    const image = target.images[kind];
    const alt = target.alt[kind];
    if (hasMediaIdentity(product.media, image, alt)) continue;
    let resourceUrl = staged.get(image.path);
    if (!resourceUrl) {
      resourceUrl = await shopify.stageLocalImage(image.path);
      staged.set(image.path, resourceUrl);
    }
    const errors = await shopify.attachMedia(product.id, resourceUrl, alt, 'IMAGE');
    if (errors.length) throw new Error(`${target.handle}: ${kind} media attach failed: ${errors.join('; ')}`);
    product = await fetchProduct(shopify, target.handle);
    assertDraft(target, product);
  }
  const ready = await waitForMediaGate(shopify, target);
  if (ready.tags.includes('media-missing')) {
    const errors = await shopify.setProductTags(ready.id, ready.tags.filter((tag) => tag !== 'media-missing'));
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
  const plan = await readPlan(planPath);
  const baseHandles = new Set(plan.map((product) => baseHandleForMedia(product.handle)));
  const images = parseGeneratedRoyalChainImages(await generatedImagePaths(imageDirectory), baseHandles);
  const targets = buildRoyalChainMediaTargets(plan, images);
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
  const report: Record<string, unknown> = {
    mode,
    generatedImages: images.size * 2,
    targetProducts: targets.length,
    targetBaseHandles: baseHandles.size,
    before: targets.map((target) => reportRow(target, before.get(target.handle)!, mode)),
  };
  await mkdir(OUT_DIR, { recursive: true });
  if (!apply) {
    await writeFile(path.join(OUT_DIR, 'royal-chain-generated-media-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`DRY RUN: validated ${targets.length} DRAFT products and ${images.size * 2} generated images; no Shopify writes.`);
    return;
  }

  const staged = new Map<string, string>();
  const after: Array<Record<string, unknown>> = [];
  for (const target of targets) after.push(reportRow(target, await applyTarget(shopify, target, staged), mode));
  report.after = after;
  report.stagedLocalFiles = staged.size;
  await writeFile(path.join(OUT_DIR, 'royal-chain-generated-media-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`APPLY: attached generated media to ${targets.length} DRAFT products; all passed the 3-image gate and remain DRAFT.`);
}

main().catch(async (error) => {
  await mkdir(OUT_DIR, { recursive: true });
  const message = error instanceof Error ? error.message : String(error);
  await writeFile(path.join(OUT_DIR, 'royal-chain-generated-media-errors.txt'), `${message}\n`);
  console.error(message);
  process.exitCode = 1;
});
