/**
 * Weekly vendor catalog sync (Alyce Jewels, Eric Originals, Namdar Diamonds).
 *
 * Reads each vendor's public Shopify /products.json, matches the products we
 * imported from it (src/vendors/plan.ts), then sets our variant prices to the
 * vendor's and moves pieces the vendor no longer has to DRAFT. Rules and
 * guards: config/pricing.ts VENDOR_CATALOG_SYNC.
 *
 *   npx tsx src/vendors/sync.ts --dry-run   # report only
 *   npx tsx src/vendors/sync.ts             # live
 *
 * A vendor whose catalog cannot be read completely is skipped with no
 * writes, and the run exits non-zero so the failure is visible.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { VENDOR_CATALOG_SYNC, type VendorCatalogConfig } from '../../config/pricing.js';
import { exchangeClientCredentials, ShopifyClient } from '../shopify.js';
import { planVendor, WITHDRAWN_TAG, type OurProduct, type VendorPlan, type VendorProduct } from './plan.js';

const PAGE_LIMIT = 250;
const MAX_PAGES = 40;
const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; LMNY-FeedSync/1.0; +https://lauramilman.com)',
} as const;

/** Every product in a vendor's public catalog. Throws rather than return a partial list. */
export async function fetchVendorCatalog(baseUrl: string, fetcher: typeof fetch = fetch): Promise<VendorProduct[]> {
  const all: VendorProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${baseUrl.replace(/\/+$/, '')}/products.json?limit=${PAGE_LIMIT}&page=${page}`;
    let res: Response | undefined;
    for (let attempt = 0; attempt < 3 && !res?.ok; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * attempt));
      try {
        res = await fetcher(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
      } catch {
        res = undefined;
      }
      if (res && res.status !== 429 && res.status < 500) break;
    }
    if (!res) throw new Error(`request failed for page ${page}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} for page ${page}`);
    const body = (await res.json()) as { products?: VendorProduct[] };
    if (!Array.isArray(body.products)) throw new Error(`page ${page} had no products array`);
    all.push(...body.products);
    if (body.products.length < PAGE_LIMIT) {
      if (all.length === 0) throw new Error('catalog is empty');
      return all;
    }
  }
  throw new Error(`more than ${MAX_PAGES} pages`);
}

async function resolveToken(): Promise<{ domain: string; token: string }> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN is not set');
  if (process.env.SHOPIFY_ADMIN_TOKEN) return { domain, token: process.env.SHOPIFY_ADMIN_TOKEN };
  const { SHOPIFY_CLIENT_ID: id, SHOPIFY_CLIENT_SECRET: secret } = process.env;
  if (id && secret) return { domain, token: (await exchangeClientCredentials(domain, id, secret)).token };
  throw new Error('Set SHOPIFY_ADMIN_TOKEN, or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET');
}

function searchFor(vendor: VendorCatalogConfig): string {
  return [`tag:${vendor.importTag}`, ...(vendor.legacySkus ?? []).map((s) => `sku:${s}`)].join(' OR ');
}

async function readOurProducts(client: ShopifyClient, query: string): Promise<OurProduct[]> {
  const out: OurProduct[] = [];
  let after: string | null = null;
  for (;;) {
    const data: {
      products: {
        nodes: Array<{
          id: string; handle: string; title: string; status: string; tags: string[];
          variants: { nodes: Array<{ id: string; sku: string | null; price: string }>; pageInfo: { hasNextPage: boolean } };
        }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await client.gql(
      `query($q: String!, $after: String) {
        products(first: 8, after: $after, query: $q) {
          nodes { id handle title status tags
            variants(first: 100) { nodes { id sku price } pageInfo { hasNextPage } } }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { q: query, after },
    );
    for (const n of data.products.nodes) {
      out.push({ id: n.id, handle: n.handle, title: n.title, status: n.status, tags: n.tags,
        variants: n.variants.nodes, variantsTruncated: n.variants.pageInfo.hasNextPage });
    }
    if (!data.products.pageInfo.hasNextPage) return out;
    after = data.products.pageInfo.endCursor;
  }
}

async function applyPlan(client: ShopifyClient, plan: VendorPlan): Promise<string[]> {
  const errors: string[] = [];
  const byProduct = new Map<string, Array<{ id: string; price: string }>>();
  for (const c of plan.priceUpdates) {
    const list = byProduct.get(c.productId) ?? [];
    list.push({ id: c.variantId, price: c.to.toFixed(2) });
    byProduct.set(c.productId, list);
  }
  for (const [productId, variants] of byProduct) {
    const data = await client.gql<{ productVariantsBulkUpdate: { userErrors: Array<{ message: string }> } }>(
      `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { message } }
      }`,
      { productId, variants },
    );
    errors.push(...data.productVariantsBulkUpdate.userErrors.map((e) => `price ${productId}: ${e.message}`));
  }
  if (!plan.draftBrake) {
    for (const d of plan.drafts) {
      errors.push(...(await client.draftProduct(d.productId)).map((m) => `draft ${d.handle}: ${m}`));
      const tagged = await client.gql<{ tagsAdd: { userErrors: Array<{ message: string }> } }>(
        `mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { message } } }`,
        { id: d.productId, tags: [WITHDRAWN_TAG] },
      );
      errors.push(...tagged.tagsAdd.userErrors.map((e) => `tag ${d.handle}: ${e.message}`));
    }
  }
  return errors;
}

/** Read the written products back; every planned write must show. */
async function verify(client: ShopifyClient, plan: VendorPlan): Promise<string[]> {
  const ids = [...new Set([...plan.priceUpdates.map((c) => c.productId), ...(plan.draftBrake ? [] : plan.drafts.map((d) => d.productId))])];
  const problems: string[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await client.gql<{ nodes: Array<{ id: string; status: string; variants: { nodes: Array<{ id: string; price: string }> } } | null> }>(
      `query($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id status variants(first: 100) { nodes { id price } } } } }`,
      { ids: ids.slice(i, i + 50) },
    );
    const byId = new Map(data.nodes.filter(Boolean).map((n) => [n!.id, n!]));
    for (const c of plan.priceUpdates) {
      const got = byId.get(c.productId)?.variants.nodes.find((v) => v.id === c.variantId)?.price;
      if (got !== undefined && Number(got) !== c.to) problems.push(`price ${c.handle} ${c.sku}: expected ${c.to}, read ${got}`);
    }
    if (!plan.draftBrake) {
      for (const d of plan.drafts) {
        const got = byId.get(d.productId)?.status;
        if (got !== undefined && got !== 'DRAFT') problems.push(`draft ${d.handle}: status ${got}`);
      }
    }
  }
  return problems;
}

function render(dryRun: boolean, plans: VendorPlan[], failures: Array<{ vendor: string; error: string }>, errors: string[]): string {
  const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const lines = [`# Vendor catalog sync — ${dryRun ? 'DRY RUN' : 'LIVE'}`, '', `Run ${new Date().toISOString()}`, ''];
  for (const f of failures) lines.push(`## ${f.vendor}`, '', `**Skipped, no writes:** the catalog could not be read (${f.error}).`, '');
  for (const p of plans) {
    lines.push(`## ${p.vendor}`, '',
      `- Vendor catalog: ${p.vendorProducts} products · ours: ${p.ours} (${p.oursActive} active) · matched: ${p.matched}`,
      `- Price updates: **${p.priceUpdates.length}** · held for review (over ${VENDOR_CATALOG_SYNC.maxPriceChangeShare * 100}% change): **${p.priceHeld.length}**`,
      `- To draft: **${p.drafts.length}**${p.draftBrake ? ` — **brake: over the limit of ${p.draftLimit}, none drafted**` : ''}`,
      `- No vendor price (left unchanged): ${p.noVendorPrice.length} · unmatched variants: ${p.unmatchedVariants.length} · skipped: ${p.skipped.length}`,
      `- Withdrawn earlier and available again (review to reactivate): ${p.availableAgain.length}`, '');
    if (p.priceUpdates.length) {
      lines.push('| Product | SKU | Ours | Vendor |', '|---|---|---|---|');
      for (const c of p.priceUpdates.slice(0, 60)) lines.push(`| ${c.handle} | ${c.sku ?? ''} | ${money(c.from)} | ${money(c.to)} |`);
      if (p.priceUpdates.length > 60) lines.push(`| … ${p.priceUpdates.length - 60} more in the JSON report | | | |`);
      lines.push('');
    }
    if (p.priceHeld.length) {
      lines.push('Held for review:', '');
      for (const c of p.priceHeld) lines.push(`- ${c.handle} (${c.sku ?? ''}): ${money(c.from)} → ${money(c.to)}`);
      lines.push('');
    }
    if (p.drafts.length) {
      lines.push(p.draftBrake ? 'Would draft (blocked by the brake):' : 'Drafted:', '');
      for (const d of p.drafts) lines.push(`- ${d.handle} — ${d.reason === 'sold_out_at_vendor' ? 'sold out at the vendor' : 'no longer in the vendor catalog'}`);
      lines.push('');
    }
    if (p.availableAgain.length) lines.push('Available again at the vendor:', '', ...p.availableAgain.map((h) => `- ${h}`), '');
  }
  if (errors.length) lines.push('## Write errors', '', ...errors.map((e) => `- ${e}`), '');
  return lines.join('\n');
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const dryRun = argv.includes('--dry-run');
  const { domain, token } = await resolveToken();
  const client = new ShopifyClient(domain, token);
  await client.verifyAuth();

  const plans: VendorPlan[] = [];
  const failures: Array<{ vendor: string; error: string }> = [];
  const errors: string[] = [];
  for (const vendor of VENDOR_CATALOG_SYNC.vendors) {
    let catalog: VendorProduct[];
    try {
      catalog = await fetchVendorCatalog(vendor.baseUrl);
    } catch (err) {
      failures.push({ vendor: vendor.name, error: err instanceof Error ? err.message : String(err) });
      continue;
    }
    const plan = planVendor(vendor, catalog, await readOurProducts(client, searchFor(vendor)));
    plans.push(plan);
    console.log(JSON.stringify({ vendor: vendor.name, vendorProducts: plan.vendorProducts, ours: plan.ours, matched: plan.matched,
      priceUpdates: plan.priceUpdates.length, priceHeld: plan.priceHeld.length, drafts: plan.drafts.length, draftBrake: plan.draftBrake }));
    if (!dryRun) {
      errors.push(...(await applyPlan(client, plan)));
      errors.push(...(await verify(client, plan)));
    }
  }

  await mkdir('out', { recursive: true });
  await writeFile('out/vendor-sync-report.json', JSON.stringify({ dryRun, failures, errors, plans }, null, 2));
  await writeFile('out/vendor-sync-report.md', render(dryRun, plans, failures, errors));
  if (failures.length || errors.length || plans.some((p) => p.draftBrake)) process.exitCode = 1;
}

if (process.argv[1]?.endsWith('vendors/sync.ts')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
