#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STORE = 'laura-milman.myshopify.com';
const API_VERSION = '2026-01';
const SOURCE_THEME_ID = process.env.SOURCE_THEME_ID || 'gid://shopify/OnlineStoreTheme/140814221383';
const NEW_NAME = process.env.NEW_NAME || 'Laura Milman — brand spotlight (preview)';

const filesToUpload = [
  'templates/index.json',
  'templates/collection.vintage-jewelry.json',
  'sections/header.liquid',
  'sections/antique-estate-spotlight.liquid',
  'assets/theme.css',
];

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
  const r = spawnSync('shopify', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });
  const text = (r.stdout || '') + (r.stderr || '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error(`No JSON in CLI output:\n${text}`);
  const json = JSON.parse(text.slice(start, end + 1));
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json;
}

const themeDuplicateMutation = `mutation Dup($id: ID!, $name: String) {
  themeDuplicate(id: $id, name: $name) {
    newTheme { id name role }
    userErrors { field message }
  }
}`;

const themeFilesUpsertMutation = `mutation FilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
  themeFilesUpsert(themeId: $themeId, files: $files) {
    upsertedThemeFiles { filename }
    userErrors { field message code }
  }
}`;

console.log(`Duplicating MAIN theme ${SOURCE_THEME_ID} ...`);
const dup = exec(themeDuplicateMutation, { id: SOURCE_THEME_ID, name: NEW_NAME }, true);
const errs = dup.themeDuplicate.userErrors;
if (errs.length) {
  console.error('themeDuplicate errors:', errs);
  process.exit(1);
}
const newTheme = dup.themeDuplicate.newTheme;
console.log(`Created ${newTheme.id} (${newTheme.name}, ${newTheme.role})`);

console.log('Waiting 20s for duplicate processing ...');
await new Promise((r) => setTimeout(r, 20000));

function makeInput(rel) {
  return { filename: rel, body: { type: 'TEXT', value: readFileSync(resolve(rel), 'utf8') } };
}

const sectionsAndAssets = filesToUpload.filter((p) => p.startsWith('sections/') || p.startsWith('assets/') || p.startsWith('snippets/'));
const templates = filesToUpload.filter((p) => p.startsWith('templates/'));

console.log(`Pass 1: upserting ${sectionsAndAssets.length} section/asset files ...`);
const pass1 = exec(themeFilesUpsertMutation, { themeId: newTheme.id, files: sectionsAndAssets.map(makeInput) }, true);
if (pass1.themeFilesUpsert.userErrors.length) {
  console.error('pass1 errors:', pass1.themeFilesUpsert.userErrors);
  process.exit(1);
}
console.log('pass1 ok:', pass1.themeFilesUpsert.upsertedThemeFiles.map((f) => f.filename).join(', '));

console.log(`Pass 2: upserting ${templates.length} template files ...`);
const pass2 = exec(themeFilesUpsertMutation, { themeId: newTheme.id, files: templates.map(makeInput) }, true);
if (pass2.themeFilesUpsert.userErrors.length) {
  console.error('pass2 errors:', pass2.themeFilesUpsert.userErrors);
  process.exit(1);
}
console.log('pass2 ok:', pass2.themeFilesUpsert.upsertedThemeFiles.map((f) => f.filename).join(', '));

const numericId = newTheme.id.split('/').pop();
console.log('\nPreview URL:');
console.log(`https://laura-milman.myshopify.com/?preview_theme_id=${numericId}`);
console.log(`Editor:     https://admin.shopify.com/store/laura-milman/themes/${numericId}/editor`);
