/**
 * The Back Vault → Shopify sync: curated "top designers" list.
 *
 * Source of truth for the brand/collection-handle pairing is
 * SHOPIFY_SETUP.md §2c ("Brand → collection handle map") — these 38 brands
 * already have automated collections and storefront dropdown entries wired
 * up in sections/estate-designers.liquid. Only items whose vendor matches
 * one of these (case/punctuation-insensitive) are pulled from The Back
 * Vault's new-arrivals feed; everything else is left out of the sync
 * entirely, never fetched into a draft, never touched.
 *
 * Keep this list and SHOPIFY_SETUP.md §2c in sync by hand — adding a brand
 * here without also creating its automated collection (§2b) means the new
 * products import but never land in a merchandised collection.
 */
export interface Designer {
  /** Exact Vendor value to write on the Shopify product. Must match the
   *  automated collection's "Product vendor is equal to" condition exactly. */
  name: string;
  /** Collection handle wired up in sections/estate-designers.liquid. */
  handle: string;
}

export const TOP_DESIGNERS: Designer[] = [
  { name: 'Adler', handle: 'adler' },
  { name: 'Aldo Cipullo', handle: 'aldo-cipullo' },
  { name: 'Aletto Brothers', handle: 'aletto-brothers' },
  { name: 'Angela Cummings', handle: 'angela-cummings' },
  { name: 'Asch Grossbardt', handle: 'asch-grossbardt' },
  { name: 'Asprey', handle: 'asprey' },
  { name: 'Audemars Piguet', handle: 'audemars-piguet' },
  { name: 'Bailey Banks & Biddle', handle: 'bailey-banks-biddle' },
  { name: 'Bert H. Satz', handle: 'bert-h-satz' },
  { name: 'Boucheron', handle: 'boucheron' },
  { name: 'Buccellati', handle: 'buccellati' },
  { name: 'Bvlgari', handle: 'bvlgari' },
  { name: 'Carrera Y Carrera', handle: 'carrera-y-carrera' },
  { name: 'Cartier', handle: 'cartier' },
  { name: 'Carvin French', handle: 'carvin-french' },
  { name: 'Chanel', handle: 'chanel' },
  { name: 'Charles Krypell', handle: 'charles-krypell' },
  { name: 'Chaumet', handle: 'chaumet' },
  { name: 'Chopard', handle: 'chopard' },
  { name: 'Christian Dior', handle: 'christian-dior' },
  { name: 'Craiger Drake', handle: 'craiger-drake' },
  { name: 'David Webb', handle: 'david-webb' },
  { name: 'De Grisogono', handle: 'de-grisogono' },
  { name: 'Demner', handle: 'demner' },
  { name: 'Di Modolo', handle: 'di-modolo' },
  { name: 'Dinh Van', handle: 'dinh-van' },
  { name: 'Dominique Paris', handle: 'dominique-paris' },
  { name: 'Fabergé', handle: 'faberge' },
  { name: 'Franck Muller', handle: 'franck-muller' },
  { name: 'Fred', handle: 'fred' },
  { name: 'Graff', handle: 'graff' },
  { name: 'Harry Winston', handle: 'harry-winston' },
  { name: 'Hermès', handle: 'hermes' },
  { name: 'Ilias Lalaounis', handle: 'ilias-lalaounis' },
  { name: 'Jean Schlumberger', handle: 'jean-schlumberger' },
  { name: 'Marina B', handle: 'marina-b' },
  { name: 'Mikimoto', handle: 'mikimoto' },
  { name: 'Patek Philippe', handle: 'patek-philippe' },
  { name: 'Tiffany & Co.', handle: 'tiffany-co' },
  { name: 'Van Cleef & Arpels', handle: 'van-cleef-arpels' },
];

/** Lowercase, accent-stripped, punctuation-collapsed — for fuzzy vendor matching. */
function foldName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents (é → e)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const FOLDED_INDEX = new Map(TOP_DESIGNERS.map((d) => [foldName(d.name), d]));

/** Short / misspelled vendor strings seen on The Back Vault that still map to a curated house. */
const VENDOR_ALIASES: Array<[alias: string, canonicalName: string]> = [
  ['Lalaounis', 'Ilias Lalaounis'],
  ['Aspery', 'Asprey'],
  ['Bulgari', 'Bvlgari'],
];
for (const [alias, canonicalName] of VENDOR_ALIASES) {
  const designer = TOP_DESIGNERS.find((d) => d.name === canonicalName);
  if (designer) FOLDED_INDEX.set(foldName(alias), designer);
}

/**
 * Match a raw vendor string from The Back Vault's feed against the curated
 * list, tolerant of accent/punctuation/ampersand differences (e.g.
 * "Van Cleef and Arpels", "Tiffany and Co", "Bailey, Banks & Biddle").
 * Returns the canonical Designer (with the exact Vendor name our
 * automated collections expect) or null if the brand isn't on the list.
 */
export function matchDesigner(rawVendor: string | undefined | null): Designer | null {
  if (!rawVendor) return null;
  const folded = foldName(rawVendor);
  const exact = FOLDED_INDEX.get(folded);
  if (exact) return exact;
  // Tolerate trailing punctuation-only differences, e.g. "Bailey Banks Biddle Inc".
  for (const [key, designer] of FOLDED_INDEX) {
    if (folded === key || folded.startsWith(`${key} `) || key.startsWith(`${folded} `)) {
      return designer;
    }
  }
  return null;
}
