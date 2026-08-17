import type { ExtractedSpecs } from './types.js';

/**
 * Best-effort spec extraction from The Back Vault's free-text product
 * description. Their products.json has no structured metafields for these
 * (public Shopify JSON never exposes metafields), so this is pattern
 * matching over body_html/title — not a guaranteed-correct parse.
 *
 * Unmatched fields are left undefined rather than guessed, so a product
 * with prose the patterns don't recognize just ships with fewer filled-in
 * specs instead of a wrong one. Spot-check `out/report.md` after the first
 * few live runs and tighten these patterns against what the real supplier
 * copy actually looks like — this was written without access to a live
 * page to test against (see feed.ts).
 */

const METAL_PATTERN = /\b(1[0-9]|2[0-4])\s?k(?:t)?\.?\s*(yellow|white|rose|pink)?\s*gold\b|\bplatinum\b|\bsterling\s+silver\b|\bpalladium\b/i;

const METAL_WEIGHT_PATTERN = /\b(\d+(?:\.\d+)?)\s*(grams?|g|dwt)\b/i;

const DIAMOND_WEIGHT_PATTERN = /\b(\d+(?:\.\d+)?)\s*ct(?:w|tw)?\b(?!\s*gold)/i;

const MEASUREMENTS_PATTERN = /\b(\d+(?:\.\d+)?\s?(?:x|×)\s?\d+(?:\.\d+)?(?:\s?(?:x|×)\s?\d+(?:\.\d+)?)?\s?mm)\b|\b(\d+(?:\.\d+)?\s?(?:inches|in\.|"))\b|\bsize\s+(\d+(?:\.\d+)?)\b/i;

const ERA_PATTERN =
  /\b(art\s*deco|art\s*nouveau|victorian|edwardian|georgian|retro|mid[\s-]?century|belle\s*epoque|vintage|antique|contemporary|modern)\b|\bc(?:irca)?\.?\s*(19\d{2}|20\d{2})s?\b/i;

const CONDITION_PATTERN =
  /\b(pre[\s-]?owned|excellent(?:\s+condition)?|very\s+good(?:\s+condition)?|good(?:\s+condition)?|mint(?:\s+condition)?|new(?:\s+with\s+tags)?|estate\s+condition)\b/i;

const GEMSTONES: string[] = [
  'emerald',
  'sapphire',
  'ruby',
  'aquamarine',
  'amethyst',
  'topaz',
  'opal',
  'garnet',
  'peridot',
  'citrine',
  'tanzanite',
  'tourmaline',
  'turquoise',
  'coral',
  'jade',
  'onyx',
  'lapis',
  'pearl',
  'moonstone',
  'spinel',
  'morganite',
  'alexandrite',
  'chrysoprase',
];
const GEMSTONE_PATTERN = new RegExp(`\\b(${GEMSTONES.join('|')})s?\\b`, 'gi');

/** Strip HTML tags to plain text before running the patterns over it. */
function toPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractSpecs(title: string, bodyHtml: string | undefined): ExtractedSpecs {
  const text = `${title} ${toPlainText(bodyHtml ?? '')}`;
  const specs: ExtractedSpecs = {};

  const metal = text.match(METAL_PATTERN);
  if (metal) specs.metalType = metal[0].replace(/\s+/g, ' ').trim();

  const metalWeight = text.match(METAL_WEIGHT_PATTERN);
  if (metalWeight) specs.metalWeight = `${metalWeight[1]}g`;

  const diamondWeight = text.match(DIAMOND_WEIGHT_PATTERN);
  if (diamondWeight) specs.diamondWeight = `${diamondWeight[1]}ct`;

  const measurements = text.match(MEASUREMENTS_PATTERN);
  if (measurements) specs.measurements = (measurements[1] ?? measurements[2] ?? measurements[3])?.trim();

  const era = text.match(ERA_PATTERN);
  if (era) specs.era = era[0].trim();

  const condition = text.match(CONDITION_PATTERN);
  if (condition) specs.condition = condition[0].trim();

  const gemstoneHits = [...text.matchAll(GEMSTONE_PATTERN)].map((m) => m[1]!.toLowerCase());
  if (gemstoneHits.length > 0) {
    const unique = [...new Set(gemstoneHits)].map((g) => g[0]!.toUpperCase() + g.slice(1));
    specs.gemstones = unique.join(', ');
  }

  return specs;
}
