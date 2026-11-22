import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mod = await import(new URL('../../assets/lm-related.js', import.meta.url).href);
const {
  familyOf,
  pickPools,
  recommend,
  candidateRequests,
  parsePool,
  renderCard,
  formatMoney,
  gather,
  normalizeSuggest,
} = mod;

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function piece(partial: Record<string, unknown>) {
  return {
    id: partial.handle,
    available: true,
    image: 'https://cdn.shopify.com/s/files/1/example.jpg',
    tags: [],
    vendor: 'Laura Milman New York',
    metal: '',
    shape: '',
    carat: '',
    url: `/products/${partial.handle}`,
    ...partial,
  };
}

const clover = piece({
  id: 1,
  handle: 'clover-bracelet',
  title: 'Clover Bracelet in 14K Yellow Gold',
  type: 'Bracelets',
  price: 29000,
  tags: ['clover gold bracelet', 'ebay'],
  collections: ['all', 'under-2500', 'all-bracelets', 'gifts-under-1000', 'gifts-under-2500'],
});

const anchor = piece({
  id: 2,
  handle: 'anchor-bracelet',
  title: 'Anchor Bracelet in 14K Yellow Gold',
  type: 'Bracelets',
  price: 29000,
  tags: ['14k gold bracelet', 'Anchor bracelet', 'ebay', 'Gold Anchor'],
});

const expensiveBracelet = piece({
  id: 3,
  handle: 'statement-bracelet',
  title: 'Statement Diamond Link Bracelet in 18K White Gold',
  type: 'Bracelets',
  price: 1200000,
  tags: ['18K White Gold', 'White Gold'],
});

const soldOutBracelet = piece({
  id: 4,
  handle: 'sold-out-bracelet',
  title: 'Clover Bracelet in 14K Yellow Gold',
  type: 'Bracelets',
  price: 29000,
  available: false,
  tags: ['clover', 'yellow gold'],
});

const cloverStuds = piece({
  id: 5,
  handle: 'clover-studs',
  title: '0.24 Carat Round Lab Created Diamond Clover Ear Studs',
  type: 'Earrings',
  price: 66000,
  tags: ['lab-grown'],
});

const stackRing = piece({
  id: 6,
  handle: 'stack-ring',
  title: 'Diamond Round Shape Stackable Ring in 14K Yellow Gold',
  type: 'Rings',
  price: 65000,
  tags: ['14k yellow gold', 'diamond', 'Round', 'stackable'],
});

const watch = piece({
  id: 10,
  handle: 'bvlgari-quadrato',
  title: 'Pre-Owned Bvlgari 18K Yellow Gold SQ 22 2T Quadrato Tubogas Diamond Bezel Women Watch',
  type: 'Watch',
  vendor: 'Bvlgari',
  price: 1944000,
  tags: ['18K Yellow Gold', 'Bvlgari', 'Watch', 'Yellow Gold'],
  collections: ['time-pieces', 'estate-jewelry', 'bvlgari', 'bvlgari-watches'],
});

const parentesi = piece({
  id: 11,
  handle: 'bvlgari-parentesi',
  title: 'Pre-Owned Bvlgari Parentesi 18K Yellow Gold BJ 01 Watch',
  type: 'Watch',
  vendor: 'Bvlgari',
  price: 1944000,
  tags: ['18K Yellow Gold', 'Bvlgari', 'Yellow Gold', 'Watch'],
});

const twoTone = piece({
  id: 12,
  handle: 'bvlgari-two-tone',
  title: 'Pre-Owned Bvlgari 18K Two Tone BB 232T Tubogas Watch',
  type: 'Watch',
  vendor: 'Bvlgari',
  price: 1320000,
  tags: ['18K Two Tone', 'Bvlgari', 'Watch'],
});

const soldOutTwin = piece({
  id: 13,
  handle: 'bvlgari-quadrato-sold',
  title: 'Pre-Owned Bvlgari 18K Yellow Gold SQ 22 2T Quadrato Tubogas Diamond Bezel Women Watch',
  type: 'Watch',
  vendor: 'Bvlgari',
  price: 1670000,
  available: false,
  tags: ['18K Yellow Gold', 'Bvlgari', 'Watch'],
});

const cartierWatch = piece({
  id: 14,
  handle: 'cartier-tank',
  title: 'Pre-Owned Cartier Tank Divan 18K Yellow Gold Watch',
  type: 'Watch',
  vendor: 'Cartier',
  price: 1750000,
  tags: ['Cartier', '18K Yellow Gold', 'Watch'],
});

const bvlgariEarrings = piece({
  id: 15,
  handle: 'bvlgari-doorknockers',
  title: 'Pre-Owned Bvlgari 18K Yellow Gold Carnelian Doorknockers Earrings',
  type: 'Earrings',
  vendor: 'Bvlgari',
  price: 1100000,
  tags: ['Bvlgari', 'Earrings', 'Vintage'],
});

const farNecklace = piece({
  id: 16,
  handle: 'bvlgari-coin-necklace',
  title: 'Pre-Owned Bvlgari Coin 18K Yellow Gold Diamond Necklace',
  type: 'Necklaces',
  vendor: 'Bvlgari',
  price: 11240000,
  tags: ['Bvlgari', 'Necklaces'],
});

const hoop = piece({
  id: 20,
  handle: 'diamond-hoop',
  title: 'Diamond Hoop Earrings in 18K White Gold',
  type: 'Earrings',
  price: 390000,
  tags: ['18k white gold', 'diamond', 'diamond hoops', 'hoops', 'White gold'],
  collections: ['earrings', 'hoop-earrings', 'all', 'all-earrings'],
});

const petal = piece({
  id: 21,
  handle: 'flower-petal',
  title: 'Flower Petal Diamond Stud Earrings in 18K White Gold',
  type: 'Earrings',
  price: 450000,
  tags: ['18k white gold', 'diamond', 'studs', 'White gold'],
});

const yellowPetal = piece({
  id: 22,
  handle: 'flower-petal-yellow',
  title: 'Flower Petal Diamond Stud Earrings in 18K Yellow Gold',
  type: 'Earrings',
  price: 450000,
  tags: ['18k yellow gold', 'diamond', 'studs', 'yellow gold'],
});

const jacob = piece({
  id: 23,
  handle: 'jacob-earrings',
  title: 'New Jacob & Company x G-Dragon PEACEMINUSONE Earrings',
  type: 'Earrings',
  vendor: 'Jacob & Co',
  price: 260800,
  tags: [],
});

const soldOutStuds = piece({
  id: 24,
  handle: 'sold-out-studs',
  title: '6 Carat Round Cut Lab Grown Diamonds Stud Earrings',
  type: 'Earrings',
  price: 296500,
  available: false,
  tags: ['lab-grown'],
});

const baguette = piece({
  id: 30,
  handle: 'baguette-ring',
  title: 'Double Baguette Diamond Ring in 18K White Gold',
  type: 'Rings',
  price: 380000,
  tags: ['18K White Gold', 'Diamond Rings', 'White Gold'],
  collections: ['rings', 'all', 'diamond-rings'],
});

const bowRing = piece({
  id: 31,
  handle: 'bow-ring',
  title: 'Diamond Bow Tie Ring in 18K Rose Gold',
  type: 'Rings',
  price: 364000,
  tags: ['Rose Gold', 'diamond'],
});

describe('related product families', () => {
  it('maps singular and plural catalog types onto one family', () => {
    expect(familyOf({ type: 'Watch', title: 'Tank' })).toBe('watch');
    expect(familyOf({ type: 'Bangle', title: 'Gold bangle' })).toBe('bracelet');
    expect(familyOf({ type: 'Engagement Ring', title: 'Solitaire' })).toBe('ring');
    expect(familyOf({ type: 'Other jewelry', title: 'Lab Grown Diamond Stud Earrings' })).toBe('earring');
    expect(familyOf({ type: 'Lab-Grown Diamond', title: '1.20ct Round' })).toBe('diamond');
    expect(familyOf({ type: 'Natural Diamond', title: '1.20ct Round' })).toBe('diamond');
    expect(familyOf({ type: 'Necklaces', title: 'Chain' })).toBe('necklace');
  });
});

describe('collection pools', () => {
  it('does not use the whole catalog or the estate catch-all for a gold bracelet', () => {
    const pools = pickPools(clover);
    expect(pools.collections).toEqual(['all-bracelets', 'gifts-under-1000', 'necklaces']);
    expect(pools.suggest).toBe('yellow gold bracelet');
    const urls = candidateRequests({ ...clover, recommendationsUrl: '/recommendations/products', sectionId: 'recommendations' });
    const paths = urls.map((request: { url: string }) => new URL(request.url, 'https://lauramilman.com').pathname);
    expect(paths).not.toContain('/collections/all');
    expect(paths).toContain('/collections/all-bracelets');
    expect(paths.join('\n')).not.toContain('estate-jewelry');
    expect(urls.some((request: { url: string }) => request.url.includes('intent=related'))).toBe(true);
  });

  it('asks a watch for its brand, then other watches, then the brand collection', () => {
    expect(pickPools(watch).collections).toEqual(['bvlgari-watches', 'time-pieces', 'bvlgari']);
  });

  it('prefers hoop earrings over the broad earring collection', () => {
    expect(pickPools(hoop).collections[0]).toBe('hoop-earrings');
    expect(pickPools(hoop).collections).toContain('all-earrings');
    expect(pickPools(hoop).collections).not.toContain('all');
  });

  it('keeps high jewelry inside high jewelry', () => {
    const high = piece({
      handle: 'high-bracelet',
      title: 'High Jewelry Bracelet',
      type: 'Bracelets',
      price: 8000000,
      highJewelry: true,
      collections: ['high-jewelry', 'all-bracelets'],
    });
    expect(pickPools(high).collections).toEqual(['high-jewelry']);
    expect(pickPools(high).suggest).toBe('');
  });
});

describe('You may also like and Complete the look', () => {
  it('ranks a gold bracelet with other gold bracelets, then paired gold jewelry', () => {
    const rows = recommend(clover, [clover, anchor, expensiveBracelet, soldOutBracelet, cloverStuds, stackRing, watch]);
    expect(rows.similar.map((item: { handle: string }) => item.handle)).toEqual(['anchor-bracelet', 'statement-bracelet']);
    expect(rows.complement.map((item: { handle: string }) => item.handle)).toEqual(['stack-ring', 'clover-studs']);
    expect(rows.similar.concat(rows.complement).map((item: { handle: string }) => item.handle)).not.toContain('clover-bracelet');
    expect(rows.similar.concat(rows.complement).map((item: { handle: string }) => item.handle)).not.toContain('sold-out-bracelet');
    expect(rows.complement.map((item: { handle: string }) => item.handle)).not.toContain('anchor-bracelet');
  });

  it('keeps a Bvlgari watch with Bvlgari watches and pairs yellow gold jewelry', () => {
    const rows = recommend(watch, [watch, parentesi, twoTone, soldOutTwin, cartierWatch, bvlgariEarrings, farNecklace, anchor]);
    expect(rows.similar[0].handle).toBe('bvlgari-parentesi');
    expect(rows.similar.map((item: { handle: string }) => item.handle)).toContain('bvlgari-two-tone');
    expect(rows.similar.map((item: { handle: string }) => item.handle)).toContain('cartier-tank');
    expect(rows.similar.indexOf(rows.similar.find((item: { handle: string }) => item.handle === 'bvlgari-parentesi'))).toBeLessThan(
      rows.similar.indexOf(rows.similar.find((item: { handle: string }) => item.handle === 'cartier-tank')),
    );
    expect(rows.similar.map((item: { handle: string }) => item.handle)).not.toContain('bvlgari-quadrato-sold');
    expect(rows.complement.map((item: { handle: string }) => item.handle)).toContain('bvlgari-doorknockers');
    expect(rows.complement.map((item: { handle: string }) => item.handle)).not.toContain('anchor-bracelet');
    const handles = new Set(rows.similar.concat(rows.complement).map((item: { handle: string }) => item.handle));
    expect(handles.size).toBe(rows.similar.length + rows.complement.length);
  });

  it('suggests white gold diamond earrings and a white gold diamond ring for hoop earrings', () => {
    const rows = recommend(hoop, [hoop, petal, yellowPetal, jacob, soldOutStuds, baguette, anchor, expensiveBracelet]);
    expect(rows.similar[0].handle).toBe('flower-petal');
    expect(rows.similar.map((item: { handle: string }) => item.handle)).not.toContain('sold-out-studs');
    expect(rows.similar.indexOf(rows.similar.find((item: { handle: string }) => item.handle === 'flower-petal'))).toBeLessThan(
      rows.similar.indexOf(rows.similar.find((item: { handle: string }) => item.handle === 'flower-petal-yellow')),
    );
    expect(rows.complement.map((item: { handle: string }) => item.handle)).toContain('baguette-ring');
    expect(rows.complement.map((item: { handle: string }) => item.handle)).not.toContain('anchor-bracelet');
  });

  it('pairs a diamond ring with diamond earrings rather than another copy of itself', () => {
    const rows = recommend(baguette, [baguette, bowRing, hoop, petal, watch, anchor]);
    expect(rows.similar.map((item: { handle: string }) => item.handle)).toContain('bow-ring');
    expect(rows.similar.map((item: { handle: string }) => item.handle)).not.toContain('baguette-ring');
    expect(rows.complement[0].handle).toBe('diamond-hoop');
    expect(rows.complement.map((item: { handle: string }) => item.handle)).not.toContain('bow-ring');
  });

  it('hides Complete the look when nothing in another category is actually related', () => {
    const rows = recommend(watch, [parentesi, twoTone]);
    expect(rows.similar.length).toBeGreaterThan(0);
    expect(rows.complement).toEqual([]);
  });

  it('does not let a recently viewed necklace become a similar watch', () => {
    const rows = recommend(watch, [parentesi, farNecklace], ['bvlgari-coin-necklace', 'bvlgari-parentesi']);
    expect(rows.similar.map((item: { handle: string }) => item.handle)).not.toContain('bvlgari-coin-necklace');
    const twinA = { ...parentesi, id: 111, handle: 'parentesi-a' };
    const twinB = { ...parentesi, id: 112, handle: 'parentesi-b' };
    expect(recommend(watch, [twinA, twinB]).similar[0].handle).toBe('parentesi-a');
    expect(recommend(watch, [twinA, twinB], ['parentesi-b']).similar[0].handle).toBe('parentesi-b');
  });

  it('keeps loose lab diamonds with a similar shape and price, not a different origin', () => {
    const stone = piece({
      handle: 'lg-round',
      title: '1.20ct Round Lab-Grown Diamond',
      type: 'Lab-Grown Diamond',
      price: 80000,
      shape: 'Round',
      carat: '1.20',
      tags: ['lab-grown'],
    });
    const close = piece({
      handle: 'lg-round-near',
      title: '1.10ct Round Lab-Grown Diamond',
      type: 'Lab-Grown Diamond',
      price: 90000,
      shape: 'Round',
      carat: '1.10',
      tags: ['lab-grown'],
    });
    const huge = piece({
      handle: 'lg-oval-huge',
      title: '5.00ct Oval Lab-Grown Diamond',
      type: 'Lab-Grown Diamond',
      price: 800000,
      shape: 'Oval',
      carat: '5',
      tags: ['lab-grown'],
    });
    const natural = piece({
      handle: 'nd-round',
      title: '1.20ct Round Natural Diamond',
      type: 'Natural Diamond',
      price: 500000,
      shape: 'Round',
      carat: '1.20',
      tags: ['natural diamond'],
    });
    const labStuds = piece({
      handle: 'lab-studs',
      title: '0.50ct Round Lab-Grown Diamond Stud Earrings',
      type: 'Earrings',
      price: 95000,
      tags: ['lab-grown', 'diamond', 'studs'],
    });
    const rows = recommend(stone, [stone, close, huge, natural, petal, labStuds]);
    expect(rows.similar.map((item: { handle: string }) => item.handle)).toEqual(['lg-round-near']);
    expect(rows.complement.map((item: { handle: string }) => item.handle)).toContain('lab-studs');
    expect(rows.complement.map((item: { handle: string }) => item.handle)).not.toContain('flower-petal');
  });

  it('does not mix high jewelry into a fashion bracelet row', () => {
    const highNecklace = piece({
      handle: 'high-necklace',
      title: 'High Jewelry Diamond Necklace in 18K Yellow Gold',
      type: 'Necklaces',
      price: 8000000,
      vendor: 'Laura Milman New York',
      highJewelry: true,
      tags: ['high-jewelry', 'yellow gold', 'diamond'],
    });
    const rows = recommend(clover, [anchor, highNecklace]);
    expect(rows.similar.concat(rows.complement).map((item: { handle: string }) => item.handle)).not.toContain('high-necklace');
  });
});

describe('candidate feeds and cards', () => {
  it('parses the compact collection feed and drops nothing the feed already marked available', () => {
    const html = `<div id="shopify-section-pool"><script type="application/json" data-lm-pool>{"products":[{"id":2,"handle":"anchor-bracelet","title":"Anchor Bracelet in 14K Yellow Gold","vendor":"Laura Milman New York","type":"Bracelets","price":29000,"compareAt":0,"tags":["yellow gold"],"available":true,"url":"/products/anchor-bracelet","image":"https://cdn.shopify.com/s/files/a.jpg","imageAlt":"Anchor","image2":"","metal":"14K Yellow Gold","shape":null,"carat":null,"highJewelry":false}]}</script></div>`;
    const parsed = parsePool(html);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].price).toBe(29000);
    expect(parsed[0].metal).toBe('14K Yellow Gold');
  });

  it('reads suggest prices as dollars and related-intent HTML as the same cards', async () => {
    const source = {
      ...clover,
      root: '/',
      recommendationsUrl: '/recommendations/products',
      sectionId: 'recommendations',
    };
    const seen: string[] = [];
    const fetchImpl = async (url: string) => {
      seen.push(url);
      if (url.includes('suggest.json')) {
        return {
          ok: true,
          json: async () => ({
            resources: {
              results: {
                products: [{
                  id: 2,
                  handle: 'anchor-bracelet',
                  title: 'Anchor Bracelet in 14K Yellow Gold',
                  vendor: 'Laura Milman New York',
                  type: 'Bracelets',
                  price: '290.00',
                  available: true,
                  url: '/products/anchor-bracelet',
                  image: 'https://cdn.shopify.com/s/files/a.jpg',
                }],
              },
            },
          }),
        };
      }
      return {
        ok: true,
        text: async () => '<script type="application/json" data-lm-pool>{"products":[]}</script>',
      };
    };
    const candidates = await gather(source, fetchImpl);
    expect(seen.some((url) => url.includes('intent=related'))).toBe(true);
    expect(candidates[0].price).toBe(29000);
    expect(normalizeSuggest({ price: '19.50', handle: 'x', title: 'X', available: true, image: 'https://cdn.shopify.com/a.jpg' }).price).toBe(1950);
  });

  it('renders the existing product card classes and escapes the title', () => {
    const html = renderCard({
      ...petal,
      title: 'Flower <script> Petal',
      vendor: 'Jacob & Company',
      compareAt: 500000,
      tags: ['lab-grown', 'new'],
    }, '${{amount}}');
    expect(html).toContain('class="product-card"');
    expect(html).toContain('product-card__image-wrapper');
    expect(html).toContain('product-card__title');
    expect(html).toContain('product-card__price--sale');
    expect(html).toContain('lab-grown-tag');
    expect(html).toContain('Jacob &amp; Co.');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('Diamond District');
    expect(formatMoney(1944000, '${{amount}}')).toBe('$19,440.00');
    expect(formatMoney(29000, '${{amount}}')).toBe('$290.00');
  });
});

describe('theme wiring', () => {
  const section = themeFile('sections/product-recommendations.liquid');
  const pool = themeFile('sections/lm-related-pool.liquid');
  const template = themeFile('templates/collection.lm-related.liquid');
  const script = themeFile('assets/lm-related.js');

  it('keeps both row titles and does not print the old first-collection loop', () => {
    expect(section).toContain('You May Also Like');
    expect(section).toContain('Complete the look');
    expect(section).toContain('lm-related.js');
    expect(section).toContain('data-lm-row="similar"');
    expect(section).toContain('data-lm-row="complement"');
    expect(section).toContain('recommendations.performed');
    expect(section).not.toContain('rec_collection.products');
    expect(section).not.toContain('Diamond District');
    expect(script).not.toContain('Diamond District');
    expect(section).toContain('product-recs__grid');
    expect(section).toContain('repeat(2, minmax(0, 1fr))');
  });

  it('serves a description-free collection feed and the private-viewing line for high jewelry', () => {
    expect(template).toContain("layout none");
    expect(template).toContain("section 'lm-related-pool'");
    expect(pool).toContain('lm-related-candidates');
    expect(section).toContain('Choose a piece to see its details or request a private viewing.');
    expect(themeFile('snippets/lm-related-candidates.liquid')).toContain('product.available == false');
  });
});
