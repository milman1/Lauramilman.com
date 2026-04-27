import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalogPath = path.join(root, 'data', 'antique-estate-catalog.json');
const csvPath = path.join(root, 'data', 'shopify-products-antique-estate.csv');
const variablesPath = path.join(root, 'shopify', 'populate-store.variables.json');

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

function handleize(value) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function skuFor(product) {
  return `LM-${product.handle.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 45)}`;
}

function designerCollections() {
  return catalog.designerCollections.map((designer) => ({
    title: designer.title,
    handle: designer.handle || handleize(designer.title),
    type: 'smart',
    descriptionHtml: `<p>Authenticated estate jewelry by ${designer.title}, curated by Laura Milman New York.</p>`,
    rules: [
      {
        column: 'VENDOR',
        relation: 'EQUALS',
        condition: designer.title,
      },
    ],
  }));
}

const headers = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Product Category',
  'Type',
  'Tags',
  'Published',
  'Option1 Name',
  'Option1 Value',
  'Variant SKU',
  'Variant Grams',
  'Variant Inventory Tracker',
  'Variant Inventory Qty',
  'Variant Inventory Policy',
  'Variant Fulfillment Service',
  'Variant Price',
  'Variant Requires Shipping',
  'Variant Taxable',
  'SEO Title',
  'SEO Description',
  'Status',
  'Metafield: custom.metal_type [single_line_text_field]',
  'Metafield: custom.metal_weight [single_line_text_field]',
  'Metafield: custom.diamond_weight [single_line_text_field]',
  'Metafield: custom.measurements [single_line_text_field]',
  'Metafield: custom.gemstones [single_line_text_field]',
  'Metafield: custom.era [single_line_text_field]',
  'Metafield: custom.condition [single_line_text_field]'
];

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

const rows = catalog.products.map((product) => {
  const values = {
    'Handle': product.handle,
    'Title': product.title,
    'Body (HTML)': product.bodyHtml,
    'Vendor': product.vendor,
    'Product Category': '',
    'Type': product.productType,
    'Tags': product.tags.join(', '),
    'Published': 'TRUE',
    'Option1 Name': 'Title',
    'Option1 Value': 'Default Title',
    'Variant SKU': product.sku || skuFor(product),
    'Variant Grams': product.grams || '',
    'Variant Inventory Tracker': 'shopify',
    'Variant Inventory Qty': product.inventoryQuantity ?? 1,
    'Variant Inventory Policy': 'deny',
    'Variant Fulfillment Service': 'manual',
    'Variant Price': product.price,
    'Variant Requires Shipping': 'TRUE',
    'Variant Taxable': 'TRUE',
    'SEO Title': product.seoTitle,
    'SEO Description': product.seoDescription,
    'Status': product.status || 'active',
    'Metafield: custom.metal_type [single_line_text_field]': product.metafields.metal_type,
    'Metafield: custom.metal_weight [single_line_text_field]': product.metafields.metal_weight,
    'Metafield: custom.diamond_weight [single_line_text_field]': product.metafields.diamond_weight,
    'Metafield: custom.measurements [single_line_text_field]': product.metafields.measurements,
    'Metafield: custom.gemstones [single_line_text_field]': product.metafields.gemstones,
    'Metafield: custom.era [single_line_text_field]': product.metafields.era,
    'Metafield: custom.condition [single_line_text_field]': product.metafields.condition
  };

  return headers.map((header) => csvEscape(values[header])).join(',');
});

fs.writeFileSync(csvPath, `${headers.join(',')}\n${rows.join('\n')}\n`);

const variables = {
  catalog: {
    store: catalog.store,
    templateSuffix: catalog.templateSuffix,
    collections: [...catalog.collections, ...designerCollections()],
    products: catalog.products
  }
};

fs.writeFileSync(variablesPath, `${JSON.stringify(variables, null, 2)}\n`);

console.log(`Wrote ${catalog.products.length} products to ${csvPath}`);
console.log(`Wrote Shopify variables to ${variablesPath}`);
