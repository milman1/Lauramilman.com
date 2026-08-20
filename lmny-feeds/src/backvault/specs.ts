import type { ExtractedSpecs } from './types.js';

/**
 * Best-effort spec extraction from The Back Vault's product copy.
 *
 * Prefer the labeled `<strong>Metal Type:</strong> …` block most of their
 * PDPs append (Center Diamond Weight, Metal Type, Metal Weight, Measurements,
 * Condition). Fall back to regex over title + stripped HTML when a label is
 * missing. Unmatched fields stay undefined rather than guessed.
 */

const METAL_PATTERN = /\b(1[0-9]|2[0-4])\s?k(?:t)?\.?\s*(yellow|white|rose|pink|two[\s-]?tone)?\s*gold\b|\bplatinum\b|\bsterling\s+silver\b|\bpalladium\b/i;

const METAL_WEIGHT_PATTERN = /\b(\d+(?:\.\d+)?)\s*(grams?|gr\.?|g|dwt)\b/i;

const DIAMOND_WEIGHT_PATTERN = /\b(\d+(?:\.\d+)?)\s*(?:cttw|ctw|cts|ct|carats?)\b(?!\s*gold)/i;

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
  const labeled = parseLabeledSpecs(bodyHtml ?? '');
  const text = `${title} ${toPlainText(bodyHtml ?? '')}`;
  const specs: ExtractedSpecs = { ...labeled };

  if (!specs.metalType) {
    const metal = text.match(METAL_PATTERN);
    if (metal) specs.metalType = metal[0].replace(/\s+/g, ' ').trim();
  }

  if (!specs.metalWeight) {
    const metalWeight = text.match(METAL_WEIGHT_PATTERN);
    if (metalWeight) specs.metalWeight = `${metalWeight[1]}g`;
  }

  if (!specs.diamondWeight) {
    const diamondWeight = text.match(DIAMOND_WEIGHT_PATTERN);
    if (diamondWeight && Number(diamondWeight[1]) > 0) {
      specs.diamondWeight = `${diamondWeight[1]}ct`;
    }
  }

  if (!specs.measurements) {
    const measurements = text.match(MEASUREMENTS_PATTERN);
    if (measurements) specs.measurements = (measurements[1] ?? measurements[2] ?? measurements[3])?.trim();
  }

  if (!specs.era) {
    const era = text.match(ERA_PATTERN);
    if (era) specs.era = titleCaseEra(era[0].trim());
  } else {
    specs.era = titleCaseEra(specs.era);
  }

  if (!specs.condition) {
    const condition = text.match(CONDITION_PATTERN);
    if (condition) specs.condition = condition[0].trim();
  }

  if (!specs.gemstones) {
    const gemstoneHits = [...text.matchAll(GEMSTONE_PATTERN)].map((m) => m[1]!.toLowerCase());
    if (gemstoneHits.length > 0) {
      const unique = [...new Set(gemstoneHits)].map((g) => g[0]!.toUpperCase() + g.slice(1));
      specs.gemstones = unique.join(', ');
    }
  }

  return specs;
}

/** Pull the `<strong>Label:</strong> value` block The Back Vault appends to most PDPs. */
function parseLabeledSpecs(html: string): ExtractedSpecs {
  const specs: ExtractedSpecs = {};
  const re = /<strong>\s*([^:<]+):?\s*<\/strong>\s*([^<]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const label = match[1]!.trim().toLowerCase();
    const value = decodeEntities(match[2]!.replace(/\s+/g, ' ').trim());
    if (!value) continue;
    if (label.includes('metal type')) {
      specs.metalType = value;
    } else if (label.includes('metal weight')) {
      specs.metalWeight = normalizeWeight(value);
    } else if (label.includes('diamond weight') || label.includes('center diamond')) {
      const amount = parseFloat(value);
      if (Number.isFinite(amount) && amount > 0) {
        specs.diamondWeight = /ct|carat/i.test(value) ? value : `${trimTrailingZeros(amount)}ct`;
      }
    } else if (label.includes('measurement')) {
      specs.measurements = value;
    } else if (label === 'condition' || label.startsWith('condition')) {
      specs.condition = value.split(/[.;]/)[0]!.trim();
    }
  }
  return specs;
}

function normalizeWeight(value: string): string {
  const m = value.match(/(\d+(?:\.\d+)?)/);
  return m ? `${m[1]}g` : value;
}

function trimTrailingZeros(n: number): string {
  return String(n);
}

function titleCaseEra(era: string): string {
  return era
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.toLowerCase() === 'deco' || w.toLowerCase() === 'nouveau' || w.toLowerCase() === 'epoque'
      ? w[0]!.toUpperCase() + w.slice(1).toLowerCase()
      : w[0]!.toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
