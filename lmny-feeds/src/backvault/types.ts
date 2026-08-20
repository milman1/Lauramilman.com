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
  priceUsd: number;
  available: boolean;
  sku?: string;
  imageUrls: string[];
  specs: ExtractedSpecs;
}
