/**
 * Related rows on product pages.
 *
 * "You may also like" is the same kind of piece (a watch stays with watches).
 * "Complete the look" is a different category that pairs with it (a gold
 * bracelet with a gold necklace, earrings, or ring).
 *
 * The product page does not loop the catalog. When the section nears the
 * viewport this module loads a few small candidate feeds and scores them
 * here. Shopify's related-intent recommendations are one of those feeds;
 * they are candidates, not the order we show.
 *
 * Recently viewed handles live in localStorage on this device only.
 * They add a small bonus and can fill a short row. They never override
 * category, and nothing about the shopper leaves the browser.
 */

const RECENT_KEY = 'lmny-recent';
const RECENT_MAX = 8;
const SKIP_COLLECTIONS = new Set([
  'all',
  'frontpage',
  'search',
  'homepage',
  'estate-jewelry',
  'new-arrivals',
  'sale',
]);

const SHAPES = ['round', 'princess', 'cushion', 'emerald', 'oval', 'radiant', 'asscher', 'marquise', 'heart', 'pear'];

const CANONICAL = {
  watch: 'time-pieces',
  ring: 'rings',
  earring: 'all-earrings',
  bracelet: 'all-bracelets',
  necklace: 'necklaces',
  pendant: 'all-pendants',
  brooch: 'brooches',
  cufflink: 'cufflinks',
  jewelry: 'rings',
};

const PAIRED_COLLECTION = {
  watch: 'all-bracelets',
  ring: 'all-earrings',
  earring: 'necklaces',
  bracelet: 'necklaces',
  necklace: 'all-earrings',
  pendant: 'all-earrings',
  brooch: 'necklaces',
  cufflink: 'time-pieces',
  diamond: 'rings',
  jewelry: 'necklaces',
};

const PAIRS = {
  watch: ['bracelet', 'cufflink', 'ring', 'earring', 'necklace'],
  ring: ['earring', 'pendant', 'bracelet', 'necklace'],
  earring: ['necklace', 'bracelet', 'ring', 'pendant'],
  bracelet: ['necklace', 'earring', 'ring', 'pendant'],
  necklace: ['earring', 'bracelet', 'ring', 'pendant'],
  pendant: ['earring', 'necklace', 'bracelet', 'ring'],
  brooch: ['necklace', 'earring'],
  cufflink: ['watch', 'ring', 'bracelet'],
  diamond: ['ring', 'earring', 'pendant', 'bracelet', 'necklace'],
  jewelry: ['ring', 'necklace', 'earring', 'bracelet'],
};

const FAMILY_NEEDLES = {
  watch: ['watches', 'watch'],
  ring: ['rings', 'ring', 'wedding-bands', 'wedding-band'],
  earring: ['earrings', 'earring'],
  bracelet: ['bracelets', 'bracelet', 'bangles', 'bangle'],
  necklace: ['necklaces', 'necklace'],
  pendant: ['pendants', 'pendant'],
  brooch: ['brooches', 'brooch'],
  cufflink: ['cufflinks', 'cufflink'],
};

const STYLES = [
  'hoop', 'huggie', 'stud', 'drop', 'tennis', 'station', 'bangle', 'cuff', 'charm',
  'cuban', 'figaro', 'franco', 'curb', 'rope', 'clover', 'tubogas', 'serpenti',
  'parentesi', 'tank', 'santos', 'pasha', 'solitaire', 'halo', 'eternity', 'signet',
  'cocktail', 'cluster', 'bezel', 'floral', 'flower', 'bow',
];

const GEMS = ['diamond', 'sapphire', 'ruby', 'emerald', 'tourmaline', 'pearl', 'opal', 'amethyst', 'moissanite'];

const METAL_PHRASE = {
  yellow: 'yellow gold',
  white: 'white gold',
  rose: 'rose gold',
  platinum: 'platinum',
  silver: 'silver',
  'two-tone': 'two tone gold',
  gold: 'gold',
};

const FAMILY_PHRASE = {
  watch: 'watch',
  ring: 'ring',
  earring: 'earrings',
  bracelet: 'bracelet',
  necklace: 'necklace',
  pendant: 'pendant',
  brooch: 'brooch',
  cufflink: 'cufflinks',
  jewelry: 'jewelry',
};

function haystack(product) {
  const tags = Array.isArray(product.tags) ? product.tags.join(' ') : (product.tags || '');
  return `${product.metal || ''} ${product.title || ''} ${product.type || ''} ${product.vendor || ''} ${product.handle || ''} ${tags}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function hasToken(text, token) {
  const re = new RegExp(`(?:^|[^a-z])${token}s?(?:[^a-z]|$)`, 'i');
  return re.test(text);
}

export function familyOf(product) {
  const type = String(product.type || '').toLowerCase();
  const title = String(product.title || '').toLowerCase();
  if (type === 'natural diamond' || type === 'lab-grown diamond' || type === 'lab grown diamond') return 'diamond';

  const checks = [
    ['earring', 'earring'],
    ['bangle', 'bracelet'],
    ['bracelet', 'bracelet'],
    ['necklace', 'necklace'],
    ['pendant', 'pendant'],
    ['brooch', 'brooch'],
    ['cufflink', 'cufflink'],
    ['watch', 'watch'],
    ['solitaire', 'ring'],
    ['wedding band', 'ring'],
    ['engagement', 'ring'],
    ['ring', 'ring'],
  ];
  for (const [needle, family] of checks) {
    if (type.includes(needle)) return family;
  }
  if (type.includes('chain') && !type.includes('bracelet')) return 'necklace';
  for (const [needle, family] of checks) {
    if (title.includes(needle)) return family;
  }
  if (title.includes('chain') && !title.includes('bracelet')) return 'necklace';
  return 'jewelry';
}

export function metalOf(product) {
  const text = haystack(product);
  const rose = /rose|pink gold/.test(text);
  const yellow = /yellow/.test(text);
  const white = /white gold/.test(text);
  const platinum = /platinum/.test(text);
  const silver = /sterling|\bsilver\b/.test(text);
  if (/two[-\s]?tone|tri[-\s]?colou?r/.test(text) || [rose, yellow, white, platinum].filter(Boolean).length > 1) {
    return 'two-tone';
  }
  if (rose) return 'rose';
  if (yellow) return 'yellow';
  if (white) return 'white';
  if (platinum) return 'platinum';
  if (silver) return 'silver';
  if (/\bgold\b/.test(text)) return 'gold';
  return '';
}

export function originOf(product) {
  const text = haystack(product);
  const vendor = String(product.vendor || '').toLowerCase();
  if (vendor === 'peaceful diamonds') return 'lab';
  if (/lab[-\s]?grown|lab[-\s]?created|lab diamond/.test(text) || String(product.handle || '').startsWith('lg-')) return 'lab';
  if (String(product.type || '').toLowerCase() === 'natural diamond' || /natural diamond/.test(text)) return 'natural';
  return '';
}

export function shapeOf(product) {
  const stated = String(product.shape || '').toLowerCase().replace('elongated cushion', 'cushion').trim();
  if (SHAPES.includes(stated)) return stated;
  const tags = Array.isArray(product.tags) ? product.tags : [];
  for (const tag of tags) {
    const value = String(tag).toLowerCase().replace(/ cut$/, '').trim();
    if (SHAPES.includes(value)) return value;
  }
  if (familyOf(product) === 'diamond') {
    const title = String(product.title || '').toLowerCase();
    for (const shape of SHAPES) {
      if (title.includes(shape)) return shape;
    }
  }
  return '';
}

export function caratOf(product) {
  const direct = parseFloat(product.carat);
  if (direct > 0) return direct;
  const match = String(product.title || '').match(/(\d+(?:\.\d+)?)\s*(?:ct|carat)\b/i);
  return match ? parseFloat(match[1]) : 0;
}

function tokens(product, list) {
  const text = haystack(product);
  return list.filter((token) => hasToken(text, token));
}

export function genderOf(product) {
  const tags = Array.isArray(product.tags) ? product.tags.join(' ') : '';
  const cols = Array.isArray(product.collections) ? product.collections.join(' ') : '';
  const text = `${product.title || ''} ${tags} ${cols}`.toLowerCase();
  const men = /\bmen\b|\bman\b|\bmens\b|\bgents\b/.test(text);
  const women = /\bwomen\b|\bwoman\b|\bwomens\b|\bladies\b|\blady\b/.test(text);
  if (men && women) return '';
  if (men) return 'men';
  if (women) return 'women';
  return '';
}

function isHighJewelry(product) {
  if (product.highJewelry === true) return true;
  const cols = Array.isArray(product.collections) ? product.collections : [];
  if (cols.some((handle) => handle === 'high-jewelry' || String(handle).startsWith('high-jewelry'))) return true;
  const tags = (Array.isArray(product.tags) ? product.tags : []).join(' ').toLowerCase();
  return tags.includes('high-jewelry') || tags.includes('high jewelry');
}

function handleize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function handleHas(handle, needle) {
  return handle === needle
    || handle.startsWith(`${needle}-`)
    || handle.endsWith(`-${needle}`)
    || handle.includes(`-${needle}-`)
    || handle === `all-${needle}`;
}

function matchesFamily(handle, family) {
  if (!handle || SKIP_COLLECTIONS.has(handle)) return false;
  if (family === 'diamond') {
    return handle === 'lab-grown-diamonds'
      || handle === 'natural-diamonds'
      || handle === 'colored-lab-grown-diamonds';
  }
  return (FAMILY_NEEDLES[family] || []).some((needle) => handleHas(handle, needle));
}

function priceCeiling(handle) {
  const match = String(handle).match(/(?:gifts-)?under-(\d+)/);
  return match ? Number(match[1]) : 0;
}

function unique(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function diamondCanonical(source, cols) {
  const origin = originOf(source);
  if (origin === 'natural' || cols.includes('natural-diamonds')) return 'natural-diamonds';
  if (cols.includes('colored-lab-grown-diamonds')) return 'colored-lab-grown-diamonds';
  return 'lab-grown-diamonds';
}

export function pickPools(source) {
  const cols = (source.collections || []).map((handle) => String(handle || '').toLowerCase()).filter(Boolean);
  const family = familyOf(source);
  const highHandles = cols.filter((handle) => handle === 'high-jewelry' || handle.startsWith('high-jewelry'));
  if (source.highJewelry || highHandles.length) {
    return { collections: (highHandles.length ? highHandles : ['high-jewelry']).slice(0, 2), suggest: '' };
  }

  const vendor = handleize(source.vendor);
  const house = /laura-milman|milman-new-york|lauras-gems/.test(vendor);
  const familyHandles = cols
    .filter((handle) => matchesFamily(handle, family))
    .sort((a, b) => {
      const brandA = !house && vendor && a.includes(vendor) ? 100 : 0;
      const brandB = !house && vendor && b.includes(vendor) ? 100 : 0;
      return (brandB + b.length) - (brandA + a.length);
    });
  const from = String(source.fromCollection || '').toLowerCase();
  if (from && matchesFamily(from, family)) familyHandles.unshift(from);

  const canonical = family === 'diamond' ? diamondCanonical(source, cols) : CANONICAL[family];
  const brandMixed = house ? '' : cols.find((handle) => {
    if (SKIP_COLLECTIONS.has(handle) || matchesFamily(handle, family)) return false;
    return handle === vendor || handle.startsWith(`${vendor}-`);
  });
  const dollars = (Number(source.price) || 0) / 100;
  const priceBand = cols
    .filter((handle) => priceCeiling(handle) > 0 && priceCeiling(handle) >= dollars)
    .sort((a, b) => priceCeiling(a) - priceCeiling(b))[0] || '';

  const collections = unique([
    familyHandles[0],
    canonical,
    brandMixed,
    priceBand,
    PAIRED_COLLECTION[family],
  ]).slice(0, 3);

  let suggest = '';
  if (family === 'diamond') {
    const shape = shapeOf(source);
    const origin = originOf(source) === 'natural' ? 'natural' : 'lab grown';
    suggest = `${shape} ${origin} diamond`.trim().replace(/\s+/g, ' ');
  } else {
    const metal = METAL_PHRASE[metalOf(source)] || '';
    const noun = FAMILY_PHRASE[family] || '';
    suggest = `${metal} ${noun}`.trim();
  }

  return { collections, suggest };
}

function priceCloseness(sourcePrice, candidatePrice) {
  if (!sourcePrice || !candidatePrice) return 'unknown';
  const ratio = candidatePrice / sourcePrice;
  if (ratio >= 0.75 && ratio <= 1.35) return 'close';
  if (ratio >= 0.5 && ratio <= 2) return 'near';
  if (ratio >= 0.35 && ratio <= 3) return 'wide';
  return 'far';
}

function shared(left, right) {
  const set = new Set(right);
  return left.filter((item) => set.has(item));
}

function eligible(source, candidate) {
  if (!candidate || candidate.available === false) return false;
  if (!candidate.image || !candidate.price) return false;
  if (!candidate.handle) return false;
  if (String(candidate.id) === String(source.id) || candidate.handle === source.handle) return false;
  const sourceHigh = isHighJewelry(source);
  const candidateHigh = isHighJewelry(candidate);
  if (sourceHigh !== candidateHigh) return false;
  return true;
}

function looseDiamondAffinity(source, candidate) {
  if (familyOf(source) !== 'diamond') return true;
  const sourceShape = shapeOf(source);
  const candidateShape = shapeOf(candidate);
  const shapeOk = sourceShape && sourceShape === candidateShape;
  const sourceCarat = caratOf(source);
  const candidateCarat = caratOf(candidate);
  const caratOk = sourceCarat > 0 && candidateCarat > 0 && Math.abs(candidateCarat - sourceCarat) / sourceCarat <= 0.3;
  const priceOk = priceCloseness(source.price, candidate.price) === 'close' || priceCloseness(source.price, candidate.price) === 'near';
  return shapeOk || caratOk || priceOk;
}

/**
 * @returns {{similar: object[], complement: object[]}}
 */
export function recommend(source, candidates, recentHandles = []) {
  const recent = new Set(recentHandles);
  const limit = source.limit || 4;
  const list = dedupe(candidates);
  const sourceFamily = familyOf(source);
  const sourceMetal = metalOf(source);
  const sourceOrigin = originOf(source);
  const sourceStyles = tokens(source, STYLES);
  const sourceGems = tokens(source, GEMS);
  const sourceGender = genderOf(source);
  const sourceVendor = handleize(source.vendor);

  const similar = [];
  const complement = [];

  list.forEach((candidate, index) => {
    if (!eligible(source, candidate)) return;
    const family = familyOf(candidate);
    const metal = metalOf(candidate);
    const origin = originOf(candidate);
    const styles = shared(sourceStyles, tokens(candidate, STYLES));
    const gems = shared(sourceGems, tokens(candidate, GEMS));
    const gender = genderOf(candidate);
    const vendor = handleize(candidate.vendor);
    const sameVendor = sourceVendor && sourceVendor === vendor;
    const metalExact = sourceMetal && metal && sourceMetal === metal && sourceMetal !== 'gold';
    const metalPartial = !metalExact && sourceMetal && metal && (sourceMetal === 'gold' || metal === 'gold' || (sourceMetal === 'two-tone' && metal !== 'platinum' && metal !== 'silver'));
    const originMatch = sourceOrigin && origin && sourceOrigin === origin;
    const originConflict = sourceOrigin && origin && sourceOrigin !== origin;
    const price = priceCloseness(source.price, candidate.price);
    const recentBoost = recent.has(candidate.handle) ? 5 : 0;
    const shapeMatch = shapeOf(source) && shapeOf(source) === shapeOf(candidate);
    const sourceCarat = caratOf(source);
    const candidateCarat = caratOf(candidate);
    const caratClose = sourceCarat > 0 && candidateCarat > 0 && Math.abs(candidateCarat - sourceCarat) / sourceCarat <= 0.25;

    if (family === sourceFamily) {
      if (originConflict && sourceFamily === 'diamond') return;
      if (!looseDiamondAffinity(source, candidate)) return;
      let score = 40 + recentBoost;
      if (sameVendor) score += 40;
      if (metalExact) score += 28;
      else if (metalPartial) score += 10;
      if (originMatch) score += 18;
      else if (originConflict) score -= 25;
      if (styles.length) score += 16;
      if (gems.length) score += 10;
      if (sourceGender && gender === sourceGender) score += 6;
      else if (sourceGender && gender && gender !== sourceGender) score -= 8;
      if (price === 'close') score += 28;
      else if (price === 'near') score += 16;
      else if (price === 'wide') score += 6;
      else if (price === 'far') score -= 18;
      if (shapeMatch) score += 20;
      if (caratClose) score += 14;
      similar.push({ item: candidate, score, index });
      return;
    }

    if (!(PAIRS[sourceFamily] || []).includes(family)) return;
    let score = recentBoost;
    if (metalExact) score += 36;
    else if (metalPartial) score += 14;
    if (sameVendor) score += 22;
    if (originMatch) score += 16;
    else if (originConflict) score -= 24;
    if (styles.length) score += 18;
    if (gems.length) score += 12;
    if (sourceGender && gender === sourceGender) score += 8;
    else if (sourceGender && gender && gender !== sourceGender) score -= 10;
    if (price === 'close') score += 18;
    else if (price === 'near') score += 10;
    else if (price === 'wide') score += 4;
    else if (price === 'far') score -= 22;
    if (score >= 18) complement.push({ item: candidate, score, index });
  });

  const byScore = (a, b) => b.score - a.score || a.index - b.index;
  const pickedSimilar = similar.sort(byScore).slice(0, limit).map((row) => row.item);
  const used = new Set(pickedSimilar.map((item) => item.handle));
  const pickedComplement = complement
    .filter((row) => !used.has(row.item.handle))
    .sort(byScore)
    .slice(0, limit)
    .map((row) => row.item);

  return { similar: pickedSimilar, complement: pickedComplement };
}

export function dedupe(list) {
  const map = new Map();
  for (const candidate of list) {
    if (!candidate || !candidate.handle) continue;
    const prev = map.get(candidate.handle);
    if (!prev) {
      map.set(candidate.handle, candidate);
      continue;
    }
    map.set(candidate.handle, {
      ...prev,
      ...candidate,
      metal: candidate.metal || prev.metal,
      shape: candidate.shape || prev.shape,
      carat: candidate.carat || prev.carat,
      image: candidate.image || prev.image,
      image2: candidate.image2 || prev.image2,
      tags: (candidate.tags && candidate.tags.length) ? candidate.tags : prev.tags,
    });
  }
  return [...map.values()];
}

function withRoot(root, path) {
  const base = String(root || '/').replace(/\/$/, '');
  return `${base}${path}`;
}

export function candidateRequests(source) {
  const { collections, suggest } = pickPools(source);
  const root = source.root || '/';
  const requests = collections.map((handle) => ({
    kind: 'collection',
    url: withRoot(root, `/collections/${encodeURIComponent(handle)}?view=lm-related`),
  }));
  if (suggest) {
    const params = new URLSearchParams();
    params.set('q', suggest);
    params.set('resources[type]', 'product');
    params.set('resources[limit]', '8');
    params.set('resources[options][unavailable_products]', 'hide');
    requests.push({ kind: 'suggest', url: withRoot(root, `/search/suggest.json?${params}`) });
  }
  if (source.recommendationsUrl && source.sectionId && source.id) {
    const url = new URL(source.recommendationsUrl, 'https://lauramilman.com');
    url.searchParams.set('section_id', source.sectionId);
    url.searchParams.set('product_id', String(source.id));
    url.searchParams.set('limit', '10');
    url.searchParams.set('intent', 'related');
    requests.push({ kind: 'related', url: `${url.pathname}${url.search}` });
  }
  return requests;
}

export function parsePool(html) {
  const match = String(html || '').match(/<script[^>]*data-lm-pool[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return [];
  try {
    const data = JSON.parse(match[1]);
    return (data.products || []).map(normalizePool);
  } catch {
    return [];
  }
}

function asTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (!tags) return [];
  return String(tags).split(',').map((tag) => tag.trim()).filter(Boolean);
}

function imageUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.src || value.url || '';
}

export function normalizePool(product) {
  return {
    id: product.id,
    handle: product.handle,
    title: product.title || '',
    vendor: product.vendor || '',
    type: product.type || '',
    price: Number(product.price) || 0,
    compareAt: Number(product.compareAt || product.compare_at_price) || 0,
    tags: asTags(product.tags),
    available: product.available !== false,
    url: product.url || `/products/${product.handle}`,
    image: imageUrl(product.image),
    imageAlt: product.imageAlt || product.title || '',
    image2: imageUrl(product.image2),
    metal: product.metal || '',
    shape: product.shape || '',
    carat: product.carat || '',
    highJewelry: product.highJewelry === true,
    collections: product.collections || [],
  };
}

function moneyToCents(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Math.round(value);
  const cleaned = String(value).replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  if (cleaned.includes('.')) return Math.round(parseFloat(cleaned) * 100);
  return parseInt(cleaned, 10);
}

export function normalizeSuggest(product) {
  const image = imageUrl(product.featured_image) || imageUrl(product.image);
  return normalizePool({
    id: product.id,
    handle: product.handle,
    title: product.title,
    vendor: product.vendor,
    type: product.type,
    price: moneyToCents(product.price),
    compareAt: moneyToCents(product.compare_at_price_min || product.compare_at_price),
    tags: product.tags,
    available: product.available !== false,
    url: product.url,
    image,
    imageAlt: (product.featured_image && product.featured_image.alt) || product.title,
    image2: '',
    metal: '',
    shape: '',
    carat: '',
  });
}

export function normalizeProductJs(product) {
  const images = product.images || [];
  return normalizePool({
    id: product.id,
    handle: product.handle,
    title: product.title,
    vendor: product.vendor,
    type: product.type,
    price: Number(product.price) || 0,
    compareAt: Number(product.compare_at_price) || 0,
    tags: product.tags,
    available: product.available !== false,
    url: product.url,
    image: imageUrl(product.featured_image) || imageUrl(images[0]),
    imageAlt: product.title,
    image2: imageUrl(images[1]),
    metal: '',
    shape: '',
    carat: '',
  });
}

export async function gather(source, fetchImpl = globalThis.fetch) {
  const requests = candidateRequests(source);
  const groups = await Promise.all(requests.map(async (request) => {
    try {
      const response = await fetchImpl(request.url, {
        headers: { Accept: request.kind === 'suggest' ? 'application/json' : 'text/html' },
      });
      if (!response.ok) return [];
      if (request.kind === 'suggest') {
        const data = await response.json();
        return (data.resources?.results?.products || []).map(normalizeSuggest);
      }
      return parsePool(await response.text());
    } catch {
      return [];
    }
  }));
  return dedupe(groups.flat());
}

export function formatMoney(cents, format = '${{amount}}') {
  const amount = (Number(cents) || 0) / 100;
  const fixed = amount.toFixed(2);
  const [whole, fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const dot = `${grouped}.${fraction}`;
  const noDecimals = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const comma = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction}`;
  const commaNoDecimals = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const apostrophe = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, "'")}.${fraction}`;
  const space = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${fraction}`;
  const spaceDot = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${fraction}`;
  const spaceNoDecimals = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return String(format)
    .replace(/\{\{\s*amount_no_decimals_with_comma_separator\s*\}\}/g, commaNoDecimals)
    .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/g, comma)
    .replace(/\{\{\s*amount_with_apostrophe_separator\s*\}\}/g, apostrophe)
    .replace(/\{\{\s*amount_no_decimals_with_space_separator\s*\}\}/g, spaceNoDecimals)
    .replace(/\{\{\s*amount_with_space_separator\s*\}\}/g, space)
    .replace(/\{\{\s*amount_with_period_and_space_separator\s*\}\}/g, spaceDot)
    .replace(/\{\{\s*amount_no_decimals\s*\}\}/g, noDecimals)
    .replace(/\{\{\s*amount\s*\}\}/g, dot);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function safeUrl(value) {
  const url = String(value || '').trim();
  if (url.startsWith('/') || url.startsWith('https://') || url.startsWith('http://')) return url;
  return '';
}

function displayName(value) {
  return String(value || '')
    .replace(/Jacob & Company/g, 'Jacob & Co.')
    .replace(/Jacob and Company/g, 'Jacob & Co.');
}

function isLab(product) {
  if (String(product.vendor || '').toLowerCase() === 'peaceful diamonds') return true;
  const text = haystack(product);
  return /lab grown|lab-grown|lab created|lab-created/.test(text)
    || String(product.handle || '').startsWith('lg-')
    || String(product.handle || '').includes('lab-diamond');
}

export function renderCard(product, moneyFormat) {
  const title = displayName(product.title);
  const vendor = displayName(product.vendor);
  const href = safeUrl(product.url) || `/products/${encodeURIComponent(product.handle || '')}`;
  const image = safeUrl(product.image);
  const image2 = safeUrl(product.image2);
  const alt = product.imageAlt || title;
  const tags = (product.tags || []).map((tag) => String(tag).toLowerCase());
  let badge = '';
  if (tags.includes('new') || tags.includes('new-arrival')) {
    badge = '<span class="product-card__badge product-card__badge--new">New</span>';
  } else if (tags.includes('bestseller')) {
    badge = '<span class="product-card__badge product-card__badge--bestseller">Bestseller</span>';
  } else if (product.compareAt > product.price) {
    badge = '<span class="product-card__badge product-card__badge--sale">Sale</span>';
  }

  const hover = image2
    ? `<img class="product-card__image product-card__image--hover" src="${escapeHtml(image2)}" alt="${escapeHtml(alt)}" width="600" height="600" loading="lazy">`
    : '';
  const media = image
    ? `<img class="product-card__image product-card__image--primary" src="${escapeHtml(image)}" alt="${escapeHtml(alt)}" width="600" height="600" loading="lazy">${hover}`
    : '';
  const price = product.compareAt > product.price
    ? `<span class="product-card__price--sale">${escapeHtml(formatMoney(product.price, moneyFormat))}</span><s class="product-card__price--compare">${escapeHtml(formatMoney(product.compareAt, moneyFormat))}</s>`
    : `<span>${escapeHtml(formatMoney(product.price, moneyFormat))}</span>`;
  const lab = isLab(product) ? '<span class="lab-grown-tag">Lab Grown Diamond</span>' : '';
  const meta = vendor
    ? `<span class="product-card__vendor">${escapeHtml(vendor)}</span>`
    : (product.type ? `<span class="product-card__type">${escapeHtml(product.type)}</span>` : '');

  return `<div class="product-card">
  <a href="${escapeHtml(href)}" class="product-card__image-wrapper" aria-label="${escapeHtml(title)}">
    ${badge}
    ${media}
  </a>
  <div class="product-card__content">
    ${lab}
    <h3 class="product-card__title"><a href="${escapeHtml(href)}">${escapeHtml(title)}</a></h3>
    <div class="product-card__price">${price}</div>
    <div class="product-card__meta">${meta}</div>
  </div>
</div>`;
}

export function readRecent(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map((item) => item && item.handle).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function rememberView(source, storage) {
  if (!source || !source.handle || !storage) return;
  const handles = readRecent(storage).filter((handle) => handle !== source.handle);
  const next = [{ handle: source.handle }, ...handles.map((handle) => ({ handle }))].slice(0, RECENT_MAX);
  storage.setItem(RECENT_KEY, JSON.stringify(next));
}

function timeout(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(null), ms);
  });
}

async function fill(root, source) {
  const recent = readRecent(window.localStorage).filter((handle) => handle !== source.handle);
  let candidates = [];
  try {
    const result = await Promise.race([
      gather(source).then((rows) => ({ rows })),
      timeout(8000).then(() => ({ rows: null })),
    ]);
    candidates = result.rows || [];
  } catch {
    candidates = [];
  }

  let rows = recommend(source, candidates, recent);
  const short = rows.similar.length < (source.limit || 4) || rows.complement.length < (source.limit || 4);
  if (short && recent.length) {
    const have = new Set(candidates.map((item) => item.handle));
    const missing = recent.filter((handle) => !have.has(handle) && handle !== source.handle).slice(0, 2);
    const extras = await Promise.all(missing.map(async (handle) => {
      try {
        const response = await fetch(withRoot(source.root, `/products/${encodeURIComponent(handle)}.js`));
        if (!response.ok) return null;
        return normalizeProductJs(await response.json());
      } catch {
        return null;
      }
    }));
    candidates = dedupe(candidates.concat(extras.filter(Boolean)));
    rows = recommend(source, candidates, recent);
  }

  paint(root, source, rows);
}

function paint(root, source, rows) {
  const money = source.moneyFormat || '${{amount}}';
  for (const name of ['similar', 'complement']) {
    const grid = root.querySelector(`[data-lm-grid="${name}"]`);
    const row = root.querySelector(`[data-lm-row="${name}"]`);
    if (!grid || !row) continue;
    const items = rows[name] || [];
    if (!items.length) {
      row.hidden = true;
      grid.innerHTML = '';
      continue;
    }
    grid.innerHTML = items.map((item) => renderCard(item, money)).join('');
    row.hidden = false;
  }
  const any = rows.similar.length || rows.complement.length;
  root.classList.toggle('is-ready', Boolean(any));
  root.setAttribute('aria-busy', 'false');
}

export function boot(doc = globalThis.document) {
  if (!doc || !doc.querySelectorAll) return;
  doc.querySelectorAll('[data-lm-related]').forEach((root) => {
    if (root.dataset.lmBound) return;
    root.dataset.lmBound = '1';
    const node = root.querySelector('[data-lm-related-context]');
    if (!node) return;
    let source;
    try {
      source = JSON.parse(node.textContent || '');
    } catch {
      return;
    }
    try {
      rememberView(source, window.localStorage);
    } catch {
      /* private mode */
    }
    const start = () => {
      fill(root, source).catch(() => {
        root.setAttribute('aria-busy', 'false');
      });
    };
    if (!('IntersectionObserver' in window)) {
      start();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      start();
    }, { rootMargin: '600px 0px' });
    observer.observe(root);
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(document));
  else boot(document);
}
