import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseAvailabilityCsv, parsePlanJsonl, validatePlan } from '../src/royalchain/activation.js';

function inputDir(): string {
  const value = process.argv.slice(2).find((arg) => arg.startsWith('--input-dir='))?.slice('--input-dir='.length);
  if (!value) throw new Error('missing required --input-dir=...');
  return value;
}

async function main(): Promise<void> {
  const directory = inputDir();
  const planText = await readFile(path.join(directory, 'royalchain-products.jsonl'), 'utf8');
  const availabilityText = await readFile(path.join(directory, 'availability.csv'), 'utf8');
  const plan = parsePlanJsonl(planText);
  const availability = parseAvailabilityCsv(availabilityText);
  const result = validatePlan(plan, availability);
  if (result.blockers.length) throw new Error(`private Royal Chain input validation failed with ${result.blockers.length} blocker(s)`);
  if (plan.length !== 32 || result.skus.length !== 93 || availability.size !== 93) throw new Error('private Royal Chain input has an invalid 32-product / 93-SKU scope');
  console.log(JSON.stringify({ products: plan.length, variants: result.skus.length, availabilityRows: availability.size }));
}

main().catch(() => {
  // Never echo plan lines, costs, source URLs, or even a duplicate SKU into CI logs.
  console.error('private Royal Chain input validation failed');
  process.exitCode = 1;
});
