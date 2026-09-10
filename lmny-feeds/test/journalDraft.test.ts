import { describe, expect, it } from 'vitest';
import {
  adminArticleUrl,
  continuationMessages,
  buildArticleCreateInput,
  canonicalizeTags,
  checkDraft,
  COLLECTIONS_FILTER,
  DRAFT_MAX_AGE_DAYS,
  extractStoreLinks,
  findCelebrityOwnershipClaims,
  findExternalLinks,
  findHtmlViolations,
  findPrices,
  findUnknownTags,
  JOURNAL_DRAFT_TAG,
  JOURNAL_TAGS,
  normalizeHooks,
  parseArgs,
  parseFeedItems,
  parseStoreLink,
  PRODUCT_SEGMENTS,
  selectStaleDrafts,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  wordCount,
  type JournalArticle,
  type JournalDraft,
  type StoreCatalog,
} from '../scripts/journal-draft.js';

const CATALOG: StoreCatalog = {
  productHandles: new Set(['bv-cartier-tank-1962', 'w-rolex-datejust-16233', 'lmny-emerald-ring']),
  collectionHandles: new Set(['estate-jewelry', 'pre-owned-watches', 'engagement-rings']),
};

/** A body long enough to clear the 900-word floor, with three real store links. */
function longBody(extra = ''): string {
  const sentence =
    'The estate market moves on provenance and condition rather than on novelty, and a buyer who reads the case back learns more than a buyer who reads the caption. ';
  return [
    '<h2>What the week showed</h2>',
    `<p>${sentence.repeat(40)}</p>`,
    '<p>Read more in our <a href="/collections/estate-jewelry">estate jewelry</a> edit, the <a href="/collections/pre-owned-watches">pre-owned watches</a> shelf, and this <a href="/products/bv-cartier-tank-1962">Cartier Tank</a>.</p>',
    extra,
  ].join('\n');
}

function draft(overrides: Partial<JournalDraft> = {}): JournalDraft {
  return {
    title: 'What the red carpet said about the tank watch',
    seoTitle: 'Tank Watches on the Red Carpet | Estate Guide',
    seoDescription:
      'How the tank silhouette returned to the red carpet, and what to look for in a pre-owned example. Authenticated by Laura Milman New York.',
    summary: 'The tank silhouette is back on the red carpet. Here is how to read one.',
    bodyHtml: longBody(),
    faq: [
      { question: 'Is a pre-owned tank watch a safe buy?', answer: 'With papers and a service history, yes.' },
      { question: 'How do I size a vintage bracelet?', answer: 'Count the links and measure the wrist.' },
      { question: 'Do estate pieces come authenticated?', answer: 'Every piece is hand inspected before listing.' },
    ],
    tags: ['Watches', 'Vintage Watches', 'Style'],
    featuredProductHandle: 'bv-cartier-tank-1962',
    hook: 'Tank watches at this week premiere',
    ...overrides,
  };
}

describe('parseArgs', () => {
  it('defaults to two live drafts and reads the flags', () => {
    expect(parseArgs([])).toEqual({ dryRun: false, count: 2 });
    expect(parseArgs(['--dry-run', '--count=3'])).toEqual({ dryRun: true, count: 3 });
  });

  it('falls back to two on a nonsense count and caps the run', () => {
    expect(parseArgs(['--count=0']).count).toBe(2);
    expect(parseArgs(['--count=abc']).count).toBe(2);
    expect(parseArgs(['--count=99']).count).toBe(5);
  });
});

describe('a clean draft', () => {
  it('passes every guardrail', () => {
    expect(checkDraft(draft(), CATALOG)).toEqual([]);
  });

  it('is between 900 and 1400 words', () => {
    const words = wordCount(draft().bodyHtml);
    expect(words).toBeGreaterThanOrEqual(900);
    expect(words).toBeLessThanOrEqual(1400);
  });
});

describe('celebrity ownership claims', () => {
  it('flags a sentence tying a person to a piece we sell', () => {
    const html = '<p>Zendaya wore our <a href="/products/bv-cartier-tank-1962">Cartier Tank</a> to the premiere.</p>';
    expect(findCelebrityOwnershipClaims(html)).toHaveLength(1);
  });

  it('flags an ownership verb next to a product link even without "our"', () => {
    const html =
      '<p>He bought the same reference; shop this <a href="/products/w-rolex-datejust-16233">Datejust</a>.</p>';
    expect(findCelebrityOwnershipClaims(html).length).toBeGreaterThan(0);
  });

  it('allows reporting what someone wore in public', () => {
    const html = '<p>Zendaya wore a Cartier Tank to the premiere, a silhouette first drawn in 1917.</p>';
    expect(findCelebrityOwnershipClaims(html)).toEqual([]);
  });

  it('allows ordinary styling copy with an infinitive', () => {
    const html = '<p>You can wear our estate pieces with a dinner jacket or with a t-shirt.</p>';
    expect(findCelebrityOwnershipClaims(html)).toEqual([]);
  });

  it('does not read "pre-owned" as an ownership verb', () => {
    const html = '<p>Browse our <a href="/collections/pre-owned-watches">pre-owned watches</a> shelf.</p>';
    expect(findCelebrityOwnershipClaims(html)).toEqual([]);
  });

  it('does not pair a verb in one paragraph with a possessive in another', () => {
    const html = '<p>She wore a Tank to the premiere.</p><p>Our estate edit is worth a look.</p>';
    expect(findCelebrityOwnershipClaims(html)).toEqual([]);
  });

  it.each([
    '<p>He was photographed in the same reference we have listed here.</p>',
    '<p>Her Tank is the one you can see in our estate edit.</p>',
    '<p>Zendaya wore a Cartier Tank. The exact piece is in our vault.</p>',
    '<p>She was seen wearing the very piece we have listed below.</p>',
  ])('flags the passive and split forms: %s', (html) => {
    expect(findCelebrityOwnershipClaims(html).length).toBeGreaterThan(0);
  });

  it('allows a sighting followed by category copy in the same paragraph', () => {
    const html =
      '<p>Zendaya wore a Cartier Tank on the red carpet. Our estate edit has several Tanks from the same era.</p>';
    expect(findCelebrityOwnershipClaims(html)).toEqual([]);
  });

  it('allows first-person editorial choices', () => {
    const html = '<p>We picked three pieces from our vault for this story.</p>';
    expect(findCelebrityOwnershipClaims(html)).toEqual([]);
  });

  it('surfaces as a violation on a full draft', () => {
    const bad = draft({
      bodyHtml: longBody('<p>Rihanna owns our <a href="/products/lmny-emerald-ring">emerald ring</a>.</p>'),
    });
    expect(checkDraft(bad, CATALOG).map((v) => v.kind)).toContain('celebrity-claim');
  });
});

describe('supplier scrub', () => {
  it.each([
    ['body', { bodyHtml: longBody('<p>Sourced through The Back Vault in New York.</p>') }],
    ['title', { title: 'Back Vault estate picks for the week' }],
    ['seo description', { seoDescription: 'Estate picks from thebackvault, hand inspected.' }],
  ])('rejects a supplier reference in the %s', (_label, overrides) => {
    const violations = checkDraft(draft(overrides as Partial<JournalDraft>), CATALOG);
    expect(violations.map((v) => v.kind)).toContain('supplier-name');
  });

  it('does not fire on our own backvault-feed tag spelling', () => {
    const ok = draft({ bodyHtml: longBody('<p>Pieces carrying the internal backvault-feed marker.</p>') });
    expect(checkDraft(ok, CATALOG).map((v) => v.kind)).not.toContain('supplier-name');
  });
});

describe('prices', () => {
  it.each([
    '$1,200',
    '$ 950',
    'US$4,500',
    '2,400 dollars',
    '18000 USD',
    'USD 5,000',
    'USD5000',
    'a 5,000-dollar watch',
    'well under twenty thousand dollars',
    'around five thousand',
    '\u20ac5,000',
    '\u00a35,000',
  ])('finds %s', (price) => {
    expect(findPrices(`<p>The story mentions ${price} in passing.</p>`).length).toBeGreaterThan(0);
  });

  it.each([
    'Reference 16233, first made in 1988, 36mm case',
    'the 1990s brought the 18K bracelet back',
    'a 2.01ct centre stone with 1.5 carat of side stones',
    'five stones set across the band',
    'Cartier has made the Tank for about a hundred years',
    'a twelve link bracelet, sized down by three links',
  ])('leaves %s alone', (text) => {
    expect(findPrices(`<p>${text}.</p>`)).toEqual([]);
  });

  it('surfaces as a violation on a full draft', () => {
    const bad = draft({ seoDescription: 'Estate tank watches from $4,200 this week.' });
    expect(checkDraft(bad, CATALOG).map((v) => v.kind)).toContain('price');
  });
});

describe('HTML allow-list', () => {
  it('accepts every allowed tag and attribute', () => {
    expect(
      findHtmlViolations(
        '<h2>A</h2><p><strong>b</strong> <em>c</em> <a href="/products/x">d</a></p>' +
          '<ul><li>e</li></ul><ol><li>f</li></ol><blockquote>g</blockquote>' +
          '<section class="journal-faq"><h3>h</h3><p>i</p></section>',
      ),
    ).toEqual([]);
  });

  it.each([
    ['<p><img src="https://example.com/a.jpg"></p>', 'tag <img>'],
    ['<p>x</p><script>alert(1)</script>', 'tag <script>'],
    ['<div>x</div>', 'tag <div>'],
    ['<h1>x</h1>', 'tag <h1>'],
    ['<p style="color:red">x</p>', 'attribute style on <p>'],
    ['<a href="/products/x" target="_blank">y</a>', 'attribute target on <a>'],
    ['<section id="faq">y</section>', 'attribute id on <section>'],
    ['<a class="btn" href="/products/x">y</a>', 'attribute class on <a>'],
  ])('rejects %s', (html, expected) => {
    expect(findHtmlViolations(html)).toContain(expected);
  });

  it('rejects a src on any tag', () => {
    expect(findHtmlViolations('<p src="x">y</p>')).toContain('attribute src');
  });

  it('surfaces as a violation on a full draft', () => {
    const bad = draft({ bodyHtml: longBody('<p><img src="https://example.com/a.jpg"></p>') });
    expect(checkDraft(bad, CATALOG).map((v) => v.kind)).toContain('html-not-allowed');
  });
});

describe('store links', () => {
  it('parses relative and own-domain absolute links', () => {
    expect(parseStoreLink('/products/bv-cartier-tank-1962')).toEqual({
      kind: 'product',
      handle: 'bv-cartier-tank-1962',
    });
    expect(parseStoreLink('https://www.lauramilman.com/collections/estate-jewelry?page=2')).toEqual({
      kind: 'collection',
      handle: 'estate-jewelry',
    });
  });

  it('refuses anything that is not a product or collection on our store', () => {
    expect(parseStoreLink('https://example.com/products/x')).toBeNull();
    expect(parseStoreLink('/pages/about')).toBeNull();
    expect(parseStoreLink('mailto:hello@lauramilman.com')).toBeNull();
  });

  it('deduplicates and reports external links', () => {
    const html =
      '<a href="/products/lmny-emerald-ring">a</a><a href="/products/lmny-emerald-ring">b</a><a href="https://wwd.com/x">c</a>';
    expect(extractStoreLinks(html)).toEqual([{ kind: 'product', handle: 'lmny-emerald-ring' }]);
    expect(findExternalLinks(html)).toEqual(['https://wwd.com/x']);
  });

  it('rejects a handle that is not in the fetched set', () => {
    const bad = draft({
      bodyHtml: longBody('<p>See the <a href="/products/does-not-exist">missing piece</a>.</p>'),
    });
    const violations = checkDraft(bad, CATALOG);
    expect(violations.map((v) => v.kind)).toContain('unknown-handle');
    expect(violations.find((v) => v.kind === 'unknown-handle')?.detail).toBe('/products/does-not-exist');
  });

  it('rejects a collection handle that is not in the fetched set', () => {
    const bad = draft({
      bodyHtml: longBody('<p>See the <a href="/collections/nightlife">nightlife edit</a>.</p>'),
    });
    expect(checkDraft(bad, CATALOG).map((v) => v.kind)).toContain('unknown-handle');
  });

  it('requires at least three store links', () => {
    const bad = draft({
      bodyHtml: `<h2>Short on links</h2><p>${'Words that keep the count high. '.repeat(200)}</p><p><a href="/products/lmny-emerald-ring">one</a></p>`,
    });
    expect(checkDraft(bad, CATALOG).map((v) => v.kind)).toContain('too-few-links');
  });

  it('rejects an external link in the body', () => {
    const bad = draft({ bodyHtml: longBody('<p>Read <a href="https://wwd.com/story">the report</a>.</p>') });
    expect(checkDraft(bad, CATALOG).map((v) => v.kind)).toContain('external-link');
  });
});

describe('catalogue queries', () => {
  it('asks Shopify for products that are ACTIVE and live on the online store', () => {
    expect(PRODUCT_SEGMENTS).toHaveLength(4);
    for (const segment of PRODUCT_SEGMENTS) {
      expect(segment.query).toContain('status:ACTIVE');
      expect(segment.query).toContain('published_status:published');
    }
    expect(PRODUCT_SEGMENTS.map((s) => s.segment).sort()).toEqual([
      'estate',
      'fine',
      'lab-grown',
      'watch',
    ]);
  });

  it('asks for published collections only', () => {
    expect(COLLECTIONS_FILTER).toBe('published_status:published');
  });
});

describe('tag validation', () => {
  it('accepts the existing set and the job tag', () => {
    expect(findUnknownTags([...JOURNAL_TAGS])).toEqual([]);
    expect(findUnknownTags([JOURNAL_DRAFT_TAG])).toEqual([]);
  });

  it('is case and whitespace insensitive', () => {
    expect(findUnknownTags([' estate jewelry ', 'VAN CLEEF & ARPELS'])).toEqual([]);
  });

  it('rejects an invented tag', () => {
    expect(findUnknownTags(['Watches', 'Nightlife'])).toEqual(['Nightlife']);
    expect(checkDraft(draft({ tags: ['Watches', 'Nightlife'] }), CATALOG).map((v) => v.kind)).toContain(
      'unknown-tag',
    );
  });

  it('folds casing onto the live spelling and deduplicates', () => {
    expect(canonicalizeTags(['van cleef & arpels', 'WATCHES', 'Watches', ' style '])).toEqual([
      'Van Cleef & Arpels',
      'Watches',
      'Style',
    ]);
  });

  it('leaves an unrecognised tag untouched rather than inventing a spelling', () => {
    expect(canonicalizeTags(['Nightlife'])).toEqual(['Nightlife']);
  });
});

describe('SEO lengths', () => {
  it('rejects a title over 60 characters', () => {
    const bad = draft({ seoTitle: 'A'.repeat(SEO_TITLE_MAX + 1) });
    expect(checkDraft(bad, CATALOG).map((v) => v.kind)).toContain('seo-title-length');
  });

  it('accepts a title at exactly 60 characters', () => {
    const ok = draft({ seoTitle: 'A'.repeat(SEO_TITLE_MAX) });
    expect(checkDraft(ok, CATALOG).map((v) => v.kind)).not.toContain('seo-title-length');
  });

  it('rejects a description over 160 characters', () => {
    const bad = draft({ seoDescription: 'B'.repeat(SEO_DESCRIPTION_MAX + 1) });
    expect(checkDraft(bad, CATALOG).map((v) => v.kind)).toContain('seo-description-length');
  });

  it('accepts a description at exactly 160 characters', () => {
    const ok = draft({ seoDescription: 'B'.repeat(SEO_DESCRIPTION_MAX) });
    expect(checkDraft(ok, CATALOG).map((v) => v.kind)).not.toContain('seo-description-length');
  });
});

describe('shape checks', () => {
  it('rejects a body under 900 words', () => {
    const bad = draft({
      bodyHtml:
        '<p>Too short. <a href="/products/lmny-emerald-ring">a</a><a href="/collections/estate-jewelry">b</a><a href="/collections/engagement-rings">c</a></p>',
    });
    expect(checkDraft(bad, CATALOG).map((v) => v.kind)).toContain('word-count');
  });

  it('rejects a FAQ block that is not three questions', () => {
    const bad = draft({ faq: draft().faq.slice(0, 2) });
    expect(checkDraft(bad, CATALOG).map((v) => v.kind)).toContain('faq-count');
  });

  it('rejects a featured handle that is not a live product', () => {
    const bad = draft({ featuredProductHandle: 'not-a-product' });
    expect(checkDraft(bad, CATALOG).map((v) => v.kind)).toContain('featured-handle');
  });
});

describe('selectStaleDrafts (report only — the job never deletes)', () => {
  const now = new Date('2026-09-10T13:00:00Z');
  const old = '2026-08-01T00:00:00Z'; // 40 days
  const recent = '2026-09-05T00:00:00Z'; // 5 days
  const JOURNAL_BLOG = 'gid://shopify/Blog/123';

  function article(overrides: Partial<JournalArticle>): JournalArticle {
    return {
      id: 'gid://shopify/Article/1',
      title: 'A draft',
      handle: 'a-draft',
      tags: [JOURNAL_DRAFT_TAG, 'Watches'],
      isPublished: false,
      createdAt: old,
      publishedAt: null,
      blog: { id: JOURNAL_BLOG },
      ...overrides,
    };
  }

  it('reports only unpublished, tagged drafts older than 21 days', () => {
    const picked = selectStaleDrafts([article({})], now, JOURNAL_BLOG);
    expect(picked.map((a) => a.id)).toEqual(['gid://shopify/Article/1']);
  });

  it('never reports a published article, even an old tagged one', () => {
    const published = article({ id: 'p', isPublished: true, publishedAt: '2026-08-02T00:00:00Z' });
    expect(selectStaleDrafts([published], now, JOURNAL_BLOG)).toEqual([]);
  });

  it('never reports a scheduled article that is not yet visible', () => {
    const scheduled = article({ id: 's', isPublished: false, publishedAt: '2026-12-01T00:00:00Z' });
    expect(selectStaleDrafts([scheduled], now, JOURNAL_BLOG)).toEqual([]);
  });

  it('never reports a draft without the journal-draft tag', () => {
    const untagged = article({ id: 'u', tags: ['Watches'] });
    expect(selectStaleDrafts([untagged], now, JOURNAL_BLOG)).toEqual([]);
  });

  it('never reports a draft that belongs to another blog', () => {
    const elsewhere = article({ id: 'o', blog: { id: 'gid://shopify/Blog/999' } });
    expect(selectStaleDrafts([elsewhere], now, JOURNAL_BLOG)).toEqual([]);
  });

  it('keeps a draft that is still inside the window', () => {
    expect(selectStaleDrafts([article({ id: 'r', createdAt: recent })], now, JOURNAL_BLOG)).toEqual([]);
  });

  it('treats the boundary as not yet stale', () => {
    const exactly = new Date(now.getTime() - DRAFT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    expect(selectStaleDrafts([article({ id: 'b', createdAt: exactly })], now, JOURNAL_BLOG)).toEqual([]);
  });

  it('ignores an unparseable createdAt', () => {
    expect(selectStaleDrafts([article({ id: 'x', createdAt: 'not a date' })], now, JOURNAL_BLOG)).toEqual([]);
  });
});

describe('adminArticleUrl', () => {
  it('builds an admin.shopify.com link from a myshopify domain', () => {
    expect(adminArticleUrl('laura-milman.myshopify.com', 'gid://shopify/Article/558')).toBe(
      'https://admin.shopify.com/store/laura-milman/articles/558',
    );
  });

  it('falls back to the store host for a custom domain', () => {
    expect(adminArticleUrl('https://lauramilman.com/', 'gid://shopify/Article/558')).toBe(
      'https://lauramilman.com/admin/articles/558',
    );
  });
});

describe('buildArticleCreateInput', () => {
  const input = buildArticleCreateInput(draft(), 'gid://shopify/Blog/123', {
    url: 'https://cdn.shopify.com/tank.jpg',
    altText: 'Cartier Tank',
    fallbackAltText: 'Cartier Tank 1962 in 18K gold',
  });

  it('never publishes and never schedules', () => {
    expect(input.isPublished).toBe(false);
    expect(input).not.toHaveProperty('publishDate');
  });

  it('sets the blog, author, and the journal-draft tag', () => {
    expect(input.blogId).toBe('gid://shopify/Blog/123');
    expect(input.author).toEqual({ name: 'Laura Milman New York' });
    expect(input.tags).toContain(JOURNAL_DRAFT_TAG);
    expect(input.tags).toContain('Watches');
  });

  it('carries the SEO fields as global.title_tag / global.description_tag', () => {
    expect(input.metafields).toEqual([
      {
        namespace: 'global',
        key: 'title_tag',
        type: 'single_line_text_field',
        value: draft().seoTitle,
      },
      {
        namespace: 'global',
        key: 'description_tag',
        type: 'single_line_text_field',
        value: draft().seoDescription,
      },
    ]);
  });

  it('appends the FAQ block to the body and sets the featured image', () => {
    expect(String(input.body)).toContain('Is a pre-owned tank watch a safe buy?');
    expect(input.image).toEqual({ url: 'https://cdn.shopify.com/tank.jpg', altText: 'Cartier Tank' });
  });

  it('omits the image when the featured product has none', () => {
    expect(buildArticleCreateInput(draft(), 'gid://shopify/Blog/123', null)).not.toHaveProperty('image');
  });

  it('replaces alt text the supplier scrub would change with the product title', () => {
    const scrubbed = buildArticleCreateInput(draft(), 'gid://shopify/Blog/123', {
      url: 'https://cdn.shopify.com/tank.jpg',
      altText: 'Cartier Tank from The Back Vault',
      fallbackAltText: 'Cartier Tank 1962 in 18K gold',
    });
    expect(scrubbed.image).toEqual({
      url: 'https://cdn.shopify.com/tank.jpg',
      altText: 'Cartier Tank 1962 in 18K gold',
    });
  });

  it('falls back to the article title when the product title is unusable too', () => {
    const scrubbed = buildArticleCreateInput(draft(), 'gid://shopify/Blog/123', {
      url: 'https://cdn.shopify.com/tank.jpg',
      altText: 'Back Vault piece',
      fallbackAltText: 'The Back Vault',
    });
    expect((scrubbed.image as { altText: string }).altText).toBe(draft().title);
  });

  it('canonicalizes tag casing before it reaches Shopify', () => {
    const odd = buildArticleCreateInput(draft({ tags: ['watches', 'STYLE'] }), 'gid://shopify/Blog/123', null);
    expect(odd.tags).toEqual(['Watches', 'Style', JOURNAL_DRAFT_TAG]);
  });
});

describe('continuationMessages', () => {
  const block = { type: 'text' as const, text: 'partial', citations: null };

  it('is exactly the user turn plus one assistant turn', () => {
    const messages = continuationMessages('ask', [block]);
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(messages[0]).toEqual({ role: 'user', content: 'ask' });
    expect(messages[1]?.content).toEqual([block]);
  });

  it('replaces the assistant turn on a second continuation rather than stacking one', () => {
    const second = { type: 'text' as const, text: 'more', citations: null };
    let messages = continuationMessages('ask', [block]);
    messages = continuationMessages('ask', [second]);
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(messages).toHaveLength(2);
    expect(messages[1]?.content).toEqual([second]);
  });
});

describe('hook parsing', () => {
  it('keeps only complete hooks and caps the list at ten', () => {
    const raw = Array.from({ length: 12 }, (_, i) => ({
      headline: `H${i}`,
      why: 'why',
      sourceUrl: 'https://example.com',
    }));
    expect(normalizeHooks(raw)).toHaveLength(10);
    expect(normalizeHooks([{ headline: 'H', why: '' , sourceUrl: 'https://e.com' }])).toEqual([]);
    expect(normalizeHooks({ hooks: raw.slice(0, 2) })).toHaveLength(2);
    expect(normalizeHooks('nope')).toEqual([]);
  });

  it('reads titles and links out of an RSS feed', () => {
    const xml =
      '<rss><channel><item><title>A tank at the premiere</title><link>https://example.com/a</link></item>' +
      '<item><title><![CDATA[Auction result]]></title><link>https://example.com/b</link></item></channel></rss>';
    expect(parseFeedItems(xml)).toEqual([
      { title: 'A tank at the premiere', link: 'https://example.com/a' },
      { title: 'Auction result', link: 'https://example.com/b' },
    ]);
  });

  it('reads an Atom feed', () => {
    const xml =
      '<feed><entry><title>New maison launch</title><link href="https://example.com/c"/></entry></feed>';
    expect(parseFeedItems(xml)).toEqual([{ title: 'New maison launch', link: 'https://example.com/c' }]);
  });
});
