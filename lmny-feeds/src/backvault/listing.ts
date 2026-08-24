/**
 * Estate jewelry listing builder — LMNY
 *
 * Pure transform: a scrubbed Back Vault item in, Shopify-ready listing
 * fields out. Matches the estate jewelry catalog (Cartier / VCA / Tiffany
 * pieces already on the store) plus the SEO length rules from
 * docs/watch-listing-schema.md.
 *
 * Title:      {Brand} {normalized remainder}
 *             Watches: Pre-Owned {Brand} {remainder}
 * Body:       "This {Brand} estate {type}… is offered by Laura Milman New York."
 *             + "Authenticated and hand-inspected by Laura Milman New York."
 *             Specs live in custom.* metafields, not in the HTML.
 * SEO title:  ≤ 60 chars, product identity + `| Estate Jewelry` or
 *             `| Pre-Owned Watch`; the theme supplies the store-name suffix.
 * SEO desc:   ≤ 160 chars, ends with "Authenticated by Laura Milman New York."
 */

import type { BackVaultItem, ExtractedSpecs } from './types.js';

export interface JewelryListing {
  title: string;
  descriptionHtml: string;
  seoTitle: string;
  seoDescription: string;
  productType: string;
  tags: string[];
}

const SEO_TITLE_MAX = 60;
const SEO_DESC_MAX = 160;

/** Supplier product_type codes and English variants → Shopify product type. */
const PRODUCT_TYPE_MAP: Record<string, string> = {
  RING: 'Rings',
  FSLTR: 'Rings',
  BAND: 'Rings',
  WB: 'Rings',
  BRACL: 'Bracelets',
  BANGL: 'Bracelets',
  TNSBR: 'Bracelets',
  NECKL: 'Necklaces',
  DYARD: 'Necklaces',
  RIVRA: 'Necklaces',
  EARRG: 'Earrings',
  BROCH: 'Brooches',
  CLIP: 'Brooches',
  PENDT: 'Pendants',
  CUFFL: 'Cufflinks',
  WATCH: 'Watch',
  SET: 'Jewelry',
  THREE: 'Jewelry',
  JWLRY: 'Jewelry',
  DBLCL: 'Jewelry',
};

const PRESERVE_UPPER = new Set([
  'GIA',
  'AGS',
  'IGI',
  'HRD',
  'CTW',
  'CTTW',
  'CTS',
  'CT',
  'MM',
  'VS',
  'VVS',
  'SI',
  'IF',
  'FL',
  'II',
  'III',
  'XL',
]);

export function canonicalProductType(raw: string | undefined | null): string {
  if (!raw || !raw.trim()) return 'Jewelry';
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
  if (PRODUCT_TYPE_MAP[code]) return PRODUCT_TYPE_MAP[code];
  const folded = raw.trim().toLowerCase();
  if (/\bcuff\s*links?\b/.test(folded) || folded === 'cufflinks') return 'Cufflinks';
  if (/\bearrings?\b|\bearclips?\b/.test(folded)) return 'Earrings';
  if (/\bbrooches?\b|\bbrooch\b|\bpin\b/.test(folded)) return 'Brooches';
  if (/\bpendants?\b/.test(folded)) return 'Pendants';
  if (/\bnecklaces?\b|\bchoker\b/.test(folded)) return 'Necklaces';
  if (/\bbracelets?\b|\bbangles?\b|\bcuff\b|\btennis\b/.test(folded)) return 'Bracelets';
  if (/\bwatches?\b|\btimepiece\b/.test(folded)) return 'Watch';
  if (/\brings?\b|\bband\b/.test(folded)) return 'Rings';
  return titleCaseJewelry(raw.trim()) || 'Jewelry';
}

export function buildJewelryListing(item: BackVaultItem): JewelryListing {
  const brand = item.vendor.trim();
  const productType = canonicalProductType(item.productType);
  const isWatch = productType === 'Watch';
  const remainder = titleCaseJewelry(stripLeadingBrand(stripStockSuffix(item.title), brand));
  const title = isWatch
    ? `Pre-Owned ${brand}${remainder ? ` ${remainder}` : ''}`.trim()
    : `${brand}${remainder ? ` ` : ''}${remainder}`.trim();

  const descriptionHtml = buildDescription(brand, productType, isWatch, remainder, item.specs);
  const seoTitle = buildSeoTitle(title, isWatch);
  const seoDescription = buildSeoDescription(brand, productType, isWatch, item.specs);

  const tags = [
    brand,
    productType,
    'antique-estate',
    'designer-jewelry',
  ];
  if (isWatch) tags.push('Pre-Owned Watches', 'Watches');
  if (item.specs.era) tags.push(titleCaseJewelry(item.specs.era));
  const typeTag = productType.toLowerCase();
  if (typeTag) tags.push(typeTag);

  return {
    title,
    descriptionHtml,
    seoTitle,
    seoDescription,
    productType,
    tags: [...new Set(tags.map((t) => t.trim()).filter(Boolean))],
  };
}

function buildDescription(
  brand: string,
  productType: string,
  isWatch: boolean,
  remainder: string,
  specs: ExtractedSpecs,
): string {
  const noun = proseNoun(productType);
  const eraClause = eraClausePlain(specs.era);
  const metalClause = specs.metalType ? ` in ${titleCaseJewelry(specs.metalType)}` : '';
  const stoneClause = stonePhrase(specs);
  const conditionClause = conditionPhrase(specs.condition);

  let opening: string;
  if (isWatch) {
    const rest = remainder ? ` ${remainder}` : '';
    opening =
      `This Pre-Owned ${brand}${rest}${eraClause}${metalClause}` +
      ` is offered by Laura Milman New York.${conditionClause}`;
  } else {
    opening =
      `This ${brand} estate ${noun}${eraClause}${metalClause}${stoneClause}` +
      ` is offered by Laura Milman New York.${conditionClause}`;
  }

  return `<p>${escapeHtml(opening)}</p><p>Authenticated and hand-inspected by Laura Milman New York.</p>`;
}

function buildSeoTitle(title: string, isWatch: boolean): string {
  const lead = isWatch ? title.replace(/^Pre-Owned\s+/i, '') : title;
  const suffix = isWatch ? '| Pre-Owned Watch' : '| Estate Jewelry';
  const available = SEO_TITLE_MAX - suffix.length - 1;
  return `${truncateAtWord(lead, available)} ${suffix}`.trim();
}

function buildSeoDescription(
  brand: string,
  productType: string,
  isWatch: boolean,
  specs: ExtractedSpecs,
): string {
  const noun = proseNoun(productType);
  const metal = specs.metalType ? ` in ${titleCaseJewelry(specs.metalType)}` : '';
  const era = eraClausePlain(specs.era);
  const grade = conditionGrade(specs.condition);
  const gradeSuffix = grade ? `, ${grade.toLowerCase()} condition` : '';
  const lead = isWatch
    ? `Shop this pre-owned ${brand} ${productType.toLowerCase()}${metal}${era}${gradeSuffix}.`
    : `Shop this ${brand} estate ${noun}${metal}${era}${gradeSuffix}.`;
  const full = `${lead} Authenticated by Laura Milman New York.`;
  return truncateAtWord(full, SEO_DESC_MAX);
}

/** "ring", "pair of earrings" — grammar for the "This {brand} estate {noun}" sentence. */
function proseNoun(productType: string): string {
  switch (productType) {
    case 'Earrings':
      return 'pair of earrings';
    case 'Cufflinks':
      return 'pair of cufflinks';
    case 'Watch':
      return 'watch';
    case 'Jewelry':
      return 'piece';
    default:
      return productType.replace(/s$/i, '').toLowerCase();
  }
}

function eraClausePlain(era: string | undefined): string {
  if (!era) return '';
  const pretty = titleCaseJewelry(era);
  if (/^\d{4}s?$/.test(pretty) || /^c/i.test(pretty) || /^\d{4}/.test(pretty)) {
    return ` from ${pretty}`;
  }
  if (/^(vintage|antique|contemporary|modern|retro)$/i.test(pretty)) {
    return ''; // these read better as title words than "from the Vintage period"
  }
  return ` from the ${pretty} period`;
}

function stonePhrase(specs: ExtractedSpecs): string {
  const parts: string[] = [];
  if (specs.diamondWeight) parts.push(`${specs.diamondWeight} of diamonds`);
  if (specs.gemstones) parts.push(specs.gemstones.toLowerCase());
  if (parts.length === 0) return '';
  if (parts.length === 1) return ` with ${parts[0]}`;
  return ` with ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function conditionPhrase(raw: string | undefined): string {
  const grade = conditionGrade(raw);
  return grade ? ` It is in ${grade.toLowerCase()} condition.` : '';
}

/** Pull a known grade word out of free-text condition; never invent one. */
export function conditionGrade(raw: string | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (/\bexcellent\b/.test(key)) return 'Excellent';
  if (/\bmint\b/.test(key)) return 'Mint';
  if (/\bvery\s+good\b/.test(key)) return 'Very Good';
  if (/\bgood\b/.test(key)) return 'Good';
  if (/\bfair\b/.test(key)) return 'Fair';
  return null;
}

export function conditionMetafield(raw: string | undefined): string {
  const grade = conditionGrade(raw);
  if (grade) return `${grade} pre-owned condition; signed and authenticated`;
  return 'Pre-owned; authenticated by Laura Milman New York';
}

function stripStockSuffix(title: string): string {
  return title.replace(/\s+J\d{4,}\s*$/i, '').trim();
}

function stripLeadingBrand(title: string, brand: string): string {
  const variants = brandVariants(brand);
  let rest = title.trim();
  for (const variant of variants) {
    const re = new RegExp(`^${escapeRegex(variant)}\\s*[:\\-–—]?\\s*`, 'i');
    if (re.test(rest)) {
      rest = rest.replace(re, '').trim();
      break;
    }
  }
  return rest;
}

function brandVariants(brand: string): string[] {
  const variants = [
    brand,
    brand.replace(/&/g, 'and'),
    brand.replace(/Hermès/g, 'Hermes'),
    brand.replace(/Fabergé/g, 'Faberge'),
    brand.replace(/Bvlgari/g, 'Bulgari'),
    brand.replace(/^Ilias\s+/i, ''),
    brand.replace(/\s+&\s+Co\.?$/i, ''),
    brand.replace(/\s+and\s+Co\.?$/i, ''),
  ];
  return [...new Set(variants.map((v) => v.trim()).filter(Boolean))];
}

function titleCaseJewelry(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => titleCaseWord(word))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseWord(word: string): string {
  if (/^\d{1,2}k(?:t)?$/i.test(word)) {
    return word.toUpperCase().replace(/KT$/i, 'KT').replace(/K$/i, 'K');
  }
  const stripped = word.replace(/[.,]/g, '');
  if (PRESERVE_UPPER.has(stripped.toUpperCase())) {
    return word.length === stripped.length ? stripped.toUpperCase() : word;
  }
  return word
    .split('-')
    .map((piece) => {
      if (!piece) return piece;
      if (/^\d{1,2}k(?:t)?$/i.test(piece)) return piece.toUpperCase();
      return piece[0]!.toUpperCase() + piece.slice(1).toLowerCase();
    })
    .join('-');
}

function truncateAtWord(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
