import { mkdir, writeFile } from 'node:fs/promises';
import { channelsFor } from '../../config/channels.js';
import { BACKVAULT } from '../../config/pricing.js';
import { isUnavailableProductHandle } from '../../config/unavailable.js';
import { exchangeClientCredentials, ShopifyClient } from '../shopify.js';
import { mergeAvailability } from './availability.js';
import { fetchBackVaultCatalog } from './catalog.js';
import {
  describeCompetitorStop,
  fetchCompetitorCatalog,
  indexCompetitor,
  type CompetitorIndex,
  type CompetitorStopReason,
} from './competitor.js';
import {
  diffBackVaultCatalog,
  pinLivePricesWhenCompetitorUnavailable,
  promoteBackVaultInventoryUpdates,
  type Decision,
} from './diff.js';
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
  /**
   * True only when the retailer's whole catalogue was read. False means the
   * index is PARTIAL — matches in it are good, but a piece missing from it may
   * be priced on a page that was never read, so the price pin stays armed.
   */
  complete: boolean;
  pagesRead: number;
  stoppedReason?: CompetitorStopReason;
  /** How far the partial walk got and why it stopped. Absent on a complete read. */
  partial?: string;
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
  /** Sales channels that actually resolved and were published to. */
  channels: string[];
  /** False when the publications read failed (dry run only — a live run refuses to write). */
  channelsResolved: boolean;
  /** Pieces not published because they are not ACTIVE (DRAFT / ARCHIVED). */
  skippedDraft: number;
  /** Pieces written with the live price because the competitor fetch failed. */
  pricePinned: number;
  /** Pieces the price check stood down on: more than one variant, so no readable live price. */
  multiVariantUnchecked: number;
  /**
   * Something degraded this run without invalidating it — a failed competitor
   * fetch, prices held back. Reported, but never a non-zero exit: only
   * `errors` fails the run.
   */
  warnings: string[];
  errors: string[];
}

export async function run(argv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(argv);
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  // Degraded-but-valid outcomes. Kept apart from `errors` because `errors`
  // alone sets a non-zero exit code: the 2026-09-11 dry run failed purely on
  // a competitor 429 that the sync had already handled by design.
  const warnings: string[] = [];

  console.log(`The Back Vault → Shopify sync starting (${opts.dryRun ? 'DRY RUN' : 'LIVE'})`);

  const rawRows = await fetchBackVaultFeed();
  console.log(`Fetched ${rawRows.length} rows from The Back Vault new-arrivals feed`);

  // Competitor prices, in three states. COMPLETE: every match priced at the
  // midpoint, nothing pinned. PARTIAL (the retailer's pagination cap, or the
  // fetch deadline): the rows that came back are still indexed and matched,
  // and the price pin is armed for everything else, because a piece missing
  // from a partial index may have a match on a page that was never read.
  // FAILED: no matches at all, flat markup, pin armed. None of the three is
  // a crash or a failed run on its own.
  let competitor: CompetitorIndex | undefined;
  const competitorStats: CompetitorStats = { rowsFetched: null, stockRefsIndexed: 0, complete: false, pagesRead: 0 };
  // Set by a failed fetch AND by a partial one: in both cases a piece with no
  // match may still have one we could not read, so the live price is protected.
  let competitorDegraded = false;
  try {
    const result = await fetchCompetitorCatalog();
    competitor = indexCompetitor(result.rows);
    competitorStats.rowsFetched = result.rows.length;
    competitorStats.stockRefsIndexed = competitor.size;
    competitorStats.complete = result.complete;
    competitorStats.pagesRead = result.pagesRead;
    competitorStats.stoppedReason = result.stoppedReason;
    if (result.complete) {
      console.log(
        `Competitor: ${result.rows.length} rows over ${result.pagesRead} pages, ` +
          `${competitor.size} stock numbers indexed (complete)`,
      );
    } else {
      // Partial, not failed: the rows that came back are indexed and used, so
      // a piece that IS found still gets its midpoint price.
      competitorDegraded = true;
      competitorStats.partial = describeCompetitorStop(result);
      warnings.push(
        `competitor index is PARTIAL: ${competitorStats.partial}. Matches found were used; ` +
          'pieces with no match may have one on a page that was not read, so their live prices were protected',
      );
      console.warn(
        `Competitor: PARTIAL index — ${competitorStats.partial}; ${competitor.size} stock numbers indexed, ` +
          'matches used, unmatched pieces price-pinned',
      );
    }
  } catch (err) {
    competitorStats.error = err instanceof Error ? err.message : String(err);
    competitorDegraded = true;
    warnings.push(`competitor fetch: ${competitorStats.error} — flat markup only, live prices pinned`);
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

  // Estate pieces go to every channel in config/channels.ts — Online Store,
  // Shop, Google & YouTube, Facebook & Instagram, Pinterest (merchant
  // decision 2026-09-10). Resolved once per run, before the catalog read:
  // the catalog needs the store's installed publication list to work out
  // which channels a piece is missing, and a product's own
  // resourcePublications cannot supply it (it only lists what the product
  // is already on).
  const wantedChannels = [...channelsFor('estate')];
  let publicationsByName = new Map<string, string>();
  let installedNames: readonly string[] = wantedChannels;
  let channelsResolved = false;
  try {
    const publications = await client.publicationIdsByName(wantedChannels);
    publicationsByName = publications.ids;
    installedNames = publications.installedNames;
    channelsResolved = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`sales channel lookup: ${message}`);
    if (!opts.dryRun) {
      throw new Error(`Refusing to write: the sales channel lookup failed (${message})`);
    }
    // A dry run is a plan, not a write: fall back to assuming every
    // configured channel is installed, which over-reports publish decisions
    // rather than hiding them, and say so in the report.
    console.error(
      `Sales channel lookup failed (${message}); this dry run assumes all ${wantedChannels.length} ` +
        'configured channels are installed and reports its channels as unresolved',
    );
  }
  if (channelsResolved) {
    for (const name of wantedChannels) {
      if (publicationsByName.has(name)) continue;
      // Not a warning: a configured channel that does not resolve means the
      // run silently under-publishes, so it belongs in the run's errors.
      errors.push(`sales channel not resolved: '${name}' is not installed on this store`);
    }
    if (!publicationsByName.has('Online Store')) {
      const message =
        'the Online Store publication did not resolve — every piece would be written but left 404ing';
      errors.push(`sales channels: ${message}`);
      if (!opts.dryRun) throw new Error(`Refusing to write: ${message}`);
    }
  }
  const publicationIds = [...publicationsByName.values()];
  const channelNames = [...publicationsByName.keys()];
  const channelLabel = channelsResolved
    ? `${channelNames.length} channels (${channelNames.join(', ') || 'none'})`
    : 'unresolved (dry run)';
  console.log(`Sales channels: ${channelLabel}`);

  const catalog = await fetchBackVaultCatalog(client, installedNames);
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

  // With no competitor prices, pin any piece whose recomputed price would fall
  // below the ticket already on the store. Must run BEFORE the content hashes
  // are computed, so the hash matches the price actually written; the piece is
  // otherwise updated, reactivated and published exactly as normal.
  let pricePinned = 0;
  let multiVariantUnchecked = 0;
  if (competitorDegraded) {
    const pins = pinLivePricesWhenCompetitorUnavailable(desiredItems, catalog);
    pricePinned = pins.pinned;
    multiVariantUnchecked = pins.multiVariant;
    const notes: string[] = [];
    if (pricePinned > 0) {
      notes.push(
        `${pricePinned} piece${pricePinned === 1 ? '' : 's'} updated with the price left as it stands ` +
          '(the competitor comparison data was missing or incomplete, so a lower flat price was not written)',
      );
    }
    if (multiVariantUnchecked > 0) {
      notes.push(
        `${multiVariantUnchecked} piece${multiVariantUnchecked === 1 ? '' : 's'} with more than one variant ` +
          `${multiVariantUnchecked === 1 ? 'has' : 'have'} no readable live price and ` +
          `${multiVariantUnchecked === 1 ? 'was' : 'were'} written at the computed price`,
      );
    }
    if (notes.length > 0) {
      warnings.push(notes.join('; '));
      console.warn(notes.join('; '));
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
  let published = 0;
  let skippedDraft = 0;

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
        // Never publish anything that is not ACTIVE: a DRAFT piece is one the
        // sync deliberately held back (no photos, scrub pending), and pushing
        // it to Google and Meta would list it.
        if (catalogByHandle.get(decision.handle)?.status !== 'ACTIVE') {
          skippedDraft += 1;
          continue;
        }
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
        const wroteActive = String(input.status) === 'ACTIVE';
        if (!wroteActive) skippedDraft += 1;
        if (wroteActive && productId && publicationIds.length > 0 && result.errors.length === 0) {
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
    channelsResolved,
    skippedDraft,
    pricePinned,
    multiVariantUnchecked,
    warnings,
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
      `published=${published} to ${channelLabel} not_active=${skippedDraft} ` +
      `competitor=${competitorLabel(competitorStats)} ` +
      `price_pinned=${pricePinned} warnings=${warnings.length} errors=${errors.length}`,
  );
  if (warnings.length > 0) {
    console.warn('Warnings:');
    for (const w of warnings) console.warn(`  - ${w}`);
  }
  // Only errors fail the run. A warning is a degraded run that still did the
  // right thing, and failing on it trains everyone to ignore red runs.
  if (errors.length > 0) {
    console.error('Errors:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
  }
}

/**
 * The competitor section of the report, in the same three states as the Done
 * line. A partial read is a WARNING, not an error: it says how much was read
 * and why it stopped, that the matches it did find were used, and that the
 * pieces it could not match kept their live prices.
 */
function competitorReportLines(stats: CompetitorStats): string[] {
  if (stats.error !== undefined) {
    return [`- FAILED: ${stats.error} — flat markup only this run`];
  }
  if (!stats.complete) {
    return [
      `- PARTIAL: ${stats.partial ?? 'the walk stopped early'}`,
      `- Stock numbers indexed: ${stats.stockRefsIndexed}`,
      '- Matches found in the partial index WERE used (midpoint pricing).',
      '- Pieces with no match may have one on a page that was not read, so their live prices were protected ' +
        '(see the price pin below). This is a warning, not an error.',
    ];
  }
  return [
    `- Rows fetched: ${stats.rowsFetched ?? 'skipped'} over ${stats.pagesRead} pages (complete)`,
    `- Stock numbers indexed: ${stats.stockRefsIndexed}`,
  ];
}

/**
 * The competitor fetch in one token for the Done line: complete, partial (with
 * how much was read and why it stopped), or failed. A partial index priced
 * whatever it matched, so it must not read as a failure — and must not read as
 * a clean run either.
 */
function competitorLabel(stats: CompetitorStats): string {
  if (stats.error !== undefined) return 'failed';
  if (!stats.complete) return `PARTIAL(${stats.partial ?? 'stopped early'}; matches used, rest price-pinned)`;
  return `complete(${stats.rowsFetched ?? 0} rows/${stats.pagesRead} pages)`;
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
    ...competitorReportLines(summary.competitor),
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
    `- Publish to sales channels: ${counts.publish ?? 0}`,
    `- Archive: ${counts.archive ?? 0}`,
    `- Unchanged: ${counts.skip ?? 0}`,
    `- Price pinned to the live ticket (competitor unavailable): ${summary.pricePinned}`,
    `- Multi-variant pieces with no readable live price: ${summary.multiVariantUnchecked}`,
    `- Published this run: ${summary.published}`,
    '',
  ];
  if (summary.warnings.length > 0) {
    lines.push(
      `## Warnings (${summary.warnings.length})`,
      '_Degraded, but the run still did the right thing — these do not fail the job._',
      ...summary.warnings.map((w) => `- ${w}`),
      '',
    );
  }
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
