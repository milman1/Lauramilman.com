/**
 * LMNY feed sync — Shopify is currently the live database.
 *
 * Full pass per run: fetch feeds → normalize → price → diff against the
 * Shopify catalog by handle + content_hash → create / update / archive.
 * Unchanged hashes are skipped entirely. --dry-run does everything except
 * writes and produces the full report.
 *
 * When SUPABASE_URL + SUPABASE_SERVICE_KEY are set, priced stones are also
 * upserted into public.stones (dual-write). Do not delete feed products until
 * that table is verified populated and the App Proxy filter reads from it.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchBelgiumDiaFeed } from './feeds/belgiumdia.js';
import { HoursClient, mapConcurrent } from './feeds/hours.js';
import { ALL_KINDS, parseEnabledFeeds } from './feeds-config.js';
import { diffCatalog, kindForHandle } from './diff.js';
import { priceLab, priceNatural, priceWatch } from './markup.js';
import { normalizeStones, normalizeWatches } from './normalize.js';
import { buildProductSetInput, contentHashFor, handleFor, MEDIA_MISSING_TAG, titleFor } from './product.js';
import {
  holdHistogram,
  naturalMarginStats,
  renderMarkdown,
  summarizeDecisions,
  type SyncReport,
  type WatchLine,
} from './report.js';
import { ShopifyClient, exchangeClientCredentials } from './shopify.js';
import {
  dualWriteStones,
  markMissingStonesUnavailable,
  supabaseConfigured,
} from './supabase-stones.js';
import type { CatalogEntry, Decision, FeedItem, Hold, Kind, Publishable, WatchItem } from './types.js';

const BULK_THRESHOLD = 100;
const OUT_DIR = 'out';
/** Fail the run only if more than this share of attempted writes error. */
const WRITE_ERROR_FAIL_RATE = 0.01;
/** Required Shopify scopes for a live write (write_* implies read_*). */
const REQUIRED_WRITE_SCOPES = ['write_products', 'write_publications'];
/** Where a sold stone's URL points once its product is archived and 404s. */
const ARCHIVE_REDIRECT_TARGETS: Record<Kind, string> = {
  natural: '/collections/natural-diamonds',
  lab: '/collections/lab-grown-diamonds',
  // The merchant's own collection, not the duplicate the sync used to create.
  watch: '/collections/time-pieces',
};
/** Known-good reference for the Hours single-reference diagnostic. */
const HOURS_PROBE = { brand: 'Rolex', reference: '126710BLRO' };

interface Flags {
  dryRun: boolean;
  limit: number | null;
}

function parseFlags(argv: string[]): Flags {
  const dryRun = argv.includes('--dry-run');
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  return { dryRun, limit: limitArg ? Number(limitArg.split('=')[1]) : null };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/**
 * Shopify auth accepts EITHER a static Admin API token (SHOPIFY_ADMIN_TOKEN,
 * `shpat_…`) OR a Dev Dashboard app's Client ID + Secret
 * (SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET), which are exchanged for a
 * fresh 24h token at runtime. Stores migrated to the new dev platform have
 * no static token, so the client-credentials pair is the supported path.
 */
const BASE_REQUIRED_ENV = ['SHOPIFY_STORE_DOMAIN', 'BELGIUMDIA_API_KEY', 'HOURS_API_URL', 'HOURS_API_KEY'];

function hasShopifyAuth(): boolean {
  return Boolean(
    process.env.SHOPIFY_ADMIN_TOKEN ||
      (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET),
  );
}

/** Fail with a readable report (not a stack trace) when Actions config is absent. */
async function checkConfiguration(): Promise<void> {
  const missing = BASE_REQUIRED_ENV.filter((name) => !process.env[name]);
  if (!hasShopifyAuth()) {
    missing.push('SHOPIFY_ADMIN_TOKEN (or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET)');
  }
  if (missing.length === 0) return;
  const md = [
    '# LMNY feed sync — missing configuration',
    '',
    'The sync cannot run because these are not set:',
    '',
    ...missing.map((m) => `- \`${m}\``),
    '',
    'Configure them as repository secrets under **Settings → Secrets and variables →',
    'Actions → Secrets**, then re-run. For Shopify auth, either set',
    '`SHOPIFY_ADMIN_TOKEN` (a `shpat_…` token) **or** the Dev Dashboard app pair',
    '`SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET`.',
    '',
  ].join('\n');
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, 'report.md'), md);
  await writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify({ error: 'missing_configuration', missing }, null, 2));
  console.error(`Missing configuration: ${missing.join(', ')}`);
  process.exit(1);
}

/**
 * Resolve a Shopify Admin API token: use SHOPIFY_ADMIN_TOKEN directly if set,
 * else exchange the Dev Dashboard Client ID + Secret for one.
 */
async function resolveShopifyToken(domain: string): Promise<string> {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  const { token, scope } = await exchangeClientCredentials(
    domain,
    requireEnv('SHOPIFY_CLIENT_ID'),
    requireEnv('SHOPIFY_CLIENT_SECRET'),
  );
  console.log(`Obtained Shopify token via client-credentials grant (scopes: ${scope || 'unknown'})`);
  return token;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const notes: string[] = [];

  await checkConfiguration();
  const domain = requireEnv('SHOPIFY_STORE_DOMAIN');
  const shopify = new ShopifyClient(domain, await resolveShopifyToken(domain));
  const { shop } = await shopify.verifyAuth();
  console.log(`Shopify auth OK: ${shop}${flags.dryRun ? ' (dry run — zero writes)' : ''}`);

  const enabledFeeds = parseEnabledFeeds();
  console.log(`Enabled feeds (SYNC_FEEDS): ${[...enabledFeeds].join(', ')}`);

  // Hours single-reference diagnostic (dry-run only): tells apart a 401/404/
  // no_comp cause without needing the watch feed enabled.
  let hoursProbe: SyncReport['hoursProbe'];
  if (flags.dryRun) {
    try {
      hoursProbe = await new HoursClient().probe(HOURS_PROBE.brand, HOURS_PROBE.reference);
      console.log(
        `Hours probe [${HOURS_PROBE.reference}]: ${hoursProbe.networkError ? `network error ${hoursProbe.networkError}` : `HTTP ${hoursProbe.status}, mid ${hoursProbe.parsedMid ?? 'none'}`} @ ${hoursProbe.url}`,
      );
    } catch (err) {
      console.error(`Hours probe threw: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 1. Fetch + normalize the enabled feeds. A feed that fails to fetch is
  //    excluded from archive decisions so an outage can't archive its segment.
  //    A feed not in SYNC_FEEDS is skipped entirely (never fetched).
  const items: FeedItem[] = [];
  const holds: Hold[] = [];
  const fetchedKinds = new Set<Kind>();
  const feeds: SyncReport['feeds'] = {
    natural: { fetched: 0, publishable: 0, held: 0 },
    lab: { fetched: 0, publishable: 0, held: 0 },
    watch: { fetched: 0, publishable: 0, held: 0 },
  };

  for (const kind of ALL_KINDS) {
    if (!enabledFeeds.has(kind)) {
      feeds[kind].skipped = true;
      console.log(`Feed ${kind}: skipped (not in SYNC_FEEDS)`);
      continue;
    }
    try {
      let rows = await fetchBelgiumDiaFeed(kind);
      if (flags.limit) rows = rows.slice(0, flags.limit);
      // A live feed returning 0 rows is almost always an outage or rate-limit
      // (the API answers 200 with an empty array), NOT a real emptying. Treat
      // it as a soft failure so it never archives the whole catalog segment.
      if (rows.length === 0) {
        feeds[kind].fetched = 0;
        feeds[kind].fetchError = 'returned 0 rows (likely rate-limit/outage) — segment protected, not archived';
        console.error(`Feed ${kind}: 0 rows — treating as outage; catalog segment will NOT be archived`);
        continue;
      }
      const result = kind === 'watch' ? normalizeWatches(rows) : normalizeStones(rows, kind);
      feeds[kind].fetched = rows.length;
      items.push(...result.items);
      holds.push(...result.holds);
      fetchedKinds.add(kind);
      console.log(`Fetched ${kind}: ${rows.length} rows, ${result.items.length} past gates`);
    } catch (err) {
      feeds[kind].fetchError = err instanceof Error ? err.message : String(err);
      console.error(`Feed ${kind} failed: ${feeds[kind].fetchError} — its catalog segment will not be archived`);
    }
  }

  // 2. Price. Watches go through Hours per-reference; 404-no-comp is a hold.
  const publishable: Publishable[] = [];
  const hours = new HoursClient();
  const watchLines: WatchLine[] = [];
  let compsChecked = 0;
  let compHits = 0;

  const watches = items.filter((i): i is WatchItem => i.kind === 'watch');
  const compByRef = new Map(
    (
      await mapConcurrent(watches, 4, async (w) => {
        const comp = await hours.compFor(w.brand, w.reference);
        return [w.stockRef, comp] as const;
      })
    ),
  );

  for (const item of items) {
    let result;
    if (item.kind !== 'watch') {
      result = item.kind === 'natural' ? priceNatural(item) : priceLab(item);
    } else {
      const comp = compByRef.get(item.stockRef) ?? null;
      compsChecked++;
      if (comp) compHits++;
      result = priceWatch(item, comp);
      watchLines.push({
        stockRef: item.stockRef,
        title: titleFor(item),
        costUsd: item.costUsd,
        compMidUsd: comp?.midUsd ?? null,
        retailUsd: result.ok ? result.priced.retailUsd : null,
        holdReason: result.ok ? null : result.hold.reason,
      });
    }
    if (result.ok) {
      publishable.push({ item, priced: result.priced });
    } else {
      holds.push(result.hold);
    }
  }

  for (const kind of ['natural', 'lab', 'watch'] as const) {
    feeds[kind].publishable = publishable.filter((p) => p.item.kind === kind).length;
    feeds[kind].held = holds.filter((h) => h.kind === kind).length;
  }

  // 3. Read the catalog and diff. Held items are never created; items that
  //    left the feed or newly fail gates get archived (never deleted).
  const catalog: CatalogEntry[] = await shopify.fetchCatalog();
  console.log(`Catalog: ${catalog.length} feed-managed products`);
  const desired = publishable.map((p) => ({
    handle: handleFor(p.item),
    contentHash: contentHashFor(p.item, p.priced),
  }));
  const dupes = desired.length - new Set(desired.map((d) => d.handle)).size;
  if (dupes > 0) notes.push(`${dupes} duplicate handles in feed data — last occurrence wins`);
  const decisions: Decision[] = diffCatalog(desired, catalog, fetchedKinds);
  const summary = summarizeDecisions(decisions);
  console.log(`Diff: create ${summary.create.length}, update ${summary.update.length}, archive ${summary.archive.length}, skip ${summary.skipped}`);

  // 4. Execute (live only).
  const writeErrors: string[] = [];
  const mediaQuarantined: string[] = [];
  const mediaRehosted: string[] = [];
  let redirectsCreated = 0;
  let collectionsCreated: string[] = [];

  if (!flags.dryRun) {
    // Assert write scopes before the first real write; fail loudly if missing.
    const scopes = await shopify.grantedScopes();
    const missingScopes = REQUIRED_WRITE_SCOPES.filter((s) => !scopes.includes(s));
    if (missingScopes.length > 0) {
      throw new Error(
        `Refusing to write: Shopify token is missing required scopes ${missingScopes.join(', ')} ` +
          `(granted: ${scopes.join(', ') || 'none'}). write_products/write_publications include read access.`,
      );
    }
    console.log(`Write scopes OK (granted: ${scopes.join(', ')})`);

    await shopify.ensureMetafieldDefinitions();
    collectionsCreated = await shopify.ensureCollections();

    const syncedAt = new Date().toISOString();
    const byHandle = new Map(publishable.map((p) => [handleFor(p.item), p]));

    // Media processing is asynchronous, so this always judges the *previous*
    // run's uploads — which is why it runs before this run's writes.
    try {
      const broken = await shopify.auditMedia();
      if (broken.length > 0) console.log(`Media: ${broken.length} products with no usable image — attempting rescue`);
      // Cause-level accounting: run 21 rescued 1 of 83 and the log couldn't
      // say why. Distinguish "stone left the feed" (nothing to rescue, stays
      // quarantined) from "fetch/sniff failed" (worth investigating).
      let noSource = 0;
      let rehostFailed = 0;
      // A slow supplier host must not stall the hourly cadence: 83 rescue
      // fetches × a 30s timeout each is ~40 minutes, which is what dragged
      // run 22 out. Budget the attempts; the backlog drains across runs.
      let rescueBudget = 15;
      for (const p of broken) {
        const item = byHandle.get(p.handle)?.item;
        const source = item?.imageUrls[0];
        if (!source) noSource += 1;
        if (source && rescueBudget <= 0) continue; // leave for the next run
        // Shopify refuses some supplier images over their Content-Type alone.
        // Fetching the bytes and re-uploading with a sniffed type rescues the
        // ones that are really images; the rest are genuinely missing.
        const staged = source ? await shopify.rehostImage(source) : null;
        if (source && !staged) {
          rehostFailed += 1;
          rescueBudget -= 1;
        }
        if (staged) {
          await shopify.deleteMedia(p.id, p.failedMediaIds);
          const errors = await shopify.attachMedia(p.id, staged, titleFor(item!));
          if (errors.length === 0) {
            mediaRehosted.push(p.handle);
            // Bring back anything a previous run had quarantined for this.
            if (p.status !== 'ACTIVE' || p.tags.includes(MEDIA_MISSING_TAG)) {
              await shopify.unquarantineProduct(p.id, p.tags);
            }
            continue;
          }
          notes.push(`rehost ${p.handle}: ${errors.join('; ')}`);
        }
        if (p.status === 'ACTIVE' && !p.tags.includes(MEDIA_MISSING_TAG)) {
          const errors = await shopify.quarantineProduct(p.id, p.tags);
          if (errors.length === 0) mediaQuarantined.push(p.handle);
        }
      }
      if (broken.length > 0) {
        console.log(
          `Media: rescued ${mediaRehosted.length} of ${broken.length} ` +
            `(no feed source: ${noSource}, fetch/sniff failed: ${rehostFailed})`,
        );
      }
    } catch (err) {
      writeErrors.push(`media audit: ${err instanceof Error ? err.message : String(err)}`);
    }
    // productSet keys on id. An update sent without one is treated as a create
    // and rejected as a duplicate handle, so every write carries the catalogue
    // id when the handle is already known.
    const catalogByHandle = new Map(catalog.map((c) => [c.handle, c]));
    const toWrite = decisions.filter((d) => d.action === 'create' || d.action === 'update');
    const inputs = toWrite
      .map((d) => byHandle.get(d.handle))
      .filter((p): p is Publishable => Boolean(p))
      .map((p) => {
        const existing = catalogByHandle.get(handleFor(p.item));
        return buildProductSetInput(p.item, p.priced, syncedAt, existing && { id: existing.id, mediaCount: existing.mediaCount });
      });

    let createdIds: string[] = [];
    if (inputs.length >= BULK_THRESHOLD) {
      console.log(`Writing ${inputs.length} products via bulk productSet…`);
      const result = await shopify.bulkProductSet(inputs);
      createdIds = result.ids;
      writeErrors.push(...result.errors);
    } else if (inputs.length > 0) {
      console.log(`Writing ${inputs.length} products via direct productSet…`);
      for (const input of inputs) {
        const result = await shopify.productSet(input);
        if (result.id) createdIds.push(result.id);
        writeErrors.push(...result.errors.map((e) => `${input.handle}: ${e}`));
      }
    }

    if (createdIds.length > 0) {
      const publicationId = await shopify.onlineStorePublicationId();
      console.log(`Publishing ${createdIds.length} products to Online Store…`);
      for (const id of createdIds) {
        const errors = await shopify.publishResource(id, publicationId);
        writeErrors.push(...errors.map((e) => `publish ${id}: ${e}`));
      }
    }

    const toArchive = decisions.filter((d) => d.action === 'archive');
    // urlRedirectCreate needs write_online_store_navigation, which the app
    // doesn't currently have. Access-denied surfaces as a thrown GraphQL
    // error, not a userError — it killed runs 20 and 21 — and a missing
    // redirect is cosmetic next to a sold stone still listed as available,
    // so the whole redirect step is best-effort. One note, not one per stone.
    let redirectsDenied = false;
    for (const d of toArchive) {
      if (!d.productId) continue;
      const errors = await shopify.archiveProduct(d.productId);
      writeErrors.push(...errors.map((e) => `archive ${d.handle}: ${e}`));
      if (errors.length > 0 || redirectsDenied) continue;
      // An archived product 404s. Send the dead URL to its collection so an
      // old link lands on the stones we do have rather than nothing.
      const target = ARCHIVE_REDIRECT_TARGETS[kindForHandle(d.handle) ?? 'natural'];
      try {
        const redirectErrors = await shopify.redirectProductUrl(d.handle, target);
        for (const e of redirectErrors) notes.push(`redirect ${d.handle}: ${e}`);
        if (redirectErrors.length === 0) redirectsCreated += 1;
      } catch (err) {
        redirectsDenied = true;
        notes.push(
          `redirects skipped: ${err instanceof Error ? err.message : String(err)} — ` +
            'grant the app write_online_store_navigation to enable them',
        );
      }
    }
    if (redirectsCreated > 0) console.log(`Redirected ${redirectsCreated} sold stones to their collection`);
  }

  // 4b. Optional Supabase dual-write. Shopify remains the live storefront
  //     source until stones is populated and the App Proxy filter ships.
  //     Gated on SUPABASE_URL + SUPABASE_SERVICE_KEY; no-op when unset.
  const sb = supabaseConfigured();
  if (!flags.dryRun && sb) {
    try {
      const syncedAt = new Date().toISOString();
      const hashByRef = new Map(
        publishable.map((p) => [p.item.stockRef, contentHashFor(p.item, p.priced)]),
      );
      const { upserted } = await dualWriteStones(publishable, hashByRef, syncedAt, sb);
      notes.push(`supabase stones upserted: ${upserted}`);
      console.log(`Supabase: upserted ${upserted} stones`);
      if (fetchedKinds.has('natural') && fetchedKinds.has('lab')) {
        const live = new Set(
          publishable.filter((p) => p.item.kind !== 'watch').map((p) => p.item.stockRef),
        );
        const gone = await markMissingStonesUnavailable(live, sb);
        if (gone > 0) {
          notes.push(`supabase stones marked unavailable: ${gone}`);
          console.log(`Supabase: marked ${gone} stones unavailable`);
        }
      }
    } catch (err) {
      // Dual-write must never fail the Shopify sync — the products are still
      // the live copy. Surface the error in the report.
      const msg = `supabase dual-write: ${err instanceof Error ? err.message : String(err)}`;
      writeErrors.push(msg);
      console.error(msg);
    }
  } else if (!sb) {
    notes.push('supabase dual-write skipped (SUPABASE_URL / SERVICE_KEY unset) — Shopify is still the only stone store');
  }

  // 5. Report — run summary plus JSON artifact as the audit trail.
  const report: SyncReport = {
    dryRun: flags.dryRun,
    startedAt,
    finishedAt: new Date().toISOString(),
    enabledFeeds: [...enabledFeeds],
    feeds,
    hoursProbe,
    holdHistogram: holdHistogram(holds),
    naturalMargins: naturalMarginStats(publishable, holds),
    sampleNaturals: publishable
      .filter((p) => p.item.kind === 'natural')
      .slice(0, 5)
      .map((p) => ({
        stockRef: p.item.stockRef,
        title: titleFor(p.item),
        costUsd: p.item.costUsd,
        retailUsd: p.priced.retailUsd,
        marginPct: p.priced.marginPct,
      })),
    watchComps: {
      checked: compsChecked,
      hits: compHits,
      hitRate: compsChecked > 0 ? compHits / compsChecked : null,
      lines: watchLines,
    },
    decisions: summary,
    writeErrors,
    mediaQuarantined,
    collectionsCreated,
    notes,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  await writeFile(path.join(OUT_DIR, 'report.md'), renderMarkdown(report));
  console.log(renderMarkdown(report));

  // Isolated per-record rejections (a malformed feed field) shouldn't fail an
  // otherwise-good run of thousands of products — they're reported either way.
  // Fail only when the failure rate suggests something systemic.
  if (writeErrors.length > 0) {
    const attempted = summary.create.length + summary.update.length;
    const failureRate = attempted > 0 ? writeErrors.length / attempted : 1;
    console.error(`${writeErrors.length} write error(s) across ${attempted} attempted — see report`);
    if (failureRate > WRITE_ERROR_FAIL_RATE) {
      console.error(`Failure rate ${(failureRate * 100).toFixed(1)}% exceeds ${(WRITE_ERROR_FAIL_RATE * 100).toFixed(0)}% — failing the run`);
      process.exitCode = 1;
    } else {
      console.error('Below the failure threshold — run reported as successful with errors logged');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
