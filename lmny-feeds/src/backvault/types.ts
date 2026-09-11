/** A single variant row from The Back Vault's public Shopify products.json. */
export interface RawVariant {
  id: number;
  title: string;
  price: string;
  available: boolean;
  sku?: string;
}

export interface RawImage {
  src: string;
  alt?: string | null;
}

/** Shape of one entry in Shopify's public /products.json (and /collections/<handle>/products.json). */
export interface RawBackVaultProduct {
  id: number;
  handle: string;
  title: string;
  body_html?: string;
  vendor: string;
  product_type?: string;
  tags: string | string[];
  variants: RawVariant[];
  images: RawImage[];
  updated_at?: string;
}

/** Best-effort specs pulled out of the supplier's free-text description. */
export interface ExtractedSpecs {
  metalType?: string;
  metalWeight?: string;
  diamondWeight?: string;
  measurements?: string;
  gemstones?: string;
  era?: string;
  condition?: string;
}

/** A Back Vault item that passed the top-designer + in-stock filter, scrubbed and ready to price. */
export interface BackVaultItem {
  /** The Back Vault's own product handle — the idempotency key (bv-<handle>). */
  sourceHandle: string;
  title: string;
  vendorRaw: string;
  /** Canonical designer name (matches an automated collection's Vendor condition). */
  vendor: string;
  productType: string;
  descriptionHtml: string;
  /** The supplier's listed price — LMNY's cost. Written to Shopify Cost per item. */
  costUsd: number;
  /**
   * Competitor's price for the same stock number: read from the competitor
   * feed this run, or remembered from the last run that did match it
   * (src/backvault/competitor.ts, src/backvault/diff.ts).
   */
  competitorPriceUsd?: number;
  /**
   * When `competitorPriceUsd` was actually READ from the competitor, ISO
   * 8601. Stamped fresh on a real match and carried through unchanged when the
   * price comes from memory, so the 90-day expiry measures the age of the
   * comparison and not the age of the last sync. Deliberately not part of the
   * content hash: a date that moved every week would rewrite every matched
   * piece every week.
   */
  competitorPriceReadAt?: string;
  /** Retail on the store: midpoint with the competitor, else cost + BACKVAULT.markupUsd. */
  priceUsd: number;
  available: boolean;
  sku?: string;
  imageUrls: string[];
  specs: ExtractedSpecs;
}
