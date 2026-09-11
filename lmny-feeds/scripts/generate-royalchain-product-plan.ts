import { resolve } from 'node:path';
import { generateRoyalChainPlan } from '../src/royalchain/plan.js';

function arg(name: string): string {
  const value = process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (!value) throw new Error(`Missing --${name}=...`);
  return resolve(value);
}

const outputDir = arg('output-dir');
const repoRoot = resolve('..');
if (outputDir === repoRoot || outputDir.startsWith(`${repoRoot}/`)) throw new Error('Private plan output must be outside the repository');
const result = await generateRoyalChainPlan({ shortlistPath: arg('shortlist'), privatePath: arg('private'), outputDir });
console.log(`Prepared ${result.products} DRAFT products / ${result.variants} variants; no Shopify writes.`);
