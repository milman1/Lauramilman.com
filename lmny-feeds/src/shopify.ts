import { setTimeout as sleep } from 'node:timers/promises';
import { APP_NAMESPACE, FEED_TAG, MEDIA_MISSING_TAG, METAFIELD_NAMESPACE, PRODUCT_TYPES } from './product.js';
import type { CatalogEntry } from './types.js';

const API_VERSION = '2026-01';

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
   * Ensure lmny_feed.* definitions (storefront NONE) and the app-private
   * cost_cents definition. cost_cents uses the app-reserved namespace so it
   * never reaches the Storefront API or theme. Existing definitions are left
   * untouched (TAKEN errors are ignored).
   */
  async ensureMetafieldDefinitions(): Promise<void> {
    const definitions: Array<{ namespace: string; key: string; name: string; type: string }> = [
      { namespace: METAFIELD_NAMESPACE, key: 'stock_ref', name: 'Stock ref', type: 'single_line_text_field' },
      { namespace: METAFIELD_NAMESPACE, key: 'kind', name: 'Feed kind', type: 'single_line_text_field' },
      { namespace: METAFIELD_NAMESPACE, key: 'cert_number', name: 'Cert number', type: 'single_line_text_field' },
      { namespace: METAFIELD_NAMESPACE, key: 'cert_url', name: 'Cert URL', type: 'url' },
      { namespace: METAFIELD_NAMESPACE, key: 'content_hash', name: 'Content hash', type: 'single_line_text_field' },
      { namespace: METAFIELD_NAMESPACE, key: 'synced_at', name: 'Synced at', type: 'date_time' },
      { namespace: METAFIELD_NAMESPACE, key: 'is_naked', name: 'Watch is naked', type: 'boolean' },
      { namespace: METAFIELD_NAMESPACE, key: 'comp_mid_usd', name: 'Comp mid (USD)', type: 'number_decimal' },
      { namespace: METAFIELD_NAMESPACE, key: 'comp_as_of', name: 'Comp as of', type: 'date' },
      { namespace: APP_NAMESPACE, key: 'cost_cents', name: 'Cost (cents)', type: 'number_integer' },
    ];
    const mutation = `mutation def($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id }
        userErrors { code message }
      }
    }`;
    for (const def of definitions) {
      const data = await this.gql<{
        metafieldDefinitionCreate: { userErrors: Array<{ code: string; message: string }> };
      }>(mutation, {
        definition: {
          ...def,
          ownerType: 'PRODUCT',
          access: { storefront: 'NONE' },
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
    const wanted = [
      { title: 'Natural Diamonds', type: PRODUCT_TYPES.natural },
      { title: 'Lab-Grown Diamonds', type: PRODUCT_TYPES.lab },
      { title: 'Timepieces', type: PRODUCT_TYPES.watch },
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
      const match = existing.collections.nodes.find(
        (c) => c.title === want.title && JSON.stringify(c.ruleSet ?? '').includes(FEED_TAG),
      );
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
              rules: [
                { column: 'TAG', relation: 'EQUALS', condition: FEED_TAG },
                { column: 'TYPE', relation: 'EQUALS', condition: want.type },
              ],
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

  /** Full read of feed-managed products via a bulk query (no pagination throttling). */
  async fetchCatalog(): Promise<CatalogEntry[]> {
    const query = `{
      products(query: "tag:'${FEED_TAG}'") {
        edges {
          node {
            id
            handle
            status
            tags
            metafield(namespace: "${METAFIELD_NAMESPACE}", key: "content_hash") { value }
          }
        }
      }
    }`;
    const url = await this.runBulkQuery(query);
    if (!url) return []; // zero results → Shopify provides no file
    const lines = await downloadJsonl(url);
    return lines.map((row) => {
      const r = row as { id: string; handle: string; status: string; tags: string[]; metafield: { value: string } | null };
      return {
        id: r.id,
        handle: r.handle,
        status: r.status,
        tags: r.tags ?? [],
        contentHash: r.metafield?.value ?? null,
      };
    });
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
  async auditMedia(): Promise<{ quarantined: string[] }> {
    const query = `{
      products(query: "tag:'${FEED_TAG}'") {
        edges {
          node {
            id
            handle
            status
            tags
            media {
              edges { node { id mediaContentType status } }
            }
          }
        }
      }
    }`;
    const url = await this.runBulkQuery(query);
    if (!url) return { quarantined: [] };
    const rows = await downloadJsonl(url);
    // Bulk queries flatten nested connections: media rows follow their parent
    // product row and carry __parentId.
    const products = new Map<string, { id: string; handle: string; status: string; tags: string[]; media: string[] }>();
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
        products.get(r.__parentId)?.media.push(r.status);
      }
    }
    const quarantined: string[] = [];
    for (const p of products.values()) {
      if (p.status !== 'ACTIVE' || p.tags.includes(MEDIA_MISSING_TAG)) continue;
      const failed = p.media.length === 0 || p.media.every((s) => s === 'FAILED');
      const settled = p.media.every((s) => s !== 'PROCESSING' && s !== 'UPLOADED');
      if (failed && settled) {
        const errors = await this.quarantineProduct(p.id, p.tags);
        if (errors.length === 0) quarantined.push(p.handle);
      }
    }
    return { quarantined };
  }

  private async quarantineProduct(id: string, tags: string[]): Promise<string[]> {
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
