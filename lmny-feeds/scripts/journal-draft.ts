/**
 * Weekly Journal drafting job (AGENTS.md recipe F,
 * docs/audits/2026-09-09-site-audit.md section 3).
 *
 *   npx tsx scripts/journal-draft.ts               # live: creates UNPUBLISHED articles
 *   npx tsx scripts/journal-draft.ts --dry-run     # writes out/journal-draft-N.md, no Shopify writes
 *   npx tsx scripts/journal-draft.ts --count=3     # how many drafts to write (default 2)
 *
 * What it does, in order:
 *   1. Gathers this week's hooks (red carpet and premiere jewelry, watch
 *      sightings on athletes and musicians, auction results, brand launches,
 *      nightlife openings in New York, Miami, Los Angeles, Las Vegas) with
 *      Claude Sonnet 5 and the web_search server tool, falling back to a fixed
 *      list of public RSS feeds read with plain fetch when web search is not
 *      available to the API key. Shortlists ten with a why and a source URL
 *      and writes out/journal-hooks.md.
 *   2. Reads the store's live ACTIVE products (estate, watch, fine, lab-grown)
 *      and every collection, so a draft can only link to handles that exist.
 *   3. Writes `count` drafts with Claude Opus 5 in the Journal voice, using the
 *      blog's own published articles as the voice reference.
 *   4. Runs the guardrails in `checkDraft` (below) over every draft and
 *      regenerates once with the violations fed back. A draft that fails twice
 *      is rejected and never reaches Shopify.
 *   5. Creates each surviving draft as an UNPUBLISHED article on blog `journal`
 *      (`articleCreate`, `isPublished: false`, author "Laura Milman New York",
 *      tag `journal-draft`, featured image taken from the featured product).
 *      A person publishes. This job never publishes.
 *   6. Deletes unpublished articles on that blog that are older than 21 days
 *      and carry the `journal-draft` tag. Nothing else is ever deleted.
 *
 * Env: SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN (or SHOPIFY_CLIENT_ID +
 * SHOPIFY_CLIENT_SECRET), ANTHROPIC_API_KEY.
 * Output: out/journal-hooks.md, out/journal-report.md, and in a dry run
 * out/journal-draft-N.md.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { containsBackVaultReference } from '../src/backvault/scrub.js';
import { exchangeClientCredentials, ShopifyClient } from '../src/shopify.js';

const OUT_DIR = 'out';
const BLOG_HANDLE = 'journal';
const AUTHOR_NAME = 'Laura Milman New York';

/** Model routing, AGENTS.md section 3. */
const HOOK_MODEL = 'claude-sonnet-5';
const ARTICLE_MODEL = 'claude-opus-5';

// ---------------------------------------------------------------- constants

/** Tag added to every draft this job creates; housekeeping only ever touches these. */
export const JOURNAL_DRAFT_TAG = 'journal-draft';

/** Unpublished drafts older than this are deleted by the next run. */
export const DRAFT_MAX_AGE_DAYS = 21;

/**
 * The tag set already in use on the nine live Journal articles. A draft may
 * only use tags from this list (AGENTS.md recipe I item 6: no new tag without
 * a reason). `journal-draft` is added by the job, not chosen by the model.
 */
export const JOURNAL_TAGS = [
  'Buying Guide',
  'Vintage Watches',
  'Watches',
  'Estate Jewelry',
  'Jewelry Styling',
  'Style & Trends',
  'Vintage Jewelry',
  'Cartier',
  'Estate & Signed Jewelry',
  'Tiffany',
  'Van Cleef & Arpels',
  'Date Night',
  'Style',
  'Certification',
  'Diamond Education',
  'Lab Grown Diamonds',
  'How To',
  'Engagement Rings',
  'NYC',
  'Diamond Guide',
] as const;

/** lmny-feeds/docs/seo-title-formulas.md. */
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;

/** Audit section 3 item 2. */
export const WORD_COUNT_MIN = 900;
export const WORD_COUNT_MAX = 1400;
export const MIN_STORE_LINKS = 3;
export const FAQ_QUESTIONS = 3;

/** How many products the prompt is allowed to see (the whole fetch is still validated against). */
const MAX_PRODUCTS_IN_PROMPT = 400;

/**
 * Public feeds used only when the web_search server tool is unavailable to the
 * API key. Read with plain `fetch`; a feed that fails is skipped, never fatal.
 */
export const FALLBACK_HOOK_FEEDS = [
  'https://www.hollywoodreporter.com/c/fashion/feed/',
  'https://wwd.com/feed/',
  'https://www.thefashionlaw.com/feed/',
  'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml',
  'https://www.timeout.com/newyork/feed.rss',
] as const;

// ---------------------------------------------------------------- types

export interface DraftFaqItem {
  question: string;
  answer: string;
}

/** What the article model must return, one per draft. */
export interface JournalDraft {
  title: string;
  seoTitle: string;
  seoDescription: string;
  summary: string;
  bodyHtml: string;
  faq: DraftFaqItem[];
  tags: string[];
  featuredProductHandle: string;
  hook: string;
}

export interface StoreCatalog {
  /** Product handles that exist and are ACTIVE. */
  productHandles: Set<string>;
  /** Collection handles that exist. */
  collectionHandles: Set<string>;
}

export type ViolationKind =
  | 'celebrity-claim'
  | 'supplier-name'
  | 'price'
  | 'unknown-handle'
  | 'external-link'
  | 'unknown-tag'
  | 'seo-title-length'
  | 'seo-description-length'
  | 'too-few-links'
  | 'word-count'
  | 'faq-count'
  | 'featured-handle'
  | 'model-error';

export interface Violation {
  kind: ViolationKind;
  detail: string;
}

export interface StoreLink {
  kind: 'product' | 'collection';
  handle: string;
}

export interface JournalArticle {
  id: string;
  title: string;
  handle: string;
  tags: string[];
  isPublished: boolean;
  createdAt: string;
  publishedAt: string | null;
}

export interface HookItem {
  headline: string;
  why: string;
  sourceUrl: string;
}

export interface ProductRow {
  handle: string;
  title: string;
  productType: string;
  vendor: string;
  tags: string[];
  imageUrl: string | null;
  imageAlt: string | null;
  segment: string;
}

export interface CollectionRow {
  handle: string;
  title: string;
}

// ---------------------------------------------------------------- pure helpers

/** Strip HTML tags and collapse entities enough to count words. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(html: string): number {
  const text = stripHtml(html);
  return text.length === 0 ? 0 : text.split(/\s+/).length;
}

/** Every `href` in the HTML, in document order. */
export function extractHrefs(html: string): string[] {
  const out: string[] = [];
  const re = /href\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push((m[2] ?? m[3] ?? '').trim());
  }
  return out;
}

/**
 * Parse a store link out of an href. Returns null for anything that is not a
 * product or collection URL on our own store — including absolute links to
 * other sites, which the guardrails reject outright.
 */
export function parseStoreLink(href: string): StoreLink | null {
  if (href.length === 0) return null;
  let path = href;
  const absolute = /^https?:\/\/([^/]+)(\/.*)?$/i.exec(href);
  if (absolute) {
    const host = (absolute[1] ?? '').toLowerCase().replace(/^www\./, '');
    if (host !== 'lauramilman.com') return null;
    path = absolute[2] ?? '/';
  } else if (!href.startsWith('/')) {
    return null;
  }
  const m = /^\/(products|collections)\/([A-Za-z0-9][A-Za-z0-9_-]*)\/?(?:[?#].*)?$/.exec(path);
  if (!m) return null;
  return { kind: m[1] === 'products' ? 'product' : 'collection', handle: (m[2] ?? '').toLowerCase() };
}

/** All product and collection links in the body, deduplicated. */
export function extractStoreLinks(html: string): StoreLink[] {
  const seen = new Set<string>();
  const out: StoreLink[] = [];
  for (const href of extractHrefs(html)) {
    const link = parseStoreLink(href);
    if (!link) continue;
    const key = `${link.kind}:${link.handle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link);
  }
  return out;
}

/** Hrefs that are not links to a product or collection on our own store. */
export function findExternalLinks(html: string): string[] {
  return extractHrefs(html).filter((href) => parseStoreLink(href) === null);
}

const PRICE_PATTERNS: RegExp[] = [
  // $1,200 / $ 950 / US$4,500 / $12.5k
  /(?:US\s*)?\$\s?\d[\d,.]*\s*(?:k|K|m|M|million)?/g,
  // 1,200 dollars / 950 USD
  /\b\d[\d,.]*\s*(?:dollars|USD)\b/gi,
  // "priced at four thousand", "under twenty thousand dollars"
  /\b(?:priced at|costs?|retails? for|starting at)\b[^.]{0,40}?\b(?:hundred|thousand|million)\b/gi,
];

/** Any dollar price in the copy. Prices change; the Journal never states one. */
export function findPrices(text: string): string[] {
  const plain = stripHtml(text);
  const hits: string[] = [];
  for (const pattern of PRICE_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(plain)) !== null) {
      hits.push(m[0].trim());
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }
  return hits;
}

/**
 * Verbs that assert a specific actor owns or wore something. Deliberately no
 * bare infinitive ("wear", "buy"): "you can wear our Tank" is normal styling
 * copy, "she wears our Tank" is an ownership claim.
 */
const OWNERSHIP_VERB =
  /(?<![\w-])(owns|owned|wears|wore|wearing|bought|buys|purchased|picked up|sported|was gifted|received)(?![\w-])/i;

/**
 * A reference that ties the sentence to our own inventory: a link to a product
 * or collection, a first-person possessive, or an availability phrase.
 */
const OUR_INVENTORY_REFERENCE =
  /(href\s*=\s*["']\s*(?:https?:\/\/(?:www\.)?lauramilman\.com)?\/(?:products|collections)\/)|\b(our|we sell|we carry|we stock|this exact piece|the piece below|in our vault|available here|shop (?:it|the piece|this))\b/i;

/**
 * Reject any sentence that claims a named person owns, wore, or bought a piece
 * we sell (AGENTS.md recipe F; audit section 3 item 4). The test is deliberately
 * two-sided: an ownership verb *and* a reference to our own inventory in the
 * same sentence. "Zendaya wore a Cartier Tank on the red carpet" is fine copy;
 * "Zendaya wore our Cartier Tank" is not.
 */
/** Sentinel used to cut the body into block-level chunks before sentence splitting. */
const BLOCK_SEPARATOR = '\u0000';

export function findCelebrityOwnershipClaims(html: string): string[] {
  const hits: string[] = [];
  // Split into block-level chunks first, then into sentences, so one long
  // <p> cannot pair a verb in its first sentence with "our" in its last.
  const chunks = html
    .replace(/<\/(?:p|li|h[1-6]|div|blockquote|section)>/gi, BLOCK_SEPARATOR)
    .split(BLOCK_SEPARATOR)
    .flatMap((block) => block.split(/(?<=[.!?])\s+/));
  for (const chunk of chunks) {
    const text = chunk.trim();
    if (text.length === 0) continue;
    if (!OWNERSHIP_VERB.test(stripHtml(text))) continue;
    if (!OUR_INVENTORY_REFERENCE.test(text)) continue;
    hits.push(stripHtml(text).slice(0, 160));
  }
  return hits;
}

/** Tags not in the existing Journal tag set (`journal-draft` is allowed). */
export function findUnknownTags(tags: string[]): string[] {
  const allowed = new Set<string>([...JOURNAL_TAGS, JOURNAL_DRAFT_TAG].map((t) => t.toLowerCase()));
  return tags.filter((t) => !allowed.has(t.trim().toLowerCase()));
}

/**
 * Every guardrail, run in code rather than trusted to the prompt. A draft with
 * any violation is regenerated once and then rejected.
 */
export function checkDraft(draft: JournalDraft, catalog: StoreCatalog): Violation[] {
  const violations: Violation[] = [];
  const faqText = draft.faq.map((f) => `${f.question} ${f.answer}`).join(' ');
  const allCopy = [draft.title, draft.seoTitle, draft.seoDescription, draft.summary, draft.bodyHtml, faqText]
    .join('\n');

  // 1. Celebrity ownership claims.
  for (const hit of findCelebrityOwnershipClaims(`${draft.bodyHtml}\n${faqText}`)) {
    violations.push({ kind: 'celebrity-claim', detail: hit });
  }

  // 2. Supplier names (src/backvault/scrub.ts, AGENTS.md rule 1).
  const scrubFields: Record<string, string> = {
    title: draft.title,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    summary: draft.summary,
    body: draft.bodyHtml,
    faq: faqText,
    tags: draft.tags.join(', '),
  };
  for (const [field, value] of Object.entries(scrubFields)) {
    if (containsBackVaultReference(value)) {
      violations.push({ kind: 'supplier-name', detail: `supplier reference in ${field}` });
    }
  }

  // 3. Prices.
  for (const price of findPrices(allCopy)) {
    violations.push({ kind: 'price', detail: price });
  }

  // 4. Links: internal only, every handle known, at least three.
  for (const href of findExternalLinks(draft.bodyHtml)) {
    violations.push({ kind: 'external-link', detail: href });
  }
  const links = extractStoreLinks(draft.bodyHtml);
  for (const link of links) {
    const known = link.kind === 'product' ? catalog.productHandles : catalog.collectionHandles;
    if (!known.has(link.handle)) {
      violations.push({ kind: 'unknown-handle', detail: `/${link.kind}s/${link.handle}` });
    }
  }
  if (links.length < MIN_STORE_LINKS) {
    violations.push({ kind: 'too-few-links', detail: `${links.length} store links, need ${MIN_STORE_LINKS}` });
  }

  // 5. Tags.
  for (const tag of findUnknownTags(draft.tags)) {
    violations.push({ kind: 'unknown-tag', detail: tag });
  }

  // 6. SEO lengths (docs/seo-title-formulas.md).
  if (draft.seoTitle.length > SEO_TITLE_MAX) {
    violations.push({ kind: 'seo-title-length', detail: `${draft.seoTitle.length} > ${SEO_TITLE_MAX}` });
  }
  if (draft.seoDescription.length > SEO_DESCRIPTION_MAX) {
    violations.push({
      kind: 'seo-description-length',
      detail: `${draft.seoDescription.length} > ${SEO_DESCRIPTION_MAX}`,
    });
  }

  // 7. Shape: length and FAQ block.
  const words = wordCount(draft.bodyHtml) + wordCount(faqText);
  if (words < WORD_COUNT_MIN || words > WORD_COUNT_MAX) {
    violations.push({ kind: 'word-count', detail: `${words} words, need ${WORD_COUNT_MIN}-${WORD_COUNT_MAX}` });
  }
  if (draft.faq.length !== FAQ_QUESTIONS) {
    violations.push({ kind: 'faq-count', detail: `${draft.faq.length} FAQ questions, need ${FAQ_QUESTIONS}` });
  }

  // 8. Featured product must be a real, active handle.
  const featured = draft.featuredProductHandle.trim().toLowerCase();
  if (!catalog.productHandles.has(featured)) {
    violations.push({ kind: 'featured-handle', detail: featured || '(empty)' });
  }

  return violations;
}

/**
 * Housekeeping filter. Only unpublished articles that carry `journal-draft` and
 * are older than `maxAgeDays` are eligible for deletion. A published article, or
 * a draft somebody else made without the tag, is never returned.
 */
export function selectStaleDrafts(
  articles: JournalArticle[],
  now: Date,
  maxAgeDays: number = DRAFT_MAX_AGE_DAYS,
): JournalArticle[] {
  const cutoff = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
  return articles.filter((a) => {
    if (a.isPublished) return false;
    if (a.publishedAt !== null) return false;
    if (!a.tags.some((t) => t.trim().toLowerCase() === JOURNAL_DRAFT_TAG)) return false;
    const created = Date.parse(a.createdAt);
    if (Number.isNaN(created)) return false;
    return created < cutoff;
  });
}

/** The exact `articleCreate` input, `isPublished: false`, never a publish date. */
export function buildArticleCreateInput(
  draft: JournalDraft,
  blogId: string,
  image: { url: string; altText: string } | null,
): Record<string, unknown> {
  const tags = Array.from(
    new Set([...draft.tags.map((t) => t.trim()).filter(Boolean), JOURNAL_DRAFT_TAG]),
  );
  const input: Record<string, unknown> = {
    blogId,
    title: draft.title,
    author: { name: AUTHOR_NAME },
    body: renderBodyHtml(draft),
    summary: draft.summary,
    isPublished: false,
    tags,
    metafields: [
      {
        namespace: 'global',
        key: 'title_tag',
        type: 'single_line_text_field',
        value: draft.seoTitle,
      },
      {
        namespace: 'global',
        key: 'description_tag',
        type: 'single_line_text_field',
        value: draft.seoDescription,
      },
    ],
  };
  if (image) input.image = { url: image.url, altText: image.altText };
  return input;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Body plus the FAQ block, which the model returns as structured items. */
export function renderBodyHtml(draft: JournalDraft): string {
  const faq = draft.faq
    .map((f) => `  <h3>${escapeHtml(f.question)}</h3>\n  <p>${escapeHtml(f.answer)}</p>`)
    .join('\n');
  return `${draft.bodyHtml.trim()}\n<section class="journal-faq">\n  <h2>Frequently asked</h2>\n${faq}\n</section>\n`;
}

export function renderDraftMarkdown(draft: JournalDraft, violations: Violation[]): string {
  const lines = [
    `# ${draft.title}`,
    '',
    `- Hook: ${draft.hook}`,
    `- SEO title (${draft.seoTitle.length}/${SEO_TITLE_MAX}): ${draft.seoTitle}`,
    `- SEO description (${draft.seoDescription.length}/${SEO_DESCRIPTION_MAX}): ${draft.seoDescription}`,
    `- Tags: ${[...draft.tags, JOURNAL_DRAFT_TAG].join(', ')}`,
    `- Featured product: ${draft.featuredProductHandle}`,
    `- Words: ${wordCount(draft.bodyHtml) + wordCount(draft.faq.map((f) => `${f.question} ${f.answer}`).join(' '))}`,
    `- Store links: ${extractStoreLinks(draft.bodyHtml).map((l) => `/${l.kind}s/${l.handle}`).join(', ')}`,
    `- Guardrails: ${violations.length === 0 ? 'pass' : violations.map((v) => `${v.kind} (${v.detail})`).join('; ')}`,
    '',
    '## Summary',
    '',
    draft.summary,
    '',
    '## Body',
    '',
    renderBodyHtml(draft),
    '',
  ];
  return lines.join('\n');
}

export function renderHooksMarkdown(hooks: HookItem[], source: string, generatedAt: string): string {
  const rows = hooks.map((h, i) => `${i + 1}. **${h.headline}** — ${h.why}\n   ${h.sourceUrl}`);
  return [
    '# Journal hooks',
    '',
    `Generated ${generatedAt} — gathered by ${source}.`,
    '',
    ...(rows.length > 0 ? rows : ['_No hooks gathered._']),
    '',
  ].join('\n');
}

// ---------------------------------------------------------------- Shopify reads

async function resolveToken(): Promise<{ domain: string; token: string }> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN is not set');
  const staticToken = process.env.SHOPIFY_ADMIN_TOKEN;
  if (staticToken) return { domain, token: staticToken };
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (clientId && clientSecret) {
    const { token } = await exchangeClientCredentials(domain, clientId, clientSecret);
    return { domain, token };
  }
  throw new Error('Set SHOPIFY_ADMIN_TOKEN, or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET');
}

const BLOG_QUERY = `query JournalBlog($handle: String!) {
  blogs(first: 10, query: $handle) {
    nodes { id handle title }
  }
}`;

const ARTICLES_QUERY = `query JournalArticles($cursor: String, $q: String!) {
  articles(first: 50, after: $cursor, query: $q) {
    pageInfo { hasNextPage endCursor }
    nodes { id title handle tags isPublished createdAt publishedAt }
  }
}`;

const ARTICLE_BODY_QUERY = `query JournalArticleBodies($cursor: String, $q: String!) {
  articles(first: 10, after: $cursor, query: $q, sortKey: PUBLISHED_AT, reverse: true) {
    nodes { id title summary body tags }
  }
}`;

const PRODUCTS_QUERY = `query JournalProducts($cursor: String, $q: String!) {
  products(first: 100, after: $cursor, query: $q) {
    pageInfo { hasNextPage endCursor }
    nodes {
      handle
      title
      status
      productType
      vendor
      tags
      featuredMedia { preview { image { url altText } } }
    }
  }
}`;

const COLLECTIONS_QUERY = `query JournalCollections($cursor: String) {
  collections(first: 100, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes { handle title }
  }
}`;

export const ARTICLE_CREATE_MUTATION = `mutation JournalArticleCreate($article: ArticleCreateInput!) {
  articleCreate(article: $article) {
    article { id title handle isPublished tags image { url altText } }
    userErrors { code field message }
  }
}`;

export const ARTICLE_DELETE_MUTATION = `mutation JournalArticleDelete($id: ID!) {
  articleDelete(id: $id) {
    deletedArticleId
    userErrors { code field message }
  }
}`;

/** Product segments the Journal is allowed to link to. Loose stones are excluded. */
const PRODUCT_SEGMENTS: Array<{ segment: string; query: string }> = [
  { segment: 'watch', query: "status:ACTIVE AND (product_type:Watch OR product_type:Watches)" },
  {
    segment: 'estate',
    query: 'status:ACTIVE AND (tag:backvault-feed OR tag:antique-estate OR tag:designer-jewelry)',
  },
  { segment: 'lab-grown', query: 'status:ACTIVE AND tag:lab-grown' },
  {
    segment: 'fine',
    query:
      "status:ACTIVE AND (vendor:'Laura Milman New York' OR vendor:'Milman New York' OR vendor:\"Laura's Gems\")",
  },
];

/** Loose stones never appear in the Journal's product links. */
const LOOSE_STONE_TYPES = new Set(['natural diamond', 'lab-grown diamond', 'lab grown diamond']);

async function fetchBlogId(client: ShopifyClient): Promise<string> {
  const data = await client.gql<{ blogs: { nodes: Array<{ id: string; handle: string }> } }>(BLOG_QUERY, {
    handle: `handle:${BLOG_HANDLE}`,
  });
  const blog = data.blogs.nodes.find((b) => b.handle === BLOG_HANDLE);
  if (!blog) throw new Error(`Blog "${BLOG_HANDLE}" not found on the store`);
  return blog.id;
}

function blogNumericId(blogGid: string): string {
  const m = /(\d+)\s*$/.exec(blogGid);
  if (!m) throw new Error(`Unrecognised blog id: ${blogGid}`);
  return m[1] as string;
}

async function fetchArticles(client: ShopifyClient, query: string): Promise<JournalArticle[]> {
  const out: JournalArticle[] = [];
  let cursor: string | null = null;
  for (;;) {
    const data: {
      articles: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: JournalArticle[];
      };
    } = await client.gql(ARTICLES_QUERY, { cursor, q: query });
    out.push(...data.articles.nodes);
    if (!data.articles.pageInfo.hasNextPage) break;
    cursor = data.articles.pageInfo.endCursor;
    if (!cursor) break;
  }
  return out;
}

async function fetchVoiceSamples(
  client: ShopifyClient,
  blogId: string,
): Promise<Array<{ title: string; summary: string; body: string; tags: string[] }>> {
  const data = await client.gql<{
    articles: { nodes: Array<{ title: string; summary: string | null; body: string; tags: string[] }> };
  }>(ARTICLE_BODY_QUERY, {
    cursor: null,
    q: `blog_id:${blogNumericId(blogId)} AND published_status:published`,
  });
  return data.articles.nodes.map((a) => ({
    title: a.title,
    summary: a.summary ?? '',
    body: a.body,
    tags: a.tags,
  }));
}

async function fetchProducts(client: ShopifyClient): Promise<ProductRow[]> {
  const bySegment: ProductRow[] = [];
  const seen = new Set<string>();
  for (const { segment, query } of PRODUCT_SEGMENTS) {
    let cursor: string | null = null;
    for (;;) {
      const data: {
        products: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{
            handle: string;
            title: string;
            status: string;
            productType: string | null;
            vendor: string | null;
            tags: string[];
            featuredMedia: { preview: { image: { url: string; altText: string | null } | null } | null } | null;
          }>;
        };
      } = await client.gql(PRODUCTS_QUERY, { cursor, q: query });
      for (const n of data.products.nodes) {
        if (n.status !== 'ACTIVE') continue;
        if (LOOSE_STONE_TYPES.has((n.productType ?? '').toLowerCase())) continue;
        if (seen.has(n.handle)) continue;
        seen.add(n.handle);
        const image = n.featuredMedia?.preview?.image ?? null;
        bySegment.push({
          handle: n.handle,
          title: n.title,
          productType: n.productType ?? '',
          vendor: n.vendor ?? '',
          tags: n.tags,
          imageUrl: image?.url ?? null,
          imageAlt: image?.altText ?? null,
          segment,
        });
      }
      if (!data.products.pageInfo.hasNextPage) break;
      cursor = data.products.pageInfo.endCursor;
      if (!cursor) break;
    }
  }
  return bySegment;
}

async function fetchCollections(client: ShopifyClient): Promise<CollectionRow[]> {
  const out: CollectionRow[] = [];
  let cursor: string | null = null;
  for (;;) {
    const data: {
      collections: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: CollectionRow[];
      };
    } = await client.gql(COLLECTIONS_QUERY, { cursor });
    out.push(...data.collections.nodes);
    if (!data.collections.pageInfo.hasNextPage) break;
    cursor = data.collections.pageInfo.endCursor;
    if (!cursor) break;
  }
  return out;
}

/**
 * Evenly sample across segments so the prompt sees watches, estate, fine, and
 * lab-grown pieces even when one segment dominates the catalogue. Validation
 * still runs against every handle fetched, not this sample.
 */
export function sampleProductsForPrompt(rows: ProductRow[], limit = MAX_PRODUCTS_IN_PROMPT): ProductRow[] {
  const bySegment = new Map<string, ProductRow[]>();
  for (const row of rows) {
    const list = bySegment.get(row.segment) ?? [];
    list.push(row);
    bySegment.set(row.segment, list);
  }
  const out: ProductRow[] = [];
  const queues = [...bySegment.values()];
  let index = 0;
  while (out.length < limit && queues.some((q) => q.length > index)) {
    for (const q of queues) {
      const row = q[index];
      if (row && out.length < limit) out.push(row);
    }
    index += 1;
  }
  return out;
}

// ---------------------------------------------------------------- Anthropic

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/** Pull the first JSON object or array out of a response that may be fenced. */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced?.[1]?.trim() ?? text.trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.search(/[[{]/);
    const end = Math.max(candidate.lastIndexOf(']'), candidate.lastIndexOf('}'));
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error(`Model response was not JSON: ${text.slice(0, 300)}`);
  }
}

export function normalizeHooks(value: unknown): HookItem[] {
  const list = Array.isArray(value)
    ? value
    : Array.isArray((value as { hooks?: unknown } | null)?.hooks)
      ? ((value as { hooks: unknown[] }).hooks)
      : [];
  const out: HookItem[] = [];
  for (const raw of list) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const headline = typeof r.headline === 'string' ? r.headline.trim() : '';
    const why = typeof r.why === 'string' ? r.why.trim() : '';
    const sourceUrl = typeof r.sourceUrl === 'string' ? r.sourceUrl.trim() : '';
    if (headline && why && sourceUrl) out.push({ headline, why, sourceUrl });
  }
  return out.slice(0, 10);
}

const HOOK_INSTRUCTIONS = `You are the research half of a jewelry and watch editorial desk for Laura Milman New York, a New York estate, fine, and lab-grown jewelry and pre-owned watch store.

Find what happened in the LAST SEVEN DAYS in these areas, and only these:
- red carpet, premiere, and award-show jewelry
- watch sightings on athletes and musicians
- jewelry and watch auction results
- brand launches and new collections from the maisons (Cartier, Tiffany, Van Cleef & Arpels, Rolex, Patek Philippe, and peers)
- notable nightlife and restaurant openings in New York, Miami, Los Angeles, and Las Vegas

Shortlist exactly ten items. Each must be real, dated in the last seven days, and carry a source URL you actually retrieved. Never invent a headline, a date, or a URL.

Return ONLY a JSON array, no prose around it, of ten objects:
[{"headline": "...", "why": "one line on why it is a hook for a jewelry or watch article", "sourceUrl": "https://..."}]`;

/**
 * Gather the week's hooks. Preferred path is the `web_search` server tool on
 * Claude Sonnet 5; when the API key cannot use it, the tool result comes back
 * as an error block rather than throwing, so we fall back to public RSS feeds
 * read with plain fetch and hand those headlines to the same model.
 */
async function gatherHooks(
  anthropic: Anthropic,
): Promise<{ hooks: HookItem[]; source: string; note: string | null }> {
  const stream = anthropic.messages.stream({
    model: HOOK_MODEL,
    max_tokens: 16000,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 12 }],
    messages: [{ role: 'user', content: HOOK_INSTRUCTIONS }],
  });
  const message = await stream.finalMessage();

  const searchFailed = message.content.some(
    (b) => b.type === 'web_search_tool_result' && !Array.isArray(b.content),
  );
  const searchRan = message.content.some((b) => b.type === 'server_tool_use');

  if (!searchFailed && searchRan) {
    const hooks = normalizeHooks(extractJson(textOf(message)));
    if (hooks.length > 0) {
      return { hooks, source: 'the web_search server tool (Claude Sonnet 5)', note: null };
    }
  }

  const headlines = await fetchFallbackHeadlines();
  const note =
    'web_search was unavailable or returned nothing; hooks were gathered from public RSS feeds fetched directly.';
  console.warn(`Hook gathering: ${note}`);
  if (headlines.length === 0) {
    return { hooks: [], source: 'no source (web search unavailable, every RSS feed failed)', note };
  }
  const fallback = await anthropic.messages.stream({
    model: HOOK_MODEL,
    max_tokens: 16000,
    messages: [
      {
        role: 'user',
        content: `${HOOK_INSTRUCTIONS}\n\nWeb search is unavailable. Use ONLY the feed items below; do not invent anything that is not in this list, and reuse each item's own link as sourceUrl.\n\n${headlines
          .map((h) => `- ${h.title} — ${h.link}`)
          .join('\n')}`,
      },
    ],
  }).finalMessage();
  return {
    hooks: normalizeHooks(extractJson(textOf(fallback))),
    source: 'public RSS feeds fetched directly (Claude Sonnet 5 shortlisted)',
    note,
  };
}

/** Minimal RSS/Atom title+link scrape; a feed that fails is skipped. */
export function parseFeedItems(xml: string): Array<{ title: string; link: string }> {
  const items: Array<{ title: string; link: string }> = [];
  const blocks = xml.split(/<(?:item|entry)[\s>]/i).slice(1);
  for (const block of blocks) {
    const title = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(block)?.[1]?.trim();
    const link =
      /<link[^>]*href=["']([^"']+)["']/i.exec(block)?.[1] ??
      /<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(block)?.[1]?.trim();
    if (title && link) items.push({ title: stripHtml(title), link: link.trim() });
  }
  return items;
}

async function fetchFallbackHeadlines(): Promise<Array<{ title: string; link: string }>> {
  const out: Array<{ title: string; link: string }> = [];
  for (const url of FALLBACK_HOOK_FEEDS) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'LMNY-JournalDraft/1.0 (+https://lauramilman.com)' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        console.warn(`Feed ${url}: HTTP ${res.status}`);
        continue;
      }
      out.push(...parseFeedItems(await res.text()).slice(0, 15));
    } catch (err) {
      console.warn(`Feed ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}

const DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'seoTitle',
    'seoDescription',
    'summary',
    'bodyHtml',
    'faq',
    'tags',
    'featuredProductHandle',
    'hook',
  ],
  properties: {
    title: { type: 'string' },
    seoTitle: { type: 'string' },
    seoDescription: { type: 'string' },
    summary: { type: 'string' },
    bodyHtml: { type: 'string' },
    faq: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'answer'],
        properties: { question: { type: 'string' }, answer: { type: 'string' } },
      },
    },
    tags: { type: 'array', items: { type: 'string' } },
    featuredProductHandle: { type: 'string' },
    hook: { type: 'string' },
  },
} as const;

function articleSystemPrompt(
  voiceSamples: Array<{ title: string; summary: string; body: string; tags: string[] }>,
): string {
  const samples = voiceSamples
    .slice(0, 4)
    .map(
      (s, i) =>
        `--- Live article ${i + 1}: ${s.title} (tags: ${s.tags.join(', ')})\n${stripHtml(s.body).slice(0, 1800)}`,
    )
    .join('\n\n');
  return `You write the Journal for Laura Milman New York, a New York store selling estate and signed jewelry, fine jewelry made in house, lab-grown jewelry, and pre-owned watches.

Voice: the live articles below are the reference. Match their register — informed, specific, unhurried, no hype words ("stunning", "must-have"), no exclamation marks, no second-person sales patter, no invented provenance.

${samples || '(No published articles were readable; write in a plain, factual editorial register.)'}

Hard rules, checked in code after you answer. A draft that breaks one is thrown away:
1. Never claim that a named person owns, wore, bought, or was given a piece we sell. Report what a person wore in public and write about the category, never about our specific object being theirs.
2. Never name a supplier, wholesaler, or source. Write only as Laura Milman New York.
3. Never state a price, a price range, or a dollar figure of any kind, in the body, the FAQ, the summary, or the SEO fields.
4. Every link must be a relative link on our own store: <a href="/products/HANDLE"> or <a href="/collections/HANDLE">, using only handles from the list you are given. No external links, no http links, no invented handles. At least three links.
5. SEO title at or below ${SEO_TITLE_MAX} characters. SEO description at or below ${SEO_DESCRIPTION_MAX} characters. Neither repeats "Laura Milman New York" (the theme adds the store name).
6. Body between ${WORD_COUNT_MIN} and ${WORD_COUNT_MAX} words including the FAQ answers.
7. Exactly ${FAQ_QUESTIONS} FAQ questions, returned in the "faq" field. Do not also write a FAQ section inside bodyHtml.
8. Tags only from this list, two to four of them: ${JOURNAL_TAGS.join(', ')}.
9. bodyHtml is clean HTML fragments only — <h2>, <h3>, <p>, <ul>, <li>, <a>, <em>, <strong>. No <html>, <head>, <body>, <img>, <script>, or style attributes.
10. "featuredProductHandle" is one product handle from the list; its photo becomes the article image, so pick a piece the article actually discusses.`;
}

function catalogPrompt(products: ProductRow[], collections: CollectionRow[]): string {
  const productLines = products.map((p) => `${p.handle} :: ${p.title} :: ${p.productType || 'n/a'} :: ${p.segment}`);
  const collectionLines = collections.map((c) => `${c.handle} :: ${c.title}`);
  return `LIVE PRODUCT HANDLES (handle :: title :: type :: segment) — link only to these:\n${productLines.join('\n')}\n\nLIVE COLLECTION HANDLES (handle :: title) — link only to these:\n${collectionLines.join('\n')}`;
}

async function writeDraft(
  anthropic: Anthropic,
  system: string,
  catalogText: string,
  hooks: HookItem[],
  alreadyWritten: string[],
  repair: { draft: JournalDraft; violations: Violation[] } | null,
): Promise<JournalDraft> {
  const task = repair
    ? `The draft below failed these code-enforced checks:\n${repair.violations
        .map((v) => `- ${v.kind}: ${v.detail}`)
        .join('\n')}\n\nRewrite it so every check passes. Keep the same hook and subject. Return the complete corrected draft.\n\nPrevious draft:\n${JSON.stringify(repair.draft, null, 2)}`
    : `This week's hooks:\n${hooks.map((h, i) => `${i + 1}. ${h.headline} — ${h.why} (${h.sourceUrl})`).join('\n')}

${alreadyWritten.length > 0 ? `Already written this run, pick a different hook and a different angle:\n${alreadyWritten.map((t) => `- ${t}`).join('\n')}\n` : ''}
Pick one hook and write one Journal article from it, tying it back to watches or jewelry we actually stock.`;

  const message = await anthropic.messages
    .stream({
      model: ARTICLE_MODEL,
      max_tokens: 32000,
      system,
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: DRAFT_SCHEMA as unknown as Record<string, unknown> },
      },
      messages: [{ role: 'user', content: `${catalogText}\n\n${task}` }],
    })
    .finalMessage();

  if (message.stop_reason === 'refusal') {
    throw new Error(`Article model declined the request: ${JSON.stringify(message.stop_details)}`);
  }
  return normalizeDraft(extractJson(textOf(message)));
}

export function normalizeDraft(value: unknown): JournalDraft {
  if (typeof value !== 'object' || value === null) throw new Error('Draft response was not an object');
  const r = value as Record<string, unknown>;
  const str = (key: string): string => (typeof r[key] === 'string' ? (r[key] as string).trim() : '');
  const faqRaw = Array.isArray(r.faq) ? r.faq : [];
  const faq: DraftFaqItem[] = [];
  for (const item of faqRaw) {
    if (typeof item !== 'object' || item === null) continue;
    const f = item as Record<string, unknown>;
    faq.push({
      question: typeof f.question === 'string' ? f.question.trim() : '',
      answer: typeof f.answer === 'string' ? f.answer.trim() : '',
    });
  }
  return {
    title: str('title'),
    seoTitle: str('seoTitle'),
    seoDescription: str('seoDescription'),
    summary: str('summary'),
    bodyHtml: typeof r.bodyHtml === 'string' ? r.bodyHtml : '',
    faq,
    tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [],
    featuredProductHandle: str('featuredProductHandle').toLowerCase(),
    hook: str('hook'),
  };
}

// ---------------------------------------------------------------- run

interface RunOptions {
  dryRun: boolean;
  count: number;
}

export function parseArgs(argv: string[]): RunOptions {
  const dryRun = argv.includes('--dry-run');
  const countArg = argv.find((a) => a.startsWith('--count='));
  const parsed = countArg ? Number(countArg.slice('--count='.length)) : 2;
  const count = Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 5) : 2;
  return { dryRun, count };
}

interface DraftOutcome {
  index: number;
  title: string;
  hook: string;
  accepted: boolean;
  attempts: number;
  violations: Violation[];
  articleId: string | null;
  featuredImage: string | null;
}

export async function run(argv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(argv);
  const startedAt = new Date();
  const errors: string[] = [];
  console.log(`Journal drafting job starting (${opts.dryRun ? 'DRY RUN' : 'LIVE'}, count=${opts.count})`);

  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  const anthropic = new Anthropic();
  const { domain, token } = await resolveToken();
  const shopify = new ShopifyClient(domain, token);
  const { shop } = await shopify.verifyAuth();
  console.log(`Shopify: ${shop}`);

  await mkdir(OUT_DIR, { recursive: true });

  // 1. Hooks.
  const { hooks, source: hookSource, note: hookNote } = await gatherHooks(anthropic);
  await writeFile(`${OUT_DIR}/journal-hooks.md`, renderHooksMarkdown(hooks, hookSource, startedAt.toISOString()));
  console.log(`Hooks: ${hooks.length} shortlisted via ${hookSource}`);

  // 2. Catalogue.
  const blogId = await fetchBlogId(shopify);
  const [products, collections, voiceSamples] = await Promise.all([
    fetchProducts(shopify),
    fetchCollections(shopify),
    fetchVoiceSamples(shopify, blogId),
  ]);
  const catalog: StoreCatalog = {
    productHandles: new Set(products.map((p) => p.handle.toLowerCase())),
    collectionHandles: new Set(collections.map((c) => c.handle.toLowerCase())),
  };
  const productsById = new Map(products.map((p) => [p.handle.toLowerCase(), p]));
  console.log(
    `Catalogue: ${products.length} ACTIVE products, ${collections.length} collections, ${voiceSamples.length} published articles for voice`,
  );

  const system = articleSystemPrompt(voiceSamples);
  const promptProducts = sampleProductsForPrompt(products);
  const catalogText = catalogPrompt(promptProducts, collections);

  // 3. Drafts.
  const outcomes: DraftOutcome[] = [];
  const written: string[] = [];
  if (hooks.length === 0) {
    errors.push('No hooks were gathered; no drafts were written.');
  }
  for (let i = 0; hooks.length > 0 && i < opts.count; i++) {
    let attempts = 0;
    let draft: JournalDraft | null = null;
    let violations: Violation[] = [];
    try {
      draft = await writeDraft(anthropic, system, catalogText, hooks, written, null);
      attempts = 1;
      violations = checkDraft(draft, catalog);
      if (violations.length > 0) {
        console.warn(`Draft ${i + 1} failed ${violations.length} check(s); regenerating once`);
        draft = await writeDraft(anthropic, system, catalogText, hooks, written, { draft, violations });
        attempts = 2;
        violations = checkDraft(draft, catalog);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Draft ${i + 1}: ${message}`);
      outcomes.push({
        index: i + 1,
        title: draft?.title ?? '(not written)',
        hook: draft?.hook ?? '',
        accepted: false,
        attempts,
        violations: [{ kind: 'model-error', detail: message }],
        articleId: null,
        featuredImage: null,
      });
      continue;
    }

    const accepted = violations.length === 0;
    written.push(draft.title);

    const featured = productsById.get(draft.featuredProductHandle) ?? null;
    let image: { url: string; altText: string } | null = null;
    if (featured?.imageUrl) {
      image = { url: featured.imageUrl, altText: featured.imageAlt ?? featured.title };
    } else if (accepted) {
      for (const link of extractStoreLinks(draft.bodyHtml)) {
        const candidate = link.kind === 'product' ? productsById.get(link.handle) : undefined;
        if (candidate?.imageUrl) {
          image = { url: candidate.imageUrl, altText: candidate.imageAlt ?? candidate.title };
          break;
        }
      }
    }

    let articleId: string | null = null;
    if (!accepted) {
      console.warn(`Draft ${i + 1} rejected: ${violations.map((v) => v.kind).join(', ')}`);
    } else if (opts.dryRun) {
      await writeFile(`${OUT_DIR}/journal-draft-${i + 1}.md`, renderDraftMarkdown(draft, violations));
      console.log(`Draft ${i + 1} written to out/journal-draft-${i + 1}.md (dry run, nothing created)`);
    } else {
      const input = buildArticleCreateInput(draft, blogId, image);
      const res = await shopify.gql<{
        articleCreate: {
          article: { id: string; isPublished: boolean } | null;
          userErrors: Array<{ code: string | null; field: string[] | null; message: string }>;
        };
      }>(ARTICLE_CREATE_MUTATION, { article: input });
      const userErrors = res.articleCreate.userErrors;
      if (userErrors.length > 0) {
        const message = userErrors.map((e) => `${(e.field ?? []).join('.')}: ${e.message}`).join('; ');
        errors.push(`Draft ${i + 1} articleCreate: ${message}`);
      } else if (res.articleCreate.article) {
        articleId = res.articleCreate.article.id;
        if (res.articleCreate.article.isPublished) {
          errors.push(`Draft ${i + 1} came back PUBLISHED (${articleId}); unpublish it by hand`);
        }
        console.log(`Draft ${i + 1} created unpublished: ${articleId}`);
      }
    }

    outcomes.push({
      index: i + 1,
      title: draft.title,
      hook: draft.hook,
      accepted,
      attempts,
      violations,
      articleId,
      featuredImage: image?.url ?? null,
    });
  }

  // 4. Housekeeping: only unpublished, only tagged, only older than 21 days.
  const candidates = await fetchArticles(
    shopify,
    `blog_id:${blogNumericId(blogId)} AND published_status:unpublished AND tag:'${JOURNAL_DRAFT_TAG}'`,
  );
  const stale = selectStaleDrafts(candidates, startedAt);
  const deleted: string[] = [];
  for (const article of stale) {
    if (opts.dryRun) {
      console.log(`Would delete stale draft ${article.id} (${article.title}, created ${article.createdAt})`);
      continue;
    }
    const res = await shopify.gql<{
      articleDelete: {
        deletedArticleId: string | null;
        userErrors: Array<{ field: string[] | null; message: string }>;
      };
    }>(ARTICLE_DELETE_MUTATION, { id: article.id });
    if (res.articleDelete.userErrors.length > 0) {
      errors.push(
        `Delete ${article.id}: ${res.articleDelete.userErrors.map((e) => e.message).join('; ')}`,
      );
    } else {
      deleted.push(article.id);
      console.log(`Deleted stale draft ${article.id} (${article.title})`);
    }
  }

  // 5. Report.
  const report = renderReport({
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    dryRun: opts.dryRun,
    hooks,
    hookSource,
    hookNote,
    productCount: products.length,
    collectionCount: collections.length,
    outcomes,
    staleFound: stale.length,
    staleDeleted: deleted.length,
    candidatesScanned: candidates.length,
    errors,
  });
  await writeFile(`${OUT_DIR}/journal-report.md`, report);
  console.log(`Wrote out/journal-report.md`);
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  }
}

interface ReportInput {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  hooks: HookItem[];
  hookSource: string;
  hookNote: string | null;
  productCount: number;
  collectionCount: number;
  outcomes: DraftOutcome[];
  staleFound: number;
  staleDeleted: number;
  candidatesScanned: number;
  errors: string[];
}

export function renderReport(input: ReportInput): string {
  const accepted = input.outcomes.filter((o) => o.accepted);
  const rejected = input.outcomes.filter((o) => !o.accepted);
  const lines = [
    '# Journal drafting run',
    '',
    `- Mode: ${input.dryRun ? 'DRY RUN (no articleCreate, no delete)' : 'LIVE (unpublished articles created)'}`,
    `- Started: ${input.startedAt}`,
    `- Finished: ${input.finishedAt}`,
    `- Hooks gathered: ${input.hooks.length} via ${input.hookSource}`,
    ...(input.hookNote ? [`- Hook note: ${input.hookNote}`] : []),
    `- Catalogue read: ${input.productCount} ACTIVE products, ${input.collectionCount} collections`,
    `- Drafts accepted: ${accepted.length}`,
    `- Drafts rejected: ${rejected.length}`,
    `- Stale drafts scanned / matched / deleted: ${input.candidatesScanned} / ${input.staleFound} / ${input.staleDeleted}`,
    '',
    '## Hooks',
    '',
    ...(input.hooks.length > 0
      ? input.hooks.map((h, i) => `${i + 1}. ${h.headline} — ${h.why} (${h.sourceUrl})`)
      : ['_none_']),
    '',
    '## Drafts',
    '',
    '| # | Title | Attempts | Result | Article | Image |',
    '|---|---|---|---|---|---|',
    ...(input.outcomes.length > 0
      ? input.outcomes.map(
          (o) =>
            `| ${o.index} | ${o.title.replace(/\|/g, '\\|')} | ${o.attempts} | ${
              o.accepted ? 'accepted' : `rejected: ${o.violations.map((v) => v.kind).join(', ')}`
            } | ${o.articleId ?? (input.dryRun ? 'dry run' : '—')} | ${o.featuredImage ? 'yes' : 'none'} |`,
        )
      : ['| — | _no drafts_ | 0 | — | — | — |']),
    '',
    ...(rejected.length > 0
      ? [
          '## Rejections in detail',
          '',
          ...rejected.flatMap((o) => [
            `### Draft ${o.index}: ${o.title}`,
            '',
            ...o.violations.map((v) => `- ${v.kind}: ${v.detail}`),
            '',
          ]),
        ]
      : []),
    '## Errors',
    '',
    ...(input.errors.length > 0 ? input.errors.map((e) => `- ${e}`) : ['_none_']),
    '',
    'Nothing in this run was published. A person publishes from Shopify admin.',
    '',
  ];
  return lines.join('\n');
}

const isMain = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  run().catch((err) => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    process.exitCode = 1;
  });
}
