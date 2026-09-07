/**
 * Sales-channel and Journal merchandising helpers.
 * Pure matchers live here so GitHub Actions can report what's connected
 * (Shop, Google & YouTube) without inventing a channel the merchant never installed.
 */

export interface PublicationRef {
  id: string;
  name: string;
}

export function pickSalesPublications(nodes: PublicationRef[]): {
  onlineStore: PublicationRef | undefined;
  shop: PublicationRef | undefined;
  google: PublicationRef | undefined;
  others: PublicationRef[];
} {
  const lower = (n: string) => n.toLowerCase();
  const onlineStore = nodes.find((p) => lower(p.name) === 'online store');
  const shop = nodes.find((p) => lower(p.name) === 'shop' || lower(p.name).includes('shop channel'));
  const google = nodes.find(
    (p) => lower(p.name).includes('google') || lower(p.name).includes('youtube'),
  );
  const used = new Set([onlineStore?.id, shop?.id, google?.id].filter(Boolean));
  return {
    onlineStore,
    shop,
    google,
    others: nodes.filter((p) => !used.has(p.id)),
  };
}

export const JOURNAL_PAGES: Array<{
  handle: string;
  title: string;
  templateSuffix: string;
}> = [
  {
    handle: 'best-bars-nyc',
    title: 'Best After-Work Bars in New York',
    templateSuffix: 'best-bars-nyc',
  },
  {
    handle: 'power-dressing-nyc',
    title: 'Power Dressing Jewelry for New York',
    templateSuffix: 'power-dressing-nyc',
  },
  {
    handle: 'hotel-bars-nyc',
    title: 'The Hotel Bar Edit',
    templateSuffix: 'hotel-bars-nyc',
  },
];

export const NEWS_REDIRECTS: Array<{ path: string; target: string }> = [
  {
    path: '/blogs/news/how-to-buy-pre-owned-cartier-van-cleef-tiffany',
    target: '/blogs/journal/how-to-buy-pre-owned-cartier-van-cleef-tiffany',
  },
];

/**
 * Collections whose products should be on Shop + Google when those channels exist.
 * Pre-Owned Maison shoppers land on `estate-jewelry` (the live vault), not the
 * thinner curated `vintage-jewelry` collection.
 */
export const SHOPPING_COLLECTION_HANDLES = [
  'estate-jewelry',
  'vintage-jewelry',
  'cartier',
  'van-cleef-arpels',
  'bvlgari',
  'tiffany',
  'jacob-co',
  'rolex-watches',
  'time-pieces',
];

/** Journal articles that must stay published on the Online Store. */
export const EXPECTED_JOURNAL_HANDLES = [
  'how-to-buy-a-vintage-luxury-watch',
  'how-to-wear-vintage-jewelry-in-2026',
  'how-to-buy-pre-owned-cartier-van-cleef-tiffany',
  'what-jewelry-to-wear-on-a-first-date',
  'igi-vs-gia-certified-lab-diamonds',
  'how-to-stack-diamond-jewelry-without-looking-overdone',
  'best-lab-grown-diamond-engagement-rings-under-3000',
  'best-jewelry-for-a-night-out-nyc',
  'are-lab-grown-diamonds-real-diamonds',
];
