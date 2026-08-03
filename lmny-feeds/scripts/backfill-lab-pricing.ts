/**
 * Resumable lab pricing backfill.
 *
 * 1. Confirms lab feed products are unpublished (fail closed).
 * 2. Runs the normal sync with SYNC_FEEDS=lab.
 *
 * Schema version bump + corrected costUsd change every lab content_hash, so
 * the sync updates all ~20k products via bulk productSet. Re-running is safe:
 * unchanged hashes skip; interrupted runs resume on the next invocation.
 *
 * Do NOT republish until the sync report's lab band medians look sane.
 *
 *   npx tsx scripts/backfill-lab-pricing.ts --dry-run
 *   npx tsx scripts/backfill-lab-pricing.ts
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const dry = process.argv.includes('--dry-run');
  const env = {
    ...process.env,
    SYNC_FEEDS: 'lab',
  };

  console.log('=== Lab pricing backfill ===');
  console.log(dry ? 'Mode: DRY RUN (zero Shopify writes)' : 'Mode: LIVE writes');

  if (!dry) {
    const gate = await run('npx', ['tsx', 'scripts/confirm-lab-unpublished.ts'], env);
    if (gate !== 0) {
      console.error('Refusing to backfill while lab products are still published.');
      process.exit(gate);
    }
  } else {
    console.log('Skipping unpublished gate on --dry-run (still run confirm-lab-unpublished.ts before live).');
  }

  const syncArgs = ['tsx', 'src/sync.ts'];
  if (dry) syncArgs.push('--dry-run');
  const code = await run('npx', syncArgs, env);
  if (code !== 0) process.exit(code);

  console.log('');
  console.log('Next: read out/report.md lab pricing bands. Spot-check 1ct / 2ct / 3ct / 6ct / 10ct.');
  console.log('Only then republish Lab-Grown Diamond products to the Online Store.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
