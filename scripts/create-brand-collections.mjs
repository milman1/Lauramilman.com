#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const STORE = process.env.SHOPIFY_STORE || 'laura-milman.myshopify.com';
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-01';

const brands = [
  { handle: 'bvlgari', title: 'Bvlgari', vendor: 'Bvlgari', description: 'Estate Bvlgari jewelry — Serpenti, Parentesi, Monete, and signed Roman classics.' },
  { handle: 'buccellati', title: 'Buccellati', vendor: 'Buccellati', description: 'Hand-engraved Buccellati estate jewelry from a storied Italian house.' },
  { handle: 'harry-winston', title: 'Harry Winston', vendor: 'Harry Winston', description: 'Diamond classics and signed estate pieces from the King of Diamonds.' },
  { handle: 'marina-b', title: 'Marina B', vendor: 'Marina B', description: 'Bold sculptural Marina B estate jewelry with graphic gold and color.' },
  { handle: 'verdura', title: 'Verdura', vendor: 'Verdura', description: 'Verdura estate pieces — Maltese cuffs, gold rope, and signed bold design.' },
  { handle: 'seaman-schepps', title: 'Seaman Schepps', vendor: 'Seaman Schepps', description: 'Seaman Schepps estate jewelry — shells, turbo earrings, and signed New York classics.' },
];

const listQuery = `query { collections(first: 250) { nodes { handle id } } }`;

const createMutation = `mutation CreateBrand($input: CollectionInput!) {
  collectionCreate(input: $input) {
    collection { id handle title }
    userErrors { field message }
  }
}`;

function exec(query, variables = {}, mutate = false) {
  const args = [
    'store', 'execute',
    '--store', STORE,
    '--version', API_VERSION,
    '--query', query,
    '--variables', JSON.stringify(variables),
    '--json',
  ];
  if (mutate) args.push('--allow-mutations');
  const r = spawnSync('shopify', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 20 });
  if (r.status !== 0) {
    throw new Error(`shopify CLI failed: ${r.stderr || r.stdout}`);
  }
  // The CLI prints spinner garbage before the JSON; parse the first { ... } JSON object.
  const text = r.stdout;
  const start = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (start < 0 || lastBrace < 0) throw new Error(`No JSON in CLI output: ${text}`);
  return JSON.parse(text.slice(start, lastBrace + 1));
}

const existing = exec(listQuery);
const handles = new Set(existing.collections.nodes.map((n) => n.handle));

for (const brand of brands) {
  if (handles.has(brand.handle)) {
    console.log(`exists: ${brand.handle}`);
    continue;
  }
  const input = {
    title: brand.title,
    handle: brand.handle,
    descriptionHtml: `<p>${brand.description}</p>`,
    ruleSet: {
      appliedDisjunctively: false,
      rules: [{ column: 'VENDOR', relation: 'EQUALS', condition: brand.vendor }],
    },
  };
  const res = exec(createMutation, { input }, true);
  const errs = res.collectionCreate.userErrors;
  if (errs.length) {
    console.error(`error creating ${brand.handle}:`, errs);
    process.exitCode = 1;
    continue;
  }
  console.log(`created: ${res.collectionCreate.collection.handle} (${res.collectionCreate.collection.id})`);
}
