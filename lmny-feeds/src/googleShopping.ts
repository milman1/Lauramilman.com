/**
 * Google & YouTube reads `mm-google-shopping` on the product.
 * productSet replaces the metafield list, so every feed that rewrites a
 * product must send these keys again or the channel attributes disappear.
 *
 * Loose diamonds are not included. They are not published to Google.
 */

export const GOOGLE_SHOPPING_NAMESPACE = 'mm-google-shopping';

export interface GoogleShoppingMetafield {
  namespace: string;
  key: string;
  type: string;
  value: string;
}

export type GoogleGender = 'male' | 'female' | 'unisex';

/**
 * Jewelry without a men's or watch signal is for the store's customer.
 * Watches stay unisex unless the title states a gender. Cufflinks and
 * men's titles are male. A title that states both stays unisex.
 */
export function googleGender(title: string, productType: string): GoogleGender {
  const text = `${title} ${productType}`.toLowerCase();
  const male = /\bmen'?s\b|\bfor him\b|\bcuff\s*links?\b|\bcufflinks\b/.test(text);
  const female = /\bwomen'?s?\b|\bladies\b|\blady\b|\bfor her\b/.test(text);
  if (male && female) return 'unisex';
  if (male) return 'male';
  if (female) return 'female';
  if (/\bwatch(?:es)?\b/.test(productType.toLowerCase())) return 'unisex';
  return 'female';
}

/** One metal color and one material, or neither. Mixed metals are left blank. */
export function metalAppearance(metal: string | null | undefined): { color?: string; material?: string } {
  if (!metal) return {};
  const text = metal.toLowerCase();
  const colors: string[] = [];
  if (/yellow gold/.test(text)) colors.push('Yellow Gold');
  if (/white gold/.test(text)) colors.push('White Gold');
  if (/rose gold|pink gold/.test(text)) colors.push('Rose Gold');
  if (/platinum/.test(text)) colors.push('Platinum');
  const materials: string[] = [];
  if (/gold/.test(text)) materials.push('Gold');
  if (/platinum/.test(text)) materials.push('Platinum');
  if (/silver/.test(text)) materials.push('Silver');
  const out: { color?: string; material?: string } = {};
  if (colors.length === 1) out.color = colors[0];
  if (materials.length === 1) out.material = materials[0];
  return out;
}

/**
 * Attributes Google requires on Apparel & Accessories in the US, plus the
 * identifier flag for pieces that have no GTIN. Condition is owned by the
 * feed that knows it; this helper does not guess new or used.
 */
export function googleShoppingMetafields(input: {
  title: string;
  productType: string;
  metal?: string | null;
}): GoogleShoppingMetafield[] {
  const fields: GoogleShoppingMetafield[] = [
    { namespace: GOOGLE_SHOPPING_NAMESPACE, key: 'custom_product', type: 'boolean', value: 'true' },
    { namespace: GOOGLE_SHOPPING_NAMESPACE, key: 'age_group', type: 'single_line_text_field', value: 'adult' },
    {
      namespace: GOOGLE_SHOPPING_NAMESPACE,
      key: 'gender',
      type: 'single_line_text_field',
      value: googleGender(input.title, input.productType),
    },
  ];
  const appearance = metalAppearance(input.metal);
  if (appearance.color) {
    fields.push({
      namespace: GOOGLE_SHOPPING_NAMESPACE,
      key: 'color',
      type: 'single_line_text_field',
      value: appearance.color,
    });
  }
  if (appearance.material) {
    fields.push({
      namespace: GOOGLE_SHOPPING_NAMESPACE,
      key: 'material',
      type: 'single_line_text_field',
      value: appearance.material,
    });
  }
  return fields;
}
