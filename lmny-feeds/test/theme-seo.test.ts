import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('theme SEO integration', () => {
  it('renders shared Product and BreadcrumbList schema on every PDP', () => {
    const standard = themeFile('sections/main-product.liquid');
    const diamond = themeFile('sections/main-product-diamond.liquid');
    const schema = themeFile('snippets/structured-data-product.liquid');

    expect(standard).toContain("render 'structured-data-product'");
    expect(diamond).toContain("render 'structured-data-product'");
    expect(schema).toContain('"@type": "Product"');
    expect(schema).toContain('"@type": "BreadcrumbList"');
    expect(schema).toContain('product.vendor');
    expect(schema).toContain('"itemCondition"');
    expect(schema).toContain('https://schema.org/UsedCondition');
  });

  it('propagates optimized homepage metadata to social tags', () => {
    const layout = themeFile('layout/theme.liquid');
    const meta = themeFile('snippets/meta-tags.liquid');

    expect(layout).toContain('Fine Jewelry, Diamonds & Estate Pieces');
    expect(layout).toContain("render 'meta-tags', meta_title: seo_social_title, meta_description: seo_meta_description");
    expect(meta).toContain('meta_description | default: page_description');
    expect(meta).toContain('twitter:description');
  });

  it('adds collection, website, organization, and article entity signals', () => {
    const layout = themeFile('layout/theme.liquid');
    const collection = themeFile('sections/main-collection.liquid');
    const diamondCollection = themeFile('sections/diamond-filter.liquid');
    const article = themeFile('sections/main-article.liquid');
    const collectionSchema = themeFile('snippets/structured-data-collection.liquid');

    expect(layout).toContain('"@type": "WebSite"');
    expect(layout).toContain('"@type": "SearchAction"');
    expect(layout).toContain('"sameAs"');
    expect(collection).toContain("render 'structured-data-collection'");
    expect(diamondCollection).toContain("render 'structured-data-collection'");
    expect(collectionSchema).toContain('"@type": "CollectionPage"');
    expect(collectionSchema).toContain('"@type": "ItemList"');
    expect(article).toContain('"dateModified"');
    expect(article).toContain('"@id": {{ canonical_url | json }}');
  });
});
