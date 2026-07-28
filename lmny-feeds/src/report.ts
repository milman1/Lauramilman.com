import type { HoursProbeResult } from './feeds/hours.js';
import type { Decision, Hold, Kind, Publishable } from './types.js';

export interface FeedStats {
  fetched: number;
  publishable: number;
  held: number;
  fetchError?: string;
  /** Feed not in SYNC_FEEDS — skipped entirely (not fetched, not held). */
  skipped?: boolean;
}

export interface WatchLine {
  stockRef: string;
  title: string;
  costUsd: number;
  compMidUsd: number | null;
  retailUsd: number | null;
  holdReason: string | null;
}

export interface SyncReport {
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  enabledFeeds: Kind[];
  feeds: Record<Kind, FeedStats>;
  holdHistogram: Record<string, number>;
  naturalMargins: { p25: number | null; median: number | null; p75: number | null; rejectedByFloor: number };
  watchComps: { checked: number; hits: number; hitRate: number | null; lines: WatchLine[] };
  sampleNaturals: Array<{ stockRef: string; title: string; costUsd: number; retailUsd: number; marginPct: number }>;
  decisions: { create: string[]; update: string[]; archive: string[]; skipped: number };
  writeErrors: string[];
  mediaQuarantined: string[];
  collectionsCreated: string[];
  hoursProbe?: HoursProbeResult;
  notes: string[];
}

export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const a = sorted[lo]!;
  const b = sorted[hi]!;
  return a + (b - a) * (idx - lo);
}

export function holdHistogram(holds: Hold[]): Record<string, number> {
  const histogram: Record<string, number> = {};
  for (const hold of holds) {
    histogram[hold.reason] = (histogram[hold.reason] ?? 0) + 1;
  }
  return histogram;
}

export function naturalMarginStats(publishable: Publishable[], holds: Hold[]) {
  const margins = publishable
    .filter((p) => p.item.kind === 'natural')
    .map((p) => p.priced.marginPct)
    .sort((a, b) => a - b);
  return {
    p25: percentile(margins, 0.25),
    median: percentile(margins, 0.5),
    p75: percentile(margins, 0.75),
    rejectedByFloor: holds.filter((h) => h.reason === 'natural_margin_floor').length,
  };
}

export function summarizeDecisions(decisions: Decision[]) {
  return {
    create: decisions.filter((d) => d.action === 'create').map((d) => d.handle),
    update: decisions.filter((d) => d.action === 'update').map((d) => d.handle),
    archive: decisions.filter((d) => d.action === 'archive').map((d) => d.handle),
    skipped: decisions.filter((d) => d.action === 'skip').length,
  };
}

const pct = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const usd = (v: number | null | undefined) => (v == null ? '—' : `$${v.toLocaleString('en-US')}`);

export function renderMarkdown(r: SyncReport): string {
  const lines: string[] = [];
  lines.push(`# LMNY feed sync — ${r.dryRun ? 'DRY RUN (zero writes)' : 'LIVE'}`);
  lines.push('');
  lines.push(`Started ${r.startedAt} · finished ${r.finishedAt}`);
  lines.push('');
  lines.push(`Enabled feeds (\`SYNC_FEEDS\`): **${r.enabledFeeds.join(', ') || 'none'}** — others skipped.`);
  lines.push('');
  lines.push('## Feeds');
  lines.push('');
  lines.push('| Feed | Fetched | Publishable | Held |');
  lines.push('|---|---|---|---|');
  for (const [kind, s] of Object.entries(r.feeds)) {
    const fetched = s.skipped ? '_skipped_' : s.fetchError ? `⚠️ ${s.fetchError}` : String(s.fetched);
    lines.push(`| ${kind} | ${fetched} | ${s.publishable} | ${s.held} |`);
  }
  lines.push('');
  lines.push('## Hold reasons');
  lines.push('');
  const holds = Object.entries(r.holdHistogram).sort((a, b) => b[1] - a[1]);
  if (holds.length === 0) lines.push('None.');
  for (const [reason, count] of holds) lines.push(`- \`${reason}\`: ${count}`);
  lines.push('');
  lines.push('## Natural margins');
  lines.push('');
  lines.push(`p25 ${pct(r.naturalMargins.p25)} · median ${pct(r.naturalMargins.median)} · p75 ${pct(r.naturalMargins.p75)} · rejected by 20% floor: ${r.naturalMargins.rejectedByFloor}`);
  lines.push('');
  if (r.hoursProbe) {
    const p = r.hoursProbe;
    lines.push('## Hours diagnostic (single reference)');
    lines.push('');
    lines.push(`Probe: brand \`${p.brandSent}\`, reference \`${p.referenceSent}\``);
    lines.push(`URL: \`${p.url}\``);
    if (p.networkError) {
      lines.push(`Result: **network error** — \`${p.networkError}\` → URL unreachable (check \`HOURS_API_URL\`).`);
    } else {
      lines.push(`HTTP **${p.status}**${p.ok ? '' : ' (not ok)'} · parsed comp mid: ${p.parsedMid == null ? '—' : usd(p.parsedMid)}`);
      lines.push('');
      lines.push('```');
      lines.push(p.bodySnippet || '(empty body)');
      lines.push('```');
      const hint =
        p.status === 401 || p.status === 403
          ? 'auth — `HOURS_API_KEY` not accepted.'
          : p.status === 404
            ? 'wrong URL — `HOURS_API_URL` points at nothing; use the direct Supabase function URL.'
            : p.status === 200 && p.parsedMid == null
              ? 'reference-format mismatch — endpoint reached but no comp for this input string.'
              : p.status === 200 && p.parsedMid != null
                ? 'endpoint works with a clean reference → the live 0-comp result is an input-format issue from the feed.'
                : 'see body above.';
      lines.push(`Diagnosis: ${hint}`);
    }
    lines.push('');
  }
  if (r.sampleNaturals.length) {
    lines.push('## Sample publishable naturals (cost → retail)');
    lines.push('');
    lines.push('| Stock | Title | Cost | Retail | Margin |');
    lines.push('|---|---|---|---|---|');
    for (const s of r.sampleNaturals) {
      lines.push(`| ${s.stockRef} | ${s.title} | ${usd(s.costUsd)} | ${usd(s.retailUsd)} | ${pct(s.marginPct)} |`);
    }
    lines.push('');
  }
  lines.push('## Watch comps');
  lines.push('');
  lines.push(`Comp hit rate: ${r.watchComps.hits}/${r.watchComps.checked} (${pct(r.watchComps.hitRate)})`);
  if (r.watchComps.lines.length) {
    lines.push('');
    lines.push('| Ref | Watch | Cost | Comp mid | Retail | Hold |');
    lines.push('|---|---|---|---|---|---|');
    for (const w of r.watchComps.lines) {
      lines.push(`| ${w.stockRef} | ${w.title} | ${usd(w.costUsd)} | ${usd(w.compMidUsd)} | ${usd(w.retailUsd)} | ${w.holdReason ?? '—'} |`);
    }
  }
  lines.push('');
  lines.push('## Catalog actions' + (r.dryRun ? ' (would be)' : ''));
  lines.push('');
  lines.push(`- create: **${r.decisions.create.length}**`);
  lines.push(`- update: **${r.decisions.update.length}**`);
  lines.push(`- archive: **${r.decisions.archive.length}**`);
  lines.push(`- skip (unchanged): **${r.decisions.skipped}**`);
  if (r.collectionsCreated.length) lines.push(`- collections created: ${r.collectionsCreated.join(', ')}`);
  if (r.mediaQuarantined.length) lines.push(`- media-missing quarantined: ${r.mediaQuarantined.length}`);
  if (r.writeErrors.length) {
    lines.push('');
    lines.push('## Write errors');
    lines.push('');
    for (const e of r.writeErrors.slice(0, 50)) lines.push(`- ${e}`);
    if (r.writeErrors.length > 50) lines.push(`- …and ${r.writeErrors.length - 50} more (see JSON artifact)`);
  }
  if (r.notes.length) {
    lines.push('');
    lines.push('## Notes');
    lines.push('');
    for (const n of r.notes) lines.push(`- ${n}`);
  }
  lines.push('');
  return lines.join('\n');
}
