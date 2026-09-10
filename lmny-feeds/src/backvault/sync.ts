import { mkdir, writeFile } from 'node:fs/promises';
import { channelsFor } from '../../config/channels.js';
import { BACKVAULT } from '../../config/pricing.js';
import { isUnavailableProductHandle } from '../../config/unavailable.js';
import { exchangeClientCredentials, ShopifyClient } from '../shopify.js';
import { mergeAvailability } from './availability.js';
import { fetchBackVaultCatalog } from './catalog.js';
import { fetchCompetitorCatalog, indexCompetitor, type CompetitorIndex } from './competitor.js';
import { diffBackVaultCatalog, promoteBackVaultInventoryUpdates, type Decision } from './diff.js';
import { fetchBackVaultAllProducts, fetchBackVaultFeed } from './feed.js';
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

/** Competitor price fetch (config/pricing.ts BACKVAULT.competitor). */
interface CompetitorStats {
  rowsFetched: number | null;
  stockRefsIndexed: number;
  error?: string;
}

/** Weekly availability check against the supplier's full in-stock catalog. */
interface AvailabilityStats {
  /** Rows in the supplier's full products.json (null when the fetch failed). */
  fullCatalogFetched: number | null;
  /** Top-designer in-stock items in the full catalog. */
  fullCatalogInStock: number;
  /** Store items that left new-arrivals but are still in stock — kept, not archived. */
  retained: number;
  /** Set when the full-catalog fetch failed; archives then follow new-arrivals only. */
  error?: string;
}

interface RunSummary {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  feedStats: ReturnType<typeof normalizeBackVaultFeed>['stats'];
  competitor: CompetitorStats;
  availability: AvailabilityStats;
  decisions: Decision[];
  published: number;
  /** Sales channels each published piece was sent to (config/channels.ts). */
  channels: string[];
  errors: string[];
}

export async function run(argv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(argv);
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  console.log(`The Back Vault → Shopify sync starting (${opts.dryRun ? 'DRY RUN' : 'LIVE'})`);

  const rawRows = await fetchBackVaultFeed();
  console.log(`Fetched ${rawRows.length} rows from The Back Vault new-arrivals feed`);

  // Competitor prices: a failed fetch means no matches this run (every piece
  // falls back to the flat markup) and a line in the report, never a crash.
  let competitor: CompetitorIndex | undefined;
  const competitorStats: CompetitorStats = { rowsFetched: null, stockRefsIndexed: 0 };
  try {
    const competitorRows = await fetchCompetitorCatalog();
    competitor = indexCompetitor(competitorRows);
    competitorStats.rowsFetched = competitorRows.length;
    competitorStats.stockRefsIndexed = competitor.size;
    console.log(`Competitor: ${competitorRows.length} rows, ${competitor.size} stock numbers indexed`);
  } catch (err) {
    competitorStats.error = err instanceof Error ? err.message : String(err);
    errors.push(`competitor fetch: ${competitorStats.error}`);
    console.error(`Competitor fetch failed (${competitorStats.error}); pricing by flat markup only`);
  }

  const { items: allItems, stats } = normalizeBackVaultFeed(rawRows, competitor);
  const availableItems = allItems.filter((item) => !isUnavailableProductHandle(handleFor(item)));
  const droppedUnavailable = allItems.length - availableItems.length;
  const items = opts.limit ? availableItems.slice(0, opts.limit) : availableItems;
  console.log(
    `Normalized: ${stats.accepted} top-designer in-stock items ` +
      `(${stats.notTopDesigner} skipped — not a top designer, ${stats.outOfStock} out of stock, ${stats.malformed} malformed` +
      `${droppedUnavailable ? `, ${droppedUnavailable} merchant-unavailable` : ''})`,
  );

  const { domain, token } = await resolveToken();
  const client = new ShopifyClient(domain, token);
  await client.verifyAuth();
  if (!opts.dryRun) {
    const scopes = await client.grantedScopes();
    const missing = ['write_products', 'write_publications', 'write_inventory', 'read_locations'].filter(
      (s) => !scopes.includes(s) && !(s.startsWith('read_') && scopes.includes(`write_${s.slice(5)}`)),
    );
    if (missing.length > 0) {
      throw new Error(
        `Refusing to write: Shopify token is missing ${missing.join(', ')} ` +
          `(granted: ${scopes.join(', ') || 'none'}). Sales channel publish needs write_publications.`,
      );
    }
    console.log(`Write scopes OK (granted: ${scopes.join(', ')})`);
  }

  const catalog = await fetchBackVaultCatalog(client);
  const catalogByHandle = new Map(catalog.map((c) => [c.handle, c]));

  // Availability: a piece already on the store that rolled off new-arrivals
  // stays listed while the supplier's full catalog still has it in stock.
  // If that fetch fails, fall back to new-arrivals alone (the pre-existing
  // behavior) and say so in the report.
  const availability: AvailabilityStats = { fullCatalogFetched: null, fullCatalogInStock: 0, retained: 0 };
  let desiredItems = items;
  if (!opts.limit) {
    try {
      const allRows = await fetchBackVaultAllProducts();
      const full = normalizeBackVaultFeed(allRows, competitor);
      const merged = mergeAvailability(
        items,
        full.items.filter((item) => !isUnavailableProductHandle(handleFor(item))),
        catalog.map((c) => c.handle),
      );
      desiredItems = merged.desired;
      availability.fullCatalogFetched = allRows.length;
      availability.fullCatalogInStock = full.stats.accepted;
      availability.retained = merged.retained;
      console.log(
        `Availability: ${allRows.length} rows in the full catalog, ${full.stats.accepted} top-designer in stock, ` +
          `${merged.retained} store items retained after leaving new-arrivals`,
      );
    } catch (err) {
      availability.error = err instanceof Error ? err.message : String(err);
      errors.push(`availability check: ${availability.error}`);
      console.error(`Availability check failed (${availability.error}); archiving by new-arrivals only`);
    }
  }

  const itemByHandle = new Map<string, BackVaultItem>();
  const desired = desiredItems.map((item) => {
    const handle = handleFor(item);
    itemByHandle.set(handle, item);
    return { handle, contentHash: contentHashFor(item) };
  });

  const decisions = diffBackVaultCatalog(desired, catalog);
  let locationId: string | null = null;
  try {
    locationId = await client.primaryLocationId();
  } catch (err) {
    errors.push(`location lookup: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (locationId) promoteBackVaultInventoryUpdates(decisions, catalog);
  const syncedAt = new Date().toISOString();
  // Estate pieces go to every channel in config/channels.ts — Online Store,
  // Shop, Google & YouTube, Facebook & Instagram, Pinterest (merchant
  // decision 2026-09-10). Resolved once per run; a channel that is not
  // installed is logged by the client and left out.
  const wantedChannels = [...channelsFor('estate')];
  const publicationsByName = opts.dryRun
    ? new Map<string, string>()
    : await client.publicationIdsByName(wantedChannels);
  const publicationIds = [...publicationsByName.values()];
  const channelNames = opts.dryRun ? wantedChannels : [...publicationsByName.keys()];
  if (!opts.dryRun) {
    console.log(`Publishing to ${publicationIds.length} sales channels: ${channelNames.join(', ') || 'none'}`);
  }
  let published = 0;

  for (const decision of decisions) {
    if (decision.action === 'skip') continue;
    try {
      if (decision.action === 'archive') {
        if (!opts.dryRun && decision.productId) {
          const existing = catalogByHandle.get(decision.handle);
          if (locationId && existing?.inventoryItemId) {
            const stockErrors = await client.stockInventoryItem(existing.inventoryItemId, locationId, 0);
            if (stockErrors.length) errors.push(`${decision.handle}: inventory ${stockErrors.join('; ')}`);
          }
          await client.archiveProduct(decision.productId);
          // Sold/pulled items keep their URL alive instead of 404ing, same
          // pattern as the Belgium Dia sync (src/shopify.ts
          // redirectProductUrl). Redirect to the all-jewelry catalog
          // (SHOPIFY_SETUP.md §5) rather than a per-designer collection —
          // the archived product's vendor isn't available here.
          await client.redirectProductUrl(decision.handle, '/collections/all').catch(() => {});
        }
        continue;
      }
      if (decision.action === 'publish') {
        if (!opts.dryRun && decision.productId && publicationIds.length > 0) {
          const pubErrors = await client.publishToChannels(decision.productId, publicationIds);
          if (pubErrors.length) errors.push(`${decision.handle}: publish ${pubErrors.join('; ')}`);
          else published += 1;
        } else if (opts.dryRun) {
          published += 1;
        }
        continue;
      }
      const item = itemByHandle.get(decision.handle);
      if (!item) continue; // shouldn't happen: archive is the only decision without a feed item
      const existingEntry = catalogByHandle.get(decision.handle);
      const input = buildProductSetInput(
        item,
        syncedAt,
        existingEntry ? { id: existingEntry.id, imageCount: existingEntry.imageCount } : undefined,
        locationId ?? undefined,
      );
      if (!opts.dryRun) {
        const result = await client.productSet(input);
        if (result.errors.length) errors.push(`${decision.handle}: ${result.errors.join('; ')}`);
        if (locationId && result.inventoryItemId) {
          const qty = item.imageUrls.length > 0 ? 1 : 0;
          if (result.inventoryQuantity !== qty) {
            const stockErrors = await client.stockInventoryItem(result.inventoryItemId, locationId, qty);
            if (stockErrors.length) errors.push(`${decision.handle}: inventory ${stockErrors.join('; ')}`);
          }
        }
        const productId = result.id ?? decision.productId;
        if (productId && publicationIds.length > 0 && result.errors.length === 0) {
          const pubErrors = await client.publishToChannels(productId, publicationIds);
          if (pubErrors.length) errors.push(`${decision.handle}: publish ${pubErrors.join('; ')}`);
          else published += 1;
        }
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
    competitor: competitorStats,
    availability,
    decisions,
    published,
    channels: channelNames,
    errors,
  };

  await writeReport(summary);

  const counts = decisions.reduce<Record<string, number>>((acc, d) => {
    acc[d.action] = (acc[d.action] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `Done: create=${counts.create ?? 0} update=${counts.update ?? 0} publish=${counts.publish ?? 0} ` +
      `archive=${counts.archive ?? 0} skip=${counts.skip ?? 0} ` +
      `published=${published} to ${channelNames.length} channels (${channelNames.join(', ') || 'none'}) ` +
      `errors=${errors.length}`,
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
    `- Priced from a competitor match: ${summary.feedStats.competitorMatched}`,
    '',
    `## Competitor prices (${BACKVAULT.competitor.name})`,
    ...(summary.competitor.error
      ? [`- FAILED: ${summary.competitor.error} — flat markup only this run`]
      : [`- Rows fetched: ${summary.competitor.rowsFetched ?? 'skipped'}`, `- Stock numbers indexed: ${summary.competitor.stockRefsIndexed}`]),
    '',
    `## Availability check (full supplier catalog)`,
    ...(summary.availability.error
      ? [`- FAILED: ${summary.availability.error} — archived by new-arrivals only this run`]
      : [
          `- Rows fetched: ${summary.availability.fullCatalogFetched ?? 'skipped'}`,
          `- Top designer, in stock: ${summary.availability.fullCatalogInStock}`,
          `- Retained after leaving new-arrivals: ${summary.availability.retained}`,
        ]),
    '',
    `## Catalog changes`,
    `- Create: ${counts.create ?? 0}`,
    `- Update: ${counts.update ?? 0}`,
    `- Publish to Online Store: ${counts.publish ?? 0}`,
    `- Archive: ${counts.archive ?? 0}`,
    `- Unchanged: ${counts.skip ?? 0}`,
    `- Published this run: ${summary.published}`,
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
