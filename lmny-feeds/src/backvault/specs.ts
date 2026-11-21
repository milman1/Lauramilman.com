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

// "ct" and "carat" can describe gold fineness as well as gemstone weight.
const GOLD_FINENESS_PATTERN =
  /(?<![\w.])(?:[1-9]|1\d|2[0-4])\s*-?\s*(?:cts?|carats?)\b\.?[\s-]*(?:(?:yellow|white|rose|pink|green|solid|tri[\s-]?color|two[\s-]?tone|three[\s-]?tone)[\s,\/-]+(?:and[\s-]+)?)*gold\b/gi;

const DIAMOND_WEIGHT_PATTERN = /(?<![\w.+-])(\d+(?:\.\d+)?|\.\d+)\s*(?:cttw|ctw|cts|ct|carats?)\b/gi;
const DIAMONDS_BEFORE_WEIGHT =
  /\b(?:diamonds?|(?:total\s+)?diamond\s+weight)\s*(?:weigh(?:s|ing)?|total(?:s|l?ing)?|of)?\s*[:=]?\s*(?:approx(?:imately)?\.?\s*)?$/i;
const DIAMONDS_AFTER_WEIGHT =
  /^\s*(?:of\s+)?(?:(?:round|brilliant|cut|pav[eé][\s-]?set|baguette|natural|old|european|cushion|oval|marquise|emerald|pear|white|accent|side|lab[\s-]?grown)[\s-]+)*diamonds?\b/i;

function findDiamondWeight(text: string, requireDiamondContext: boolean): string | undefined {
  // Mask rather than delete, so two unrelated phrases cannot become adjacent.
  const withoutFineness = text.replace(GOLD_FINENESS_PATTERN, (metal) => ' '.repeat(metal.length));
  for (const match of withoutFineness.matchAll(DIAMOND_WEIGHT_PATTERN)) {
    const amount = match[1]!;
    if (!(Number(amount) > 0)) continue;
    if (requireDiamondContext) {
      const before = text.slice(0, match.index);
      const after = text.slice(match.index + match[0].length);
      if (!DIAMONDS_BEFORE_WEIGHT.test(before) && !DIAMONDS_AFTER_WEIGHT.test(after)) continue;
    }
    return `${amount}ct`;
  }
  return undefined;
}

const MEASUREMENTS_PATTERN = /\b(\d+(?:\.\d+)?\s?(?:x|×)\s?\d+(?:\.\d+)?(?:\s?(?:x|×)\s?\d+(?:\.\d+)?)?\s?mm)\b|\b(\d+(?:\.\d+)?\s?(?:inches|in\.|"))\b|\bsize\s+(\d+(?:\.\d+)?)\b/i;

// Supplier prose sometimes misspells "wrist". Keep the fit qualifier so a
// bracelet circumference is not displayed as an unlabeled dimension.
const WRIST_SIZE_PATTERN = /\b(?:wrist|writs)\s+size\s*:?\s*(\d+(?:\.\d+)?\s*(?:inches|inch|in\.|"))/i;

// "Length 7 inches", "Length: 16.5 in." in the supplier's prose paragraph.
const LENGTH_PATTERN = /\blength\s*:?\s*(\d+(?:\.\d+)?)\s*(?:inches|inch|in\.|")/i;

/** Longest supplier note printed on a product page. */
const NOTE_MAX = 300;

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
  const { specs: labeled, zeroCenterWeight, zeroDiamondWeight } = parseLabeledSpecs(bodyHtml ?? '');
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

  if (!specs.diamondWeight && !zeroDiamondWeight) {
    // A zero center stone can coexist with pavé or side diamonds. Require
    // actual diamond context before replacing that explicit zero.
    const diamondWeight = findDiamondWeight(text, zeroCenterWeight);
    if (diamondWeight) specs.diamondWeight = diamondWeight;
  }

  if (!specs.measurements) {
    const wristSize = text.match(WRIST_SIZE_PATTERN);
    if (wristSize) {
      specs.measurements = `Wrist size ${wristSize[1]!.trim()}`;
    } else {
      const measurements = text.match(MEASUREMENTS_PATTERN);
      if (measurements) specs.measurements = (measurements[1] ?? measurements[2] ?? measurements[3])?.trim();
    }
  }

  if (!specs.length) {
    const length = toPlainText(bodyHtml ?? '').match(LENGTH_PATTERN);
    if (length) specs.length = `${length[1]} inches`;
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
function parseLabeledSpecs(html: string): {
  specs: ExtractedSpecs;
  zeroCenterWeight: boolean;
  zeroDiamondWeight: boolean;
} {
  const specs: ExtractedSpecs = {};
  let zeroCenterWeight = false;
  let zeroDiamondWeight = false;
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
      const weight = value.replace(GOLD_FINENESS_PATTERN, '').trim();
      const amount = parseFloat(weight);
      if (Number.isFinite(amount) && amount > 0) {
        specs.diamondWeight = /ct|carat/i.test(weight) ? weight : `${trimTrailingZeros(amount)}ct`;
      } else if (amount === 0) {
        if (label.includes('center diamond')) zeroCenterWeight = true;
        else zeroDiamondWeight = true;
      }
    } else if (label.includes('measurement')) {
      specs.measurements = value;
    } else if (label === 'condition' || label.startsWith('condition')) {
      specs.condition = value.split(/[.;]/)[0]!.trim();
      // More than a bare grade: keep the whole line so a disclosed flaw
      // reaches the shopper. Over-long notes are left out rather than cut
      // mid-sentence.
      const note = value.replace(/\s*\.$/, '').trim();
      if (note.split(/\s+/).length > 3 && note.length <= NOTE_MAX) specs.conditionNote = note;
    } else if (label === 'signed' || label === 'signature' || label === 'hallmarks') {
      if (value.length <= NOTE_MAX) specs.signed = value;
    }
  }
  return { specs, zeroCenterWeight, zeroDiamondWeight };
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
