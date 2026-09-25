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

    expect(layout).toContain('Lab-Grown & Estate Jewelry | Laura Milman New York');
    expect(layout).toContain('suppress_shop_suffix');
    expect(layout).toContain("when 'david-webb'");
    expect(layout).toContain('Lab-Grown Jewelry | Laura Milman');
    expect(layout).toContain("request.page_type == 'collection' and seo_meta_description == blank");
    expect(layout).toContain("request.page_type == 'article' and seo_meta_description.size > 180");
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
    expect(layout).toContain("render 'breadcrumbs'");
    expect(themeFile('snippets/breadcrumbs.liquid')).toContain('"@type": "BreadcrumbList"');
    expect(themeFile('sections/faq.liquid')).toContain('"@type": "FAQPage"');
    expect(themeFile('templates/page.google-reviews.liquid')).toContain('published on Google');
    expect(layout).toContain('AggregateRating');
    expect(diamondCollection).toContain('server-rendered diamond links');
    expect(diamondCollection).toContain("render 'product-card'");
    expect(collection).toContain("render 'collection-guide'");
    expect(themeFile('sections/header.liquid')).toContain('>All Jewelry</a>');
    expect(themeFile('sections/header.liquid')).not.toContain('All Fine Jewelry');
    const labBlock = themeFile('sections/peaceful-diamonds.liquid');
    expect(labBlock).toContain('var(--wine, #4A1428)');
    expect(labBlock).toContain('var(--gold, #C9A050)');
    expect(labBlock).not.toContain('--pd-blue');
    expect(themeFile('assets/theme.css')).toContain('color: var(--wine, #4A1428)');
  });

  it('lists Chains with the other Fine Jewelry types, not as a style column', () => {
    const header = themeFile('sections/header.liquid');
    const footer = themeFile('sections/footer.liquid');
    const collection = themeFile('sections/main-collection.liquid');

    expect(header).not.toContain('nav__dropdown--fine');
    expect(header).not.toContain('All Chains');
    expect(header).not.toContain('nav__dropdown-heading">Chains');
    expect(header).toMatch(/href="\/collections\/necklaces"[\s\S]*href="\/collections\/chains"[\s\S]*href="\/collections\/pendants-1"/);
    expect(header).toContain('>Chains</a>');
    expect(footer).toContain('href="/collections/chains"');
    expect(collection).toContain('href="/collections/chains"');
  });
});
