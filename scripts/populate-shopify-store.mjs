#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(resolve(__dirname, '../data/antique-estate-catalog.json'), 'utf8'));
const storeArgIndex = process.argv.indexOf('--store');
const store = storeArgIndex >= 0 ? process.argv[storeArgIndex + 1] : process.env.SHOPIFY_STORE || catalog.store;
const dryRun = process.argv.includes('--dry-run');
const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-01';

function runShopify(query, variables = {}, allowMutations = false) {
  const args = [
    'store',
    'execute',
    '--store',
    store,
    '--version',
    apiVersion,
    '--query',
    query,
    '--variables',
    JSON.stringify(variables),
    '--json',
  ];

  if (allowMutations) {
    args.push('--allow-mutations');
  }

  const result = spawnSync('shopify', args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    if (output.includes('No stored app authentication found')) {
      throw new Error(
        `No stored Shopify auth found for ${store}. Run: shopify store auth --store ${store} --scopes read_products,write_products`
      );
    }
    throw new Error(output || `shopify exited with status ${result.status}`);
  }

  return JSON.parse(result.stdout);
}

const existingCollectionsQuery = `#graphql
query ExistingCollections {
  collections(first: 250) {
    nodes {
      id
      title
      handle
      ruleSet {
        appliedDisjunctively
        rules {
          column
          relation
          condition
        }
      }
    }
  }
}`;

const createCollectionMutation = `#graphql
mutation CreateCollection($input: CollectionInput!) {
  collectionCreate(input: $input) {
    collection {
      id
      title
      handle
      ruleSet {
        rules {
          column
          relation
          condition
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}`;

const updateCollectionMutation = `#graphql
mutation UpdateCollection($input: CollectionInput!) {
  collectionUpdate(input: $input) {
    collection {
      id
      title
      handle
      ruleSet {
        rules {
          column
          relation
          condition
        }
      }
    }
    job {
      id
      done
    }
    userErrors {
      field
      message
    }
  }
}`;

const productSetMutation = `#graphql
mutation UpsertProduct($identifier: ProductSetIdentifiers!, $input: ProductSetInput!, $synchronous: Boolean!) {
  productSet(identifier: $identifier, input: $input, synchronous: $synchronous) {
    product {
      id
      title
      handle
      vendor
    }
    productSetOperation {
      id
      status
      userErrors {
        field
        message
      }
    }
    userErrors {
      field
      message
    }
  }
}`;

const verifyQuery = `#graphql
query VerifyPopulation($query: String!) {
  products(first: 100, query: $query) {
    nodes {
      id
      title
      handle
      vendor
      tags
      metafields(first: 10, namespace: "custom") {
        nodes {
          key
          value
        }
      }
    }
  }
  collections(first: 250) {
    nodes {
      id
      title
      handle
      products(first: 50) {
        nodes {
          handle
        }
      }
    }
  }
}`;

function checkErrors(payload, path) {
  const errors = path.reduce((node, key) => node?.[key], payload)?.userErrors || [];
  if (errors.length > 0) {
    throw new Error(errors.map((error) => `${error.field?.join('.') || 'field'}: ${error.message}`).join('; '));
  }
}

function collectionInput(collection, existingId) {
  const input = {
    title: collection.title,
    handle: collection.handle,
    descriptionHtml: collection.descriptionHtml,
  };

  if (existingId) {
    input.id = existingId;
  }

  if (collection.type === 'smart') {
    input.ruleSet = {
      appliedDisjunctively: false,
      rules: collection.rules,
    };
  }

  return input;
}

function productInput(product, manualCollectionIds) {
  return {
    title: product.title,
    handle: product.handle,
    descriptionHtml: product.bodyHtml,
    vendor: product.vendor,
    productType: product.productType,
    tags: product.tags,
    status: 'ACTIVE',
    templateSuffix: '',
    collections: manualCollectionIds,
    seo: {
      title: product.seoTitle,
      description: product.seoDescription,
    },
    productOptions: [
      {
        name: 'Title',
        position: 1,
        values: [{ name: 'Default Title' }],
      },
    ],
    variants: [
      {
        price: product.price,
        sku: `LM-${product.handle.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 45)}`,
        taxable: true,
        inventoryPolicy: 'DENY',
        optionValues: [{ optionName: 'Title', name: 'Default Title' }],
      },
    ],
    metafields: Object.entries(product.metafields).map(([key, value]) => ({
      namespace: 'custom',
      key,
      type: 'single_line_text_field',
      value,
    })),
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

console.log(`Populating ${store} with ${catalog.products.length} Laura Milman products.`);

if (dryRun) {
  console.log('Dry run only. No Shopify mutations will be executed.');
  console.log(`Collections to create/update: ${catalog.collections.length}`);
  console.log(`Products to upsert: ${catalog.products.length}`);
  console.log(`Manual anchor collection: ${catalog.collections.find((collection) => collection.handle === 'antique-estate')?.handle}`);
  console.log(`Designer collections: ${catalog.designerCollections.map((designer) => designer.handle).join(', ')}`);
  process.exit(0);
}

const existingCollectionsResult = runShopify(existingCollectionsQuery);
const collectionByHandle = new Map(
  existingCollectionsResult.data.collections.nodes.map((collection) => [collection.handle, collection])
);
console.log(`Discovered ${collectionByHandle.size} existing collections before upsert.`);

for (const collection of catalog.collections) {
  const existing = collectionByHandle.get(collection.handle);
  const mutation = existing ? updateCollectionMutation : createCollectionMutation;
  const input = collectionInput(collection, existing?.id);

  if (existing?.ruleSet == null && collection.type === 'smart') {
    delete input.ruleSet;
    console.log(`Keeping existing manual collection ${collection.handle}; products will attach by productSet where possible.`);
  }

  const result = runShopify(mutation, { input }, true);
  const key = existing ? 'collectionUpdate' : 'collectionCreate';
  checkErrors(result.data, [key]);
  const saved = result.data[key].collection;
  collectionByHandle.set(saved.handle, saved);
  console.log(`${existing ? 'Updated' : 'Created'} collection ${saved.handle}`);
}

const manualCollectionIdsByHandle = new Map(
  [...collectionByHandle.values()]
    .filter((collection) => collection.ruleSet == null)
    .map((collection) => [collection.handle, collection.id])
);
const broadManualHandles = ['antique-estate', 'all', 'new-arrivals', 'best-sellers'];

for (const product of catalog.products) {
  const matchingManualIds = unique(
    [...broadManualHandles, ...product.tags].map((handle) => manualCollectionIdsByHandle.get(handle))
  );
  const result = runShopify(
    productSetMutation,
    {
      identifier: { handle: product.handle },
      input: productInput(product, matchingManualIds),
      synchronous: true,
    },
    true
  );
  checkErrors(result.data, ['productSet']);
  console.log(`Upserted product ${result.data.productSet.product.handle}`);
}

const verify = runShopify(verifyQuery, { query: 'tag:antique-estate' });
const handles = new Set(catalog.products.map((product) => product.handle));
const verifiedProducts = verify.data.products.nodes.filter((product) => handles.has(product.handle));
const verifiedCollections = verify.data.collections.nodes.filter((collection) =>
  catalog.collections.some((expected) => expected.handle === collection.handle)
);

console.log(`Verified ${verifiedProducts.length}/${catalog.products.length} seeded products.`);
console.log(`Verified ${verifiedCollections.length}/${catalog.collections.length} expected collections.`);

if (verifiedProducts.length !== catalog.products.length) {
  throw new Error('Store verification did not find every seeded product.');
}
