import { setTimeout as sleep } from 'node:timers/promises';
import { APP_NAMESPACE, CUSTOM_NAMESPACE, FEED_TAG, MEDIA_MISSING_TAG, METAFIELD_NAMESPACE, OTHER_WATCH_BRAND_TAG, OTHER_WATCH_BRANDS_COLLECTION, PRODUCT_TYPES } from './product.js';
import type { BrokenMedia, CatalogEntry } from './types.js';

const API_VERSION = '2026-01';
/** Matches the feed client's identity — some supplier hosts refuse bare clients. */
const BROWSER_UA = 'Mozilla/5.0 (compatible; LMNY-FeedSync/1.0; +https://lauramilman.com)';

/**
 * Identify an image by its magic number rather than trusting the server's
 * Content-Type, which is exactly the header that's wrong on the feed images
 * Shopify rejects. Returns null for anything that isn't a recognisable image
 * — usually an HTML error page served with a .jpg URL.
 */
export function sniffImageMime(bytes: Uint8Array): string | null {
  const at = (i: number) => bytes[i] ?? -1;
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg';
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'image/png';
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46) return 'image/gif';
  // RIFF....WEBP
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 &&
      at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) return 'image/webp';
  return null;
}

/**
 * Identify a video container by its magic number, same reasoning as
 * `sniffImageMime`: the supplier serves some .mp4 files as
 * application/octet-stream, and Shopify's staged upload wants a real type.
 * Returns null for anything that isn't a recognisable video — usually an HTML
 * 360° viewer page served behind a .mp4-looking URL, which must not be
 * uploaded as media.
 */
export function sniffVideoMime(bytes: Uint8Array): string | null {
  const at = (i: number) => bytes[i] ?? -1;
  // ISO base media (MP4/MOV/M4V): a `ftyp` box at offset 4, brand at 8.
  if (at(4) === 0x66 && at(5) === 0x74 && at(6) === 0x79 && at(7) === 0x70) {
    const brand = String.fromCharCode(at(8), at(9), at(10), at(11));
    return brand === 'qt  ' ? 'video/quicktime' : 'video/mp4';
  }
  // EBML header — WebM / Matroska.
  if (at(0) === 0x1a && at(1) === 0x45 && at(2) === 0xdf && at(3) === 0xa3) return 'video/webm';
  return null;
}

interface GqlError {
  message: string;
  extensions?: { code?: string };
}

interface GqlResponse<T> {
  data?: T;
  errors?: GqlError[];
  extensions?: { cost?: { throttleStatus?: { currentlyAvailable: number; restoreRate: number } } };
}

export const PRODUCT_SET_MUTATION = `mutation call($input: ProductSetInput!) {
  productSet(input: $input) {
    product { id handle }
    userErrors { field message code }
  }
}`;

/**
 * Client-credentials grant for Dev Dashboard apps: exchanges the app's
 * Client ID + Secret for a 24h Admin API access token. This is the auth
 * path for stores migrated to the new dev platform, where static shpat_
 * custom-app tokens no longer exist. The token is minted fresh per run,
 * so expiry never matters for a CI job.
 */
export async function exchangeClientCredentials(
  domain: string,
  clientId: string,
  clientSecret: string,
): Promise<{ token: string; scope: string }> {
  const host = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const res = await fetch(`https://${host}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    const hint = text.includes('shop_not_permitted')
      ? ' (the app and store must belong to the same Dev Dashboard organization, and the app must be installed on the store)'
      : '';
    throw new Error(`Client-credentials token exchange failed: HTTP ${res.status}${hint}: ${text.slice(0, 300)}`);
  }
  const body = JSON.parse(text) as { access_token?: string; scope?: string };
  if (!body.access_token) {
    throw new Error('Client-credentials token exchange returned no access_token');
  }
  return { token: body.access_token, scope: body.scope ?? '' };
}

export class ShopifyClient {
  private endpoint: string;
  private token: string;

  constructor(domain: string, token: string) {
    const host = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    this.endpoint = `https://${host}/admin/api/${API_VERSION}/graphql.json`;
    this.token = token;
  }

  async gql<T = Record<string, unknown>>(query: string, variables?: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.token,
        },
        body: JSON.stringify({ query, variables }),
      });
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= 5) throw new Error(`Shopify HTTP ${res.status} after ${attempt + 1} attempts`);
        await sleep(2 ** attempt * 1000);
        continue;
      }
      if (!res.ok) {
        throw new Error(`Shopify HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
      }
      const body = (await res.json()) as GqlResponse<T>;
      if (body.errors?.length) {
        const throttled = body.errors.some((e) => e.extensions?.code === 'THROTTLED');
        if (throttled && attempt < 8) {
          const status = body.extensions?.cost?.throttleStatus;
          const waitMs = status ? Math.max(1000, ((2000 - status.currentlyAvailable) / status.restoreRate) * 1000) : 2000;
          await sleep(waitMs);
          continue;
        }
        throw new Error(`Shopify GraphQL: ${body.errors.map((e) => e.message).join('; ')}`);
      }
      return body.data as T;
    }
  }

  async verifyAuth(): Promise<{ shop: string }> {
    const data = await this.gql<{ shop: { name: string; myshopifyDomain: string } }>(
      `{ shop { name myshopifyDomain } }`,
    );
    return { shop: data.shop.myshopifyDomain };
  }

  /** Access scopes actually granted to this token (write_* implies read_*). */
  async grantedScopes(): Promise<string[]> {
    const data = await this.gql<{ currentAppInstallation: { accessScopes: Array<{ handle: string }> } }>(
      `{ currentAppInstallation { accessScopes { handle } } }`,
    );
    return data.currentAppInstallation.accessScopes.map((s) => s.handle);
  }

  // ---------------------------------------------------------------- metafields

  /**
   * Ensure the metafield definitions the sync writes to.
   *
   * Three groups, with deliberately different storefront access:
   *  - lmny_feed.*  sync bookkeeping, storefront NONE.
   *  - $app.*       cost_cents, app-reserved so it can never reach the
   *                 Storefront API or the theme.
   *  - custom.*     the gemological facets, PUBLIC_READ because the diamond
   *                 filter faces on them (filter.p.m.custom.<key>). These
   *                 mirror the definitions the estate catalogue already uses,
   *                 so filtering behaves the same store-wide.
   *
   * Existing definitions are left untouched (TAKEN errors are ignored) — the
   * store already has most of the custom.* set; only custom.cut is new.
   */
  async ensureMetafieldDefinitions(): Promise<void> {
    const definitions: Array<{
      namespace: string;
      key: string;
      name: string;
      type: string;
      storefront?: 'NONE' | 'PUBLIC_READ';
    }> = [
      { namespace: METAFIELD_NAMESPACE, key: 'stock_ref', name: 'Stock ref', type: 'single_line_text_field' },
      { namespace: METAFIELD_NAMESPACE, key: 'kind', name: 'Feed kind', type: 'single_line_text_field' },
      { namespace: METAFIELD_NAMESPACE, key: 'cert_number', name: 'Cert number', type: 'single_line_text_field' },
      { namespace: METAFIELD_NAMESPACE, key: 'cert_url', name: 'Cert URL', type: 'url' },
      { namespace: METAFIELD_NAMESPACE, key: 'content_hash', name: 'Content hash', type: 'single_line_text_field' },
      { namespace: METAFIELD_NAMESPACE, key: 'synced_at', name: 'Synced at', type: 'date_time' },
      { namespace: METAFIELD_NAMESPACE, key: 'is_naked', name: 'Watch is naked', type: 'boolean' },
      { namespace: METAFIELD_NAMESPACE, key: 'comp_mid_usd', name: 'Comp mid (USD)', type: 'number_decimal' },
      { namespace: METAFIELD_NAMESPACE, key: 'comp_low_usd', name: 'Comp low (USD)', type: 'number_decimal' },
      { namespace: METAFIELD_NAMESPACE, key: 'comp_anchor_usd', name: 'Comp anchor (USD)', type: 'number_decimal' },
      { namespace: METAFIELD_NAMESPACE, key: 'accessory_haircut', name: 'Accessory haircut', type: 'number_decimal' },
      { namespace: METAFIELD_NAMESPACE, key: 'comp_as_of', name: 'Comp as of', type: 'date' },
      { namespace: METAFIELD_NAMESPACE, key: 'lab', name: 'Grading lab', type: 'single_line_text_field' },
      { namespace: METAFIELD_NAMESPACE, key: 'polish', name: 'Polish', type: 'single_line_text_field' },
      { namespace: METAFIELD_NAMESPACE, key: 'symmetry', name: 'Symmetry', type: 'single_line_text_field' },
      { namespace: METAFIELD_NAMESPACE, key: 'fluorescence', name: 'Fluorescence', type: 'single_line_text_field' },
      { namespace: METAFIELD_NAMESPACE, key: 'measurements', name: 'Measurements', type: 'single_line_text_field' },
      { namespace: METAFIELD_NAMESPACE, key: 'table_pct', name: 'Table %', type: 'number_decimal' },
      { namespace: METAFIELD_NAMESPACE, key: 'depth_pct', name: 'Depth %', type: 'number_decimal' },
      { namespace: METAFIELD_NAMESPACE, key: 'video_url', name: '360° video URL', type: 'url' },
      { namespace: METAFIELD_NAMESPACE, key: 'video_urls', name: '360° video URLs', type: 'list.url' },
      { namespace: APP_NAMESPACE, key: 'cost_cents', name: 'Cost (cents)', type: 'number_integer' },
      { namespace: CUSTOM_NAMESPACE, key: 'diamond_shape', name: 'Diamond shape', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'carat_weight', name: 'Carat weight', type: 'number_decimal', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'color', name: 'Color', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'clarity', name: 'Clarity', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'cut', name: 'Cut', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      // Watch PDP specs grid (sections/main-product.liquid `.product-specs`).
      // Jewelry already uses custom.metal; watches reuse it. Blank rows hide.
      { namespace: CUSTOM_NAMESPACE, key: 'brand', name: 'Brand', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'model', name: 'Model', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'reference', name: 'Reference', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'year', name: 'Year', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'case_size', name: 'Case size', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'metal', name: 'Metal', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'dial', name: 'Dial', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'bezel', name: 'Bezel', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'bracelet', name: 'Bracelet', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'condition', name: 'Condition', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'condition_grade', name: 'Condition grade', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'box', name: 'Box', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'papers', name: 'Papers', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'original_tag', name: 'Original tag', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'link', name: 'Link', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
      { namespace: CUSTOM_NAMESPACE, key: 'stock_number', name: 'Stock #', type: 'single_line_text_field', storefront: 'PUBLIC_READ' },
    ];
    const mutation = `mutation def($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id }
        userErrors { code message }
      }
    }`;
    for (const { storefront = 'NONE', ...def } of definitions) {
      const data = await this.gql<{
        metafieldDefinitionCreate: { userErrors: Array<{ code: string; message: string }> };
      }>(mutation, {
        definition: {
          ...def,
          ownerType: 'PRODUCT',
          access: { storefront },
        },
      });
      const errors = data.metafieldDefinitionCreate.userErrors.filter((e) => e.code !== 'TAKEN');
      if (errors.length) {
        throw new Error(`metafieldDefinitionCreate ${def.namespace}.${def.key}: ${errors.map((e) => e.message).join('; ')}`);
      }
    }
  }

  // --------------------------------------------------------------- collections

  /**
   * Ensure the three automated feed collections. Keyed on the lmny-feed tag
   * plus product type, so existing (non-feed) estate watches and jewelry are
   * never swept in. "Peaceful Diamonds by LMNY" is deliberately left alone.
   *
   * collectionCreate does NOT publish to the Online Store (unlike the admin
   * UI, which publishes by default) — an unpublished collection 404s on the
   * storefront. Collections created here are therefore published explicitly.
   * Collections that already exist are left as-is: whether an existing
   * collection is visible is a merchandising decision, not the sync's call.
   * Unpublished pre-existing ones are reported so they aren't silently
   * invisible.
   */
  async ensureCollections(): Promise<string[]> {
    const wanted: Array<{
      title: string;
      rules: Array<{ column: string; relation: string; condition: string }>;
    }> = [
      {
        title: 'Natural Diamonds',
        rules: [
          { column: 'TAG', relation: 'EQUALS', condition: FEED_TAG },
          { column: 'TYPE', relation: 'EQUALS', condition: PRODUCT_TYPES.natural },
        ],
      },
      {
        title: 'Lab-Grown Diamonds',
        rules: [
          { column: 'TAG', relation: 'EQUALS', condition: FEED_TAG },
          { column: 'TYPE', relation: 'EQUALS', condition: PRODUCT_TYPES.lab },
        ],
      },
      {
        title: 'Timepieces',
        rules: [
          { column: 'TAG', relation: 'EQUALS', condition: FEED_TAG },
          { column: 'TYPE', relation: 'EQUALS', condition: PRODUCT_TYPES.watch },
        ],
      },
      {
        // Brands outside the curated WATCH_BRANDS list. Same product type as
        // Timepieces; the extra tag keeps them filterable as a group.
        title: OTHER_WATCH_BRANDS_COLLECTION,
        rules: [
          { column: 'TAG', relation: 'EQUALS', condition: FEED_TAG },
          { column: 'TAG', relation: 'EQUALS', condition: OTHER_WATCH_BRAND_TAG },
          { column: 'TYPE', relation: 'EQUALS', condition: PRODUCT_TYPES.watch },
        ],
      },
    ];
    const created: string[] = [];
    const publicationId = await this.onlineStorePublicationId();
    for (const want of wanted) {
      const existing = await this.gql<{
        collections: {
          nodes: Array<{
            id: string;
            title: string;
            handle: string;
            ruleSet: unknown;
            resourcePublications: { nodes: Array<{ isPublished: boolean }> };
          }>;
        };
      }>(
        `query($q: String!) {
          collections(first: 10, query: $q) {
            nodes {
              id title handle
              ruleSet { rules { column condition } }
              resourcePublications(first: 10) { nodes { isPublished } }
            }
          }
        }`,
        { q: `title:'${want.title}'` },
      );
      // Match on title alone. Matching on the rule set instead meant an
      // existing collection with the right name but different rules went
      // unrecognised and a second one was created beside it — which is how
      // the store ended up with two "Timepieces". The merchant's own
      // collection of that name is the one to use; broadening its rules to
      // cover feed products is their call, not the sync's.
      const match = existing.collections.nodes.find((c) => c.title === want.title);
      if (match) {
        // Report, don't silently change: publishing an existing collection is
        // a storefront-visibility decision for the merchant to make.
        const published = match.resourcePublications.nodes.some((p) => p.isPublished);
        if (!published) {
          console.warn(
            `Collection "${match.title}" (/collections/${match.handle}) exists but is not published — it will 404 on the storefront until published.`,
          );
        }
        continue;
      }
      const data = await this.gql<{ collectionCreate: { collection: { id: string } | null; userErrors: Array<{ message: string }> } }>(
        `mutation($input: CollectionInput!) {
          collectionCreate(input: $input) { collection { id } userErrors { message } }
        }`,
        {
          input: {
            title: want.title,
            ruleSet: {
              appliedDisjunctively: false,
              rules: want.rules,
            },
          },
        },
      );
      if (data.collectionCreate.userErrors.length) {
        throw new Error(`collectionCreate ${want.title}: ${data.collectionCreate.userErrors.map((e) => e.message).join('; ')}`);
      }
      const collectionId = data.collectionCreate.collection?.id;
      if (collectionId) {
        // Without this the collection exists in admin but 404s on the storefront.
        const errors = await this.publishResource(collectionId, publicationId);
        if (errors.length) {
          throw new Error(`publish collection ${want.title}: ${errors.join('; ')}`);
        }
      }
      created.push(want.title);
    }
    return created;
  }

  // -------------------------------------------------------------- catalog read

  /**
   * Full read of feed-managed products via a bulk query (no pagination throttling).
   *
   * Includes every `lmny-feed` product plus every Watch product. Feed watches
   * use `w-<stock>` handles; those that lost the tag (or never got it) still
   * have to be visible to the diff so a successful watch fetch can archive
   * them when they leave the API. Estate watches use non-`w-` handles and
   * `kindForHandle` ignores them — they are never archived by this path.
   *
   * mediaCount deliberately counts only READY media. Shopify's own mediaCount
   * includes FAILED images, and a failed image is worse than none — the
   * product reports that it has a picture while the storefront shows the
   * default placeholder. The supplier serves some images as
   * application/octet-stream, which Shopify refuses with
   * UNSUPPORTED_IMAGE_FILE_TYPE, so this is a live condition, not a theoretical
   * one. Counting only usable media means those products look imageless to the
   * sync, which is the truth: files get re-sent, and if that fails again the
   * media audit quarantines them.
   */
  async fetchCatalog(): Promise<CatalogEntry[]> {
    const query = `{
      products(query: "tag:'${FEED_TAG}' OR product_type:'${PRODUCT_TYPES.watch}'") {
        edges {
          node {
            id
            handle
            status
            tags
            metafield(namespace: "${METAFIELD_NAMESPACE}", key: "content_hash") { value }
            media { edges { node { status mediaContentType } } }
          }
        }
      }
    }`;
    const url = await this.runBulkQuery(query);
    if (!url) return []; // zero results → Shopify provides no file
    const lines = await downloadJsonl(url);
    // Bulk queries flatten nested connections: each media row follows its
    // parent product row and carries __parentId.
    const byId = new Map<string, CatalogEntry>();
    const order: string[] = [];
    for (const row of lines) {
      const r = row as Record<string, unknown>;
      if (typeof r.handle === 'string') {
        const id = r.id as string;
        byId.set(id, {
          id,
          handle: r.handle,
          status: r.status as string,
          tags: (r.tags as string[]) ?? [],
          mediaCount: 0,
          imageCount: 0,
          videoCount: 0,
          contentHash: (r.metafield as { value: string } | null)?.value ?? null,
        });
        order.push(id);
      } else if (typeof r.__parentId === 'string' && typeof r.status === 'string') {
        const parent = byId.get(r.__parentId);
        if (!parent) continue;
        if (r.status === 'READY') parent.mediaCount += 1;
        if (r.mediaContentType === 'VIDEO') {
          // Count PROCESSING/UPLOADED too: a transcoding video already exists,
          // and re-staging it would attach a second copy.
          if (r.status !== 'FAILED') parent.videoCount += 1;
        } else if (r.status === 'READY') {
          parent.imageCount += 1;
        }
      }
    }
    return order.map((id) => byId.get(id)!);
  }

  private async runBulkQuery(query: string): Promise<string | null> {
    const data = await this.gql<{
      bulkOperationRunQuery: { bulkOperation: { id: string } | null; userErrors: Array<{ message: string }> };
    }>(
      `mutation($query: String!) {
        bulkOperationRunQuery(query: $query) { bulkOperation { id } userErrors { message } }
      }`,
      { query },
    );
    if (data.bulkOperationRunQuery.userErrors.length) {
      throw new Error(`bulkOperationRunQuery: ${data.bulkOperationRunQuery.userErrors.map((e) => e.message).join('; ')}`);
    }
    return this.pollBulkOperation('QUERY');
  }

  private async pollBulkOperation(type: 'QUERY' | 'MUTATION'): Promise<string | null> {
    for (let i = 0; i < 360; i++) {
      await sleep(Math.min(10_000, 1000 * (i + 1)));
      const data = await this.gql<{
        currentBulkOperation: { status: string; errorCode: string | null; url: string | null; objectCount: string } | null;
      }>(`{ currentBulkOperation(type: ${type}) { status errorCode url objectCount } }`);
      const op = data.currentBulkOperation;
      if (!op) throw new Error(`No current bulk ${type.toLowerCase()} operation found`);
      if (op.status === 'COMPLETED') return op.url;
      if (['FAILED', 'CANCELED', 'EXPIRED'].includes(op.status)) {
        throw new Error(`Bulk ${type.toLowerCase()} ${op.status}: ${op.errorCode ?? 'unknown error'}`);
      }
    }
    throw new Error(`Bulk ${type.toLowerCase()} operation timed out`);
  }

  // ------------------------------------------------------------------- writes

  /** Direct (non-bulk) productSet for small daily deltas. */
  async productSet(input: Record<string, unknown>): Promise<{ id: string | null; errors: string[] }> {
    const data = await this.gql<{
      productSet: { product: { id: string } | null; userErrors: Array<{ message: string; field: string[] | null }> };
    }>(
      `mutation($input: ProductSetInput!, $synchronous: Boolean!) {
        productSet(input: $input, synchronous: $synchronous) {
          product { id }
          userErrors { field message }
        }
      }`,
      { input, synchronous: true },
    );
    return {
      id: data.productSet.product?.id ?? null,
      errors: data.productSet.userErrors.map((e) => `${(e.field ?? []).join('.')}: ${e.message}`),
    };
  }

  /**
   * Bulk path for large deltas / the initial ~3,800-product load:
   * staged JSONL upload + bulkOperationRunMutation(productSet).
   * Returns per-line results parsed from the operation's result file.
   */
  async bulkProductSet(inputs: Array<Record<string, unknown>>): Promise<{ ids: string[]; errors: string[] }> {
    const jsonl = inputs.map((input) => JSON.stringify({ input })).join('\n');
    const stagedPath = await this.stageJsonlUpload(jsonl);
    const data = await this.gql<{
      bulkOperationRunMutation: { bulkOperation: { id: string } | null; userErrors: Array<{ message: string }> };
    }>(
      `mutation($mutation: String!, $stagedUploadPath: String!) {
        bulkOperationRunMutation(mutation: $mutation, stagedUploadPath: $stagedUploadPath) {
          bulkOperation { id }
          userErrors { message }
        }
      }`,
      { mutation: PRODUCT_SET_MUTATION, stagedUploadPath: stagedPath },
    );
    if (data.bulkOperationRunMutation.userErrors.length) {
      throw new Error(`bulkOperationRunMutation: ${data.bulkOperationRunMutation.userErrors.map((e) => e.message).join('; ')}`);
    }
    const url = await this.pollBulkOperation('MUTATION');
    const ids: string[] = [];
    const errors: string[] = [];
    if (url) {
      for (const row of await downloadJsonl(url)) {
        const r = row as { data?: { productSet?: { product?: { id: string } | null; userErrors?: Array<{ message: string }> } } };
        const ps = r.data?.productSet;
        if (ps?.product?.id) ids.push(ps.product.id);
        for (const e of ps?.userErrors ?? []) errors.push(e.message);
      }
    }
    return { ids, errors };
  }

  private async stageJsonlUpload(jsonl: string): Promise<string> {
    const data = await this.gql<{
      stagedUploadsCreate: {
        stagedTargets: Array<{ url: string; resourceUrl: string; parameters: Array<{ name: string; value: string }> }>;
        userErrors: Array<{ message: string }>;
      };
    }>(
      `mutation($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { message }
        }
      }`,
      {
        input: [
          {
            resource: 'BULK_MUTATION_VARIABLES',
            filename: 'productset.jsonl',
            mimeType: 'text/jsonl',
            httpMethod: 'POST',
          },
        ],
      },
    );
    if (data.stagedUploadsCreate.userErrors.length) {
      throw new Error(`stagedUploadsCreate: ${data.stagedUploadsCreate.userErrors.map((e) => e.message).join('; ')}`);
    }
    const target = data.stagedUploadsCreate.stagedTargets[0];
    if (!target) throw new Error('stagedUploadsCreate returned no target');
    const form = new FormData();
    for (const p of target.parameters) form.append(p.name, p.value);
    form.append('file', new Blob([jsonl], { type: 'text/jsonl' }), 'productset.jsonl');
    const res = await fetch(target.url, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Staged upload failed: HTTP ${res.status}`);
    const keyParam = target.parameters.find((p) => p.name === 'key');
    if (!keyParam) throw new Error('Staged upload target has no key parameter');
    return keyParam.value;
  }

  /**
   * Point a sold stone's URL at its collection instead of leaving a 404.
   *
   * An archived product 404s on the storefront, so every stone that sells
   * turns a live, indexed page into a dead link — bad for anyone following an
   * old link, and bad for the search ranking those pages earn. A redirect
   * lands the visitor on the collection, where the stones we do have are.
   *
   * Idempotent: an existing redirect for the path comes back as TAKEN and is
   * treated as success.
   */
  async redirectProductUrl(handle: string, target: string): Promise<string[]> {
    const data = await this.gql<{
      urlRedirectCreate: { userErrors: Array<{ code: string | null; message: string }> };
    }>(
      `mutation($redirect: UrlRedirectInput!) {
        urlRedirectCreate(urlRedirect: $redirect) {
          urlRedirect { id }
          userErrors { code message }
        }
      }`,
      { redirect: { path: `/products/${handle}`, target } },
    );
    return data.urlRedirectCreate.userErrors.filter((e) => e.code !== 'TAKEN').map((e) => e.message);
  }

  /**
   * Look up a product by exact handle. Used to find the pre-`bv-` CSV
   * import that shares The Back Vault source handle with a synced listing.
   */
  async findProductByHandle(handle: string): Promise<{
    id: string;
    handle: string;
    status: string;
    tags: string[];
  } | null> {
    const data = await this.gql<{
      products: { nodes: Array<{ id: string; handle: string; status: string; tags: string[] }> };
    }>(
      `query($q: String!) {
        products(first: 5, query: $q) {
          nodes { id handle status tags }
        }
      }`,
      { q: `handle:${handle}` },
    );
    return data.products.nodes.find((n) => n.handle === handle) ?? null;
  }

  /**
   * Create a URL redirect, or update the existing one when the path is taken.
   * The Back Vault CSV duplicates already have storefront URLs; those must
   * follow the new `bv-` handle (and later `/collections/all` if that SKU
   * leaves the feed). Treating TAKEN as success would leave a stale target.
   */
  async upsertUrlRedirect(path: string, target: string): Promise<string[]> {
    const created = await this.gql<{
      urlRedirectCreate: { userErrors: Array<{ code: string | null; message: string }> };
    }>(
      `mutation($redirect: UrlRedirectInput!) {
        urlRedirectCreate(urlRedirect: $redirect) {
          urlRedirect { id }
          userErrors { code message }
        }
      }`,
      { redirect: { path, target } },
    );
    const errors = created.urlRedirectCreate.userErrors;
    const other = errors.filter((e) => e.code !== 'TAKEN').map((e) => e.message);
    if (!errors.some((e) => e.code === 'TAKEN')) return other;

    const found = await this.gql<{
      urlRedirects: { nodes: Array<{ id: string; path: string; target: string }> };
    }>(
      `query($q: String!) {
        urlRedirects(first: 10, query: $q) { nodes { id path target } }
      }`,
      { q: `path:${path}` },
    );
    const existing = found.urlRedirects.nodes.find((n) => n.path === path);
    if (!existing) return other.length ? other : [`redirect TAKEN but no existing row for ${path}`];
    if (existing.target === target) return other;

    const updated = await this.gql<{
      urlRedirectUpdate: { userErrors: Array<{ message: string }> };
    }>(
      `mutation($id: ID!, $urlRedirect: UrlRedirectInput!) {
        urlRedirectUpdate(id: $id, urlRedirect: $urlRedirect) {
          userErrors { message }
        }
      }`,
      { id: existing.id, urlRedirect: { path, target } },
    );
    return [...other, ...updated.urlRedirectUpdate.userErrors.map((e) => e.message)];
  }

  async archiveProduct(id: string): Promise<string[]> {
    const data = await this.gql<{
      productUpdate: { userErrors: Array<{ message: string }> };
    }>(
      `mutation($product: ProductUpdateInput!) {
        productUpdate(product: $product) { userErrors { message } }
      }`,
      { product: { id, status: 'ARCHIVED' } },
    );
    return data.productUpdate.userErrors.map((e) => e.message);
  }

  // ------------------------------------------------------------- publications

  async onlineStorePublicationId(): Promise<string> {
    const data = await this.gql<{ publications: { nodes: Array<{ id: string; name: string }> } }>(
      `{ publications(first: 25) { nodes { id name } } }`,
    );
    const online = data.publications.nodes.find((p) => p.name === 'Online Store') ?? data.publications.nodes[0];
    if (!online) throw new Error('No publications found');
    return online.id;
  }

  async publishResource(id: string, publicationId: string): Promise<string[]> {
    const data = await this.gql<{
      publishablePublish: { userErrors: Array<{ message: string }> };
    }>(
      `mutation($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) { userErrors { message } }
      }`,
      { id, input: [{ publicationId }] },
    );
    return data.publishablePublish.userErrors.map((e) => e.message);
  }

  // -------------------------------------------------------------- media audit

  /**
   * Products whose media all failed processing (dead source URLs) get the
   * media-missing tag and DRAFT status. Runs at the start of each live sync,
   * auditing the previous run's async media processing.
   */
  async auditMedia(): Promise<BrokenMedia[]> {
    const query = `{
      products(query: "tag:'${FEED_TAG}'") {
        edges {
          node {
            id
            handle
            status
            tags
            media {
              edges { node { id status } }
            }
          }
        }
      }
    }`;
    const url = await this.runBulkQuery(query);
    if (!url) return [];
    const rows = await downloadJsonl(url);
    // Bulk queries flatten nested connections: media rows follow their parent
    // product row and carry __parentId.
    const products = new Map<string, { id: string; handle: string; status: string; tags: string[]; media: Array<{ id: string; status: string }> }>();
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      if (typeof r.handle === 'string') {
        products.set(r.id as string, {
          id: r.id as string,
          handle: r.handle,
          status: r.status as string,
          tags: (r.tags as string[]) ?? [],
          media: [],
        });
      } else if (typeof r.__parentId === 'string' && typeof r.status === 'string') {
        products.get(r.__parentId)?.media.push({ id: r.id as string, status: r.status });
      }
    }
    const broken: BrokenMedia[] = [];
    for (const p of products.values()) {
      if (p.status === 'ARCHIVED') continue;
      const usable = p.media.some((m) => m.status === 'READY');
      // Media still uploading isn't broken — it just hasn't finished.
      const settled = p.media.every((m) => m.status !== 'PROCESSING' && m.status !== 'UPLOADED');
      if (usable || !settled) continue;
      broken.push({
        id: p.id,
        handle: p.handle,
        status: p.status,
        tags: p.tags,
        failedMediaIds: p.media.filter((m) => m.status === 'FAILED').map((m) => m.id),
      });
    }
    return broken;
  }

  /**
   * Re-host an image Shopify refused to fetch for itself.
   *
   * Attaching by URL is the cheap path and works for most of the feed, but
   * some supplier images are served as application/octet-stream and Shopify
   * rejects them with UNSUPPORTED_IMAGE_FILE_TYPE — the file is a perfectly
   * good JPEG, the Content-Type header just doesn't say so. Fetching the
   * bytes here and uploading them with a type sniffed from the file's own
   * magic number sidesteps the supplier's header entirely.
   *
   * Returns the staged resource URL, or null if the image can't be fetched or
   * isn't actually an image.
   */
  async rehostImage(sourceUrl: string): Promise<string | null> {
    let bytes: Uint8Array;
    try {
      const res = await fetch(sourceUrl, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'image/*,*/*' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) return null;
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch {
      return null;
    }
    const mime = sniffImageMime(bytes);
    if (!mime) return null; // not an image at all — nothing to rescue

    const filename = `${sourceUrl.split('/').filter(Boolean).slice(-2).join('-').replace(/[^\w.-]/g, '-')}`;
    const data = await this.gql<{
      stagedUploadsCreate: {
        stagedTargets: Array<{ url: string; resourceUrl: string; parameters: Array<{ name: string; value: string }> }>;
        userErrors: Array<{ message: string }>;
      };
    }>(
      `mutation($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { message }
        }
      }`,
      { input: [{ resource: 'IMAGE', filename, mimeType: mime, httpMethod: 'POST', fileSize: String(bytes.byteLength) }] },
    );
    if (data.stagedUploadsCreate.userErrors.length) return null;
    const target = data.stagedUploadsCreate.stagedTargets[0];
    if (!target) return null;

    const form = new FormData();
    for (const p of target.parameters) form.append(p.name, p.value);
    form.append('file', new Blob([bytes as BlobPart], { type: mime }), filename);
    const upload = await fetch(target.url, { method: 'POST', body: form });
    if (!upload.ok) return null;
    return target.resourceUrl;
  }

  /** Drop media that failed to process, so a rescued image isn't stacked behind it. */
  async deleteMedia(productId: string, mediaIds: string[]): Promise<string[]> {
    if (mediaIds.length === 0) return [];
    const data = await this.gql<{ productDeleteMedia: { mediaUserErrors: Array<{ message: string }> } }>(
      `mutation($productId: ID!, $mediaIds: [ID!]!) {
        productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
          mediaUserErrors { message }
        }
      }`,
      { productId, mediaIds },
    );
    return data.productDeleteMedia.mediaUserErrors.map((e) => e.message);
  }

  /**
   * Re-host a feed video so it can be attached as Shopify media.
   *
   * Images attach straight from a supplier URL; video does not — Shopify only
   * accepts VIDEO media from a staged upload, which is why the feed's .mp4s
   * were never attached at all and every watch showed zero videos. This is the
   * image rescue path with a video resource: fetch the bytes, confirm from the
   * magic number that it really is a video, stage, upload.
   *
   * Skips anything over `maxBytes` on the Content-Length rather than buffering
   * it — a runner holds these in memory.
   */
  async rehostVideo(sourceUrl: string, maxBytes = 200 * 1024 * 1024): Promise<string | null> {
    let bytes: Uint8Array;
    try {
      const res = await fetch(sourceUrl, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'video/*,*/*' },
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) return null;
      const declared = Number(res.headers.get('content-length') ?? '0');
      if (declared > maxBytes) {
        await res.body?.cancel();
        return null;
      }
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch {
      return null;
    }
    if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) return null;
    const mime = sniffVideoMime(bytes);
    if (!mime) return null; // a 360° viewer page or a dead link, not a video

    const ext = mime === 'video/webm' ? 'webm' : mime === 'video/quicktime' ? 'mov' : 'mp4';
    const stem = sourceUrl.split('/').filter(Boolean).slice(-2).join('-').replace(/[^\w.-]/g, '-');
    const filename = /\.(mp4|mov|webm)$/i.test(stem) ? stem : `${stem}.${ext}`;
    const data = await this.gql<{
      stagedUploadsCreate: {
        stagedTargets: Array<{ url: string; resourceUrl: string; parameters: Array<{ name: string; value: string }> }>;
        userErrors: Array<{ message: string }>;
      };
    }>(
      `mutation($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { message }
        }
      }`,
      { input: [{ resource: 'VIDEO', filename, mimeType: mime, httpMethod: 'POST', fileSize: String(bytes.byteLength) }] },
    );
    if (data.stagedUploadsCreate.userErrors.length) return null;
    const target = data.stagedUploadsCreate.stagedTargets[0];
    if (!target) return null;

    const form = new FormData();
    for (const p of target.parameters) form.append(p.name, p.value);
    form.append('file', new Blob([bytes as BlobPart], { type: mime }), filename);
    const upload = await fetch(target.url, { method: 'POST', body: form });
    if (!upload.ok) return null;
    return target.resourceUrl;
  }

  /**
   * Attach already-staged media to a product. Video processing is async, so
   * this returning cleanly means Shopify accepted the upload, not that the
   * video is playable yet — the next run's catalog read confirms that.
   */
  async attachMedia(
    productId: string,
    resourceUrl: string,
    alt: string,
    mediaContentType: 'IMAGE' | 'VIDEO' = 'IMAGE',
  ): Promise<string[]> {
    const data = await this.gql<{ productCreateMedia: { mediaUserErrors: Array<{ message: string }> } }>(
      `mutation($productId: ID!, $media: [CreateMediaInput!]!) {
        productCreateMedia(productId: $productId, media: $media) {
          mediaUserErrors { message }
        }
      }`,
      { productId, media: [{ originalSource: resourceUrl, mediaContentType, alt }] },
    );
    return data.productCreateMedia.mediaUserErrors.map((e) => e.message);
  }

  /** Put a rescued product back on the storefront. */
  async unquarantineProduct(id: string, tags: string[]): Promise<string[]> {
    const data = await this.gql<{ productUpdate: { userErrors: Array<{ message: string }> } }>(
      `mutation($product: ProductUpdateInput!) {
        productUpdate(product: $product) { userErrors { message } }
      }`,
      { product: { id, status: 'ACTIVE', tags: tags.filter((t) => t !== MEDIA_MISSING_TAG) } },
    );
    return data.productUpdate.userErrors.map((e) => e.message);
  }

  async quarantineProduct(id: string, tags: string[]): Promise<string[]> {
    const data = await this.gql<{
      productUpdate: { userErrors: Array<{ message: string }> };
    }>(
      `mutation($product: ProductUpdateInput!) {
        productUpdate(product: $product) { userErrors { message } }
      }`,
      { product: { id, status: 'DRAFT', tags: [...new Set([...tags, MEDIA_MISSING_TAG])] } },
    );
    return data.productUpdate.userErrors.map((e) => e.message);
  }

  /** Replace product tags without touching status, variants, or price. */
  async setProductTags(id: string, tags: string[]): Promise<string[]> {
    const data = await this.gql<{ productUpdate: { userErrors: Array<{ message: string }> } }>(
      `mutation($product: ProductUpdateInput!) {
        productUpdate(product: $product) { userErrors { message } }
      }`,
      { product: { id, tags: [...new Set(tags)] } },
    );
    return data.productUpdate.userErrors.map((e) => e.message);
  }
}

export async function downloadJsonl(url: string): Promise<unknown[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`JSONL download failed: HTTP ${res.status}`);
  const text = await res.text();
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));
}
