import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { CatalogEntry, Publishable, StoneItem } from './types.js';
import type { ShopifyClient } from './shopify.js';
import { handleFor } from './product.js';
import { GOOGLE_LOOSE_PILOT_HANDLES, GOOGLE_LOOSE_PUBLICATION_ENABLED } from '../config/googleLoose.js';
import { GOOGLE_LOOSE_FIELDS } from './googleShopping.js';
export { GOOGLE_LOOSE_FIELDS } from './googleShopping.js';

/** Google only. Never grants eBay, Meta, Pinterest, or Uploadify eligibility. */
export const GOOGLE_LOOSE_TAG = 'lmny-google-loose';

export interface GoogleLooseProduct {
  id: string; handle: string; status: string; title: string; descriptionHtml: string;
  onlineStoreUrl: string | null; tags: string[]; publishedOnPublication: boolean;
  certificate: { value: string } | null;
  media: { nodes: Array<{ mediaContentType: string; status: string }> };
  variants: { nodes: Array<{ sku: string | null; price: string; inventoryQuantity: number | null;
    inventoryPolicy: string; inventoryItem: { tracked: boolean } }> };
  google: { nodes: Array<{ key: string; value: string }> };
}
export interface GoogleLooseLine {
  id: string; handle: string; action: 'publish' | 'refresh' | 'unpublish' | 'skip'; reason: string;
}

export function shortlistHandles(csv: string): Set<string> {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.shift()?.split(',')[2] !== 'handle') throw new Error('Invalid Google shortlist header');
  const handles = lines.map(line => line.split(',')[2] ?? '');
  if (!handles.length || handles.some(handle => !/^lg-[a-z0-9-]+$/.test(handle))) {
    throw new Error('Invalid or empty Google lab shortlist');
  }
  return new Set(handles);
}

export function googleLooseReason(item: StoneItem | undefined, product: GoogleLooseProduct): string | null {
  if (!item || item.kind !== 'lab') return 'not_in_current_publishable_supplier_feed';
  if (!/^(IGI|GIA)$/i.test(item.lab) || !item.certNumber?.trim()) return 'missing_certification';
  if (!item.shape.trim() || !item.color.trim() || !item.clarity.trim() || !(item.carat > 0)) return 'missing_specs';
  if (!item.imageUrls.some(url => /^https:\/\//.test(url))) return 'missing_supplier_image';
  if (product.status !== 'ACTIVE' || !product.onlineStoreUrl) return 'not_live';
  if (product.tags.includes('media-missing') || product.tags.includes('pricing-review')) return 'listing_hold';
  if (!product.title.trim() || !product.descriptionHtml.trim()) return 'missing_content';
  if (product.certificate?.value !== item.certNumber) return 'certificate_mismatch';
  if (!product.media.nodes.some(media => media.mediaContentType === 'IMAGE' && media.status === 'READY')) return 'image_not_ready';
  const variant = product.variants.nodes[0];
  if (product.variants.nodes.length !== 1 || !variant || variant.sku !== item.stockRef) return 'sku_mismatch';
  if (!Number.isFinite(Number(variant.price)) || Number(variant.price) <= 0) return 'invalid_price';
  // Preserve the existing Uploadify exclusion. Supplier membership, not qty 0,
  // establishes source availability; CONTINUE keeps the website purchasable.
  if (!variant.inventoryItem.tracked || variant.inventoryQuantity !== 0 || variant.inventoryPolicy !== 'CONTINUE') return 'inventory_policy_mismatch';
  return null;
}

export function planGoogleLoose(products: GoogleLooseProduct[], publishable: Publishable[], selected: Set<string>): GoogleLooseLine[] {
  const source = new Map<string, StoneItem>(publishable.flatMap(p => p.item.kind === 'lab' ? [[handleFor(p.item), p.item] as const] : []));
  return products.map(product => {
    const reason = selected.has(product.handle) ? googleLooseReason(source.get(product.handle), product) : 'outside_shortlist';
    if (reason) return { id: product.id, handle: product.handle, action: product.publishedOnPublication ? 'unpublish' : 'skip', reason };
    const complete = GOOGLE_LOOSE_FIELDS.every(field => product.google.nodes.some(mf => mf.key === field.key && mf.value === field.value));
    return { id: product.id, handle: product.handle,
      action: !product.publishedOnPublication ? 'publish' : !complete || !product.tags.includes(GOOGLE_LOOSE_TAG) ? 'refresh' : 'skip',
      reason: 'eligible' };
  });
}

export const GOOGLE_LOOSE_QUERY = `query GoogleLooseProducts($query:String!,$after:String,$publicationId:ID!){
  products(first:50,query:$query,after:$after){pageInfo{hasNextPage endCursor} nodes{
    id handle status title descriptionHtml onlineStoreUrl tags publishedOnPublication(publicationId:$publicationId)
    certificate:metafield(namespace:"lmny_feed",key:"cert_number"){value}
    media(first:10){nodes{mediaContentType status}}
    variants(first:2){nodes{sku price inventoryQuantity inventoryPolicy inventoryItem{tracked}}}
    google:metafields(first:20,namespace:"mm-google-shopping"){nodes{key value}}
  }}
}`;
export const GOOGLE_LOOSE_UNPUBLISH = `mutation GoogleLooseUnpublish($id:ID!,$input:[PublicationInput!]!){
  publishableUnpublish(id:$id,input:$input){userErrors{field message}}
}`;
export const GOOGLE_LOOSE_TAG_MUTATION = `mutation GoogleLooseTag($id:ID!,$tags:[String!]!){
  tagsAdd(id:$id,tags:$tags){userErrors{field message}}
}`;

async function readProducts(shopify: ShopifyClient, handles: Set<string>, publicationId: string): Promise<GoogleLooseProduct[]> {
  const queries = [`tag:${GOOGLE_LOOSE_TAG}`];
  const list = [...handles];
  for (let i = 0; i < list.length; i += 40) queries.push(list.slice(i, i + 40).map(h => `handle:${h}`).join(' OR '));
  const found = new Map<string, GoogleLooseProduct>();
  for (const query of queries) {
    let after: string | null = null;
    do {
      const data: { products: { nodes: GoogleLooseProduct[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } =
        await shopify.gql(GOOGLE_LOOSE_QUERY, { query, after, publicationId });
      for (const product of data.products.nodes) {
        // Shopify ignores invalid search filters: explicitly enforce scope.
        if (handles.has(product.handle) || product.tags.includes(GOOGLE_LOOSE_TAG)) found.set(product.id, product);
      }
      after = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
    } while (after);
  }
  return [...found.values()];
}

export async function reconcileGoogleLoose(shopify: ShopifyClient, publishable: Publishable[], catalog: CatalogEntry[],
  options: { dryRun: boolean; supplierHealthy: boolean; outDir: string }): Promise<string> {
  if (!options.supplierHealthy) return 'Google loose stones deferred: lab supplier fetch unavailable or disabled; no publication changes';
  if (!options.dryRun && !GOOGLE_LOOSE_PUBLICATION_ENABLED) return 'Google loose publication paused pending explicit channel-change approval; no writes';
  const shortlist = shortlistHandles(await readFile(new URL('../../docs/seo/2026-10-18-google-shopping-lab-shortlist.csv', import.meta.url), 'utf8'));
  if (GOOGLE_LOOSE_PILOT_HANDLES.some(handle => !shortlist.has(handle))) throw new Error('Google pilot handle absent from reviewed shortlist');
  const selected = new Set(GOOGLE_LOOSE_PILOT_HANDLES);
  const { ids } = await shopify.publicationIdsByName(['Google & YouTube']);
  const publicationId = ids.get('Google & YouTube');
  if (!publicationId) throw new Error('Google & YouTube publication not installed');
  // The main productSet replaces tags. Keep pre-write managed handles in scope
  // so a shortlist removal cannot strand an old Google listing after an update.
  const scope = new Set([...selected, ...catalog.filter(p => p.tags.includes(GOOGLE_LOOSE_TAG)).map(p => p.handle)]);
  const products = await readProducts(shopify, scope, publicationId);
  const plan = planGoogleLoose(products, publishable, selected);
  const missing = [...selected].filter(handle => !products.some(p => p.handle === handle));
  await mkdir(options.outDir, { recursive: true });
  await writeFile(`${options.outDir}/google-loose-plan.json`, JSON.stringify({ dryRun: options.dryRun, createdAt: new Date().toISOString(), selected: selected.size, missing, plan }, null, 2));
  const counts = Object.fromEntries(['publish', 'refresh', 'unpublish', 'skip'].map(action => [action, plan.filter(p => p.action === action).length]));
  if (options.dryRun) return `Google loose dry-run: ${JSON.stringify(counts)}, ${missing.length} shortlist products absent; plan only`;
  const errors: string[] = [];
  for (const line of plan) {
    if (line.action === 'skip') continue;
    try {
      let failures: string[] = [];
      if (line.action === 'unpublish') {
        const data = await shopify.gql<{ publishableUnpublish: { userErrors: Array<{ message: string }> } }>(GOOGLE_LOOSE_UNPUBLISH, { id: line.id, input: [{ publicationId }] });
        failures = data.publishableUnpublish.userErrors.map(e => e.message);
      } else {
        failures = await shopify.setMetafields(GOOGLE_LOOSE_FIELDS.map(field => ({ ...field, ownerId: line.id })));
        if (!failures.length) {
          const data = await shopify.gql<{ tagsAdd: { userErrors: Array<{ message: string }> } }>(GOOGLE_LOOSE_TAG_MUTATION, { id: line.id, tags: [GOOGLE_LOOSE_TAG] });
          failures = data.tagsAdd.userErrors.map(e => e.message);
        }
        if (!failures.length) failures = await shopify.publishToChannels(line.id, [publicationId]);
      }
      errors.push(...failures.map(error => `${line.handle}: ${error}`));
    } catch (error) { errors.push(`${line.handle}: ${String(error)}`); }
  }
  // Independent current read, including unchanged records. Never equate an API
  // write response with successful channel state or Google approval.
  const verified = await readProducts(shopify, scope, publicationId);
  const remaining = planGoogleLoose(verified, publishable, selected).filter(line => line.action !== 'skip');
  const vanished = plan.filter(line => line.reason === 'eligible' && !verified.some(p => p.id === line.id));
  await writeFile(`${options.outDir}/google-loose-verification.json`, JSON.stringify({ checkedAt: new Date().toISOString(), errors, remaining, vanished, products: verified.map(p => ({ id: p.id, handle: p.handle, published: p.publishedOnPublication })) }, null, 2));
  if (errors.length || remaining.length || vanished.length) throw new Error(`Google loose reconciliation failed: ${errors.length} errors, ${remaining.length} mismatches, ${vanished.length} vanished eligible products; see artifacts`);
  return `Google loose Shopify publication verified: ${JSON.stringify(counts)}, ${missing.length} absent; Merchant Center approval still requires verification`;
}
