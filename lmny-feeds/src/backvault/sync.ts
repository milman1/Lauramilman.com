import { mkdir, writeFile } from 'node:fs/promises';
import { exchangeClientCredentials, ShopifyClient } from '../shopify.js';
import { fetchBackVaultCatalog } from './catalog.js';
import { diffBackVaultCatalog, type Decision } from './diff.js';
import { fetchBackVaultFeed } from './feed.js';
import { archiveLegacyDuplicate } from './legacy.js';
import { normalizeBackVaultFeed } from './normalize.js';
import { buildProductSetInput, contentHashFor, handleFor } from './product.js';
import type { BackVaultItem } from './types.js';

interface RunOptions {
  dryRun: boolean;
  limit?: number;
}

function parseArgs(argv: string[]): RunOptions {
  const dryRun = argv.includes('--dry-run');
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : undefined;
  return { dryRun, limit };
}

async function resolveToken(): Promise<{ domain: string; token: string }> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN is not set');
  const staticToken = process.env.SHOPIFY_ADMIN_TOKEN;
  if (staticToken) return { domain, token: staticToken };
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (clientId && clientSecret) {
    const { token } = await exchangeClientCredentials(domain, clientId, clientSecret);
    return { domain, token };
  }
  throw new Error('Set SHOPIFY_ADMIN_TOKEN, or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET');
}

interface RunSummary {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  feedStats: ReturnType<typeof normalizeBackVaultFeed>['stats'];
  decisions: Decision[];
  published: number;
  legacyArchived: number;
  errors: string[];
}

export async function run(argv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(argv);
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  console.log(`The Back Vault → Shopify sync starting (${opts.dryRun ? 'DRY RUN' : 'LIVE'})`);

  const rawRows = await fetchBackVaultFeed();
  console.log(`Fetched ${rawRows.length} rows from The Back Vault new-arrivals feed`);

  const { items: allItems, stats } = normalizeBackVaultFeed(rawRows);
  const items = opts.limit ? allItems.slice(0, opts.limit) : allItems;
  console.log(
    `Normalized: ${stats.accepted} top-designer in-stock items ` +
      `(${stats.notTopDesigner} skipped — not a top designer, ${stats.outOfStock} out of stock, ${stats.malformed} malformed)`,
  );

  const { domain, token } = await resolveToken();
  const client = new ShopifyClient(domain, token);
  await client.verifyAuth();
  if (!opts.dryRun) {
    const scopes = await client.grantedScopes();
    const missing = ['write_products', 'write_publications'].filter((s) => !scopes.includes(s));
    if (missing.length > 0) {
      throw new Error(
        `Refusing to write: Shopify token is missing ${missing.join(', ')} ` +
          `(granted: ${scopes.join(', ') || 'none'}). Online Store publish needs write_publications.`,
      );
    }
    console.log(`Write scopes OK (granted: ${scopes.join(', ')})`);
  }

  const catalog = await fetchBackVaultCatalog(client);
  const catalogByHandle = new Map(catalog.map((c) => [c.handle, c]));

  const itemByHandle = new Map<string, BackVaultItem>();
  const desired = items.map((item) => {
    const handle = handleFor(item);
    itemByHandle.set(handle, item);
    return { handle, contentHash: contentHashFor(item) };
  });

  const decisions = diffBackVaultCatalog(desired, catalog);
  const syncedAt = new Date().toISOString();
  const publicationId = opts.dryRun ? null : await client.onlineStorePublicationId();
  let published = 0;
  let legacyArchived = 0;

  for (const decision of decisions) {
    try {
      let replacementReady = false;
      let replacementArchived = false;

      if (decision.action === 'skip') {
        replacementReady = true;
        replacementArchived = decision.reason === 'already_archived';
      } else if (decision.action === 'archive') {
        if (!opts.dryRun && decision.productId) {
          await client.archiveProduct(decision.productId);
          // Sold/pulled items keep their URL alive instead of 404ing, same
          // pattern as the Belgium Dia sync (src/shopify.ts
          // redirectProductUrl). Redirect to the all-jewelry catalog
          // (SHOPIFY_SETUP.md §5) rather than a per-designer collection —
          // the archived product's vendor isn't available here.
          await client.redirectProductUrl(decision.handle, '/collections/all').catch(() => {});
        }
        replacementReady = true;
        replacementArchived = true;
      } else if (decision.action === 'publish') {
        if (!opts.dryRun && decision.productId && publicationId) {
          const pubErrors = await client.publishResource(decision.productId, publicationId);
          if (pubErrors.length) errors.push(`${decision.handle}: publish ${pubErrors.join('; ')}`);
          else {
            published += 1;
            replacementReady = true;
          }
        } else if (opts.dryRun) {
          published += 1;
          replacementReady = true;
        }
      } else {
        const item = itemByHandle.get(decision.handle);
        if (!item) continue; // shouldn't happen: archive is the only decision without a feed item
        const existingEntry = catalogByHandle.get(decision.handle);
        const input = buildProductSetInput(
          item,
          syncedAt,
          existingEntry ? { id: existingEntry.id, imageCount: existingEntry.imageCount } : undefined,
        );
        if (opts.dryRun) {
          replacementReady = true;
        } else {
          const result = await client.productSet(input);
          if (result.errors.length) errors.push(`${decision.handle}: ${result.errors.join('; ')}`);
          const productId = result.id ?? decision.productId;
          if (productId && publicationId && result.errors.length === 0) {
            const pubErrors = await client.publishResource(productId, publicationId);
            if (pubErrors.length) errors.push(`${decision.handle}: publish ${pubErrors.join('; ')}`);
            else published += 1;
          }
          replacementReady = result.errors.length === 0;
        }
      }

      // The May–July CSV import listed the same SKUs without the bv- prefix.
      // Archive that older vintage row once the replacement exists (or when
      // the replacement itself left the feed).
      if (replacementReady) {
        const legacy = await archiveLegacyDuplicate(client, {
          bvHandle: decision.handle,
          replacementArchived,
          dryRun: opts.dryRun,
        });
        if (legacy.action === 'archived' || legacy.action === 'planned') legacyArchived += 1;
        for (const e of legacy.errors) errors.push(`${legacy.handle ?? decision.handle}: legacy ${e}`);
      }
    } catch (err) {
      errors.push(`${decision.handle}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const summary: RunSummary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun: opts.dryRun,
    feedStats: stats,
    decisions,
    published,
    legacyArchived,
    errors,
  };

  await writeReport(summary);

  const counts = decisions.reduce<Record<string, number>>((acc, d) => {
    acc[d.action] = (acc[d.action] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `Done: create=${counts.create ?? 0} update=${counts.update ?? 0} publish=${counts.publish ?? 0} archive=${counts.archive ?? 0} skip=${counts.skip ?? 0} published=${published} legacyArchived=${legacyArchived} errors=${errors.length}`,
  );
  if (errors.length > 0) {
    console.error('Errors:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
  }
}

async function writeReport(summary: RunSummary): Promise<void> {
  await mkdir('out', { recursive: true });
  await writeFile('out/backvault-report.json', JSON.stringify(summary, null, 2));

  const counts = summary.decisions.reduce<Record<string, number>>((acc, d) => {
    acc[d.action] = (acc[d.action] ?? 0) + 1;
    return acc;
  }, {});
  const lines = [
    `# The Back Vault sync — ${summary.dryRun ? 'DRY RUN' : 'LIVE'}`,
    '',
    `Started: ${summary.startedAt}  Finished: ${summary.finishedAt}`,
    '',
    `## Feed`,
    `- Fetched: ${summary.feedStats.totalFetched}`,
    `- Accepted (top designer, in stock): ${summary.feedStats.accepted}`,
    `- Skipped — not a top designer: ${summary.feedStats.notTopDesigner}`,
    `- Skipped — out of stock: ${summary.feedStats.outOfStock}`,
    `- Skipped — malformed row: ${summary.feedStats.malformed}`,
    '',
    `## Catalog changes`,
    `- Create: ${counts.create ?? 0}`,
    `- Update: ${counts.update ?? 0}`,
    `- Publish to Online Store: ${counts.publish ?? 0}`,
    `- Archive: ${counts.archive ?? 0}`,
    `- Unchanged: ${counts.skip ?? 0}`,
    `- Published this run: ${summary.published}`,
    `- Legacy vintage CSV duplicates archived: ${summary.legacyArchived}`,
    '',
  ];
  if (summary.errors.length > 0) {
    lines.push(`## Errors (${summary.errors.length})`, ...summary.errors.map((e) => `- ${e}`), '');
  }
  await writeFile('out/backvault-report.md', lines.join('\n'));
}

// Only run when executed directly (`tsx src/backvault/sync.ts`), not on import (tests import run()).
if (process.argv[1] && process.argv[1].endsWith('sync.ts')) {
  run().catch((err) => {
    console.error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exitCode = 1;
  });
}
