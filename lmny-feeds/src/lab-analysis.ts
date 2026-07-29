/**
 * Lab feed curation analysis — Step 1 of the lab go-live decision.
 *
 * Read-only: fetches the Belgium Dia lab feed and reports; no Shopify access,
 * no gate changes. Run via the lmny-lab-analysis workflow (needs only
 * BELGIUMDIA_API_KEY).
 *
 * ⚠️ The tier definitions below are working assumptions for the count matrix,
 * not settled policy — printed in the report so they can be corrected:
 *   Tier A: colour D–F, clarity VS1+, cut Excellent/Ideal (where graded)
 *   Tier B: colour D–G, clarity VS2+, cut Very Good+ (where graded)
 *   Tier C: colour D–H, clarity SI1+, any cut
 * Fancy shapes carry no cut grade in this feed; they pass the cut test by
 * default and the cut-availability section quantifies that caveat.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LAB_TIERS } from '../config/pricing.js';
import { fetchBelgiumDiaFeed } from './feeds/belgiumdia.js';
import { priceLab } from './markup.js';
import { normalizeStones, pick } from './normalize.js';
import type { StoneItem } from './types.js';

const CARAT_BANDS: Array<{ label: string; lo: number; hi: number }> = [
  { label: '1.0–1.49ct', lo: 1.0, hi: 1.5 },
  { label: '1.5–1.99ct', lo: 1.5, hi: 2.0 },
  { label: '2.0–2.99ct', lo: 2.0, hi: 3.0 },
  { label: '3.0ct+', lo: 3.0, hi: Number.POSITIVE_INFINITY },
];

const COLOR_RANK: Record<string, number> = { D: 0, E: 1, F: 2, G: 3, H: 4, I: 5, J: 6, K: 7, L: 8 };
const CLARITY_RANK: Record<string, number> = { FL: 0, IF: 1, VVS1: 2, VVS2: 3, VS1: 4, VS2: 5, SI1: 6, SI2: 7 };

interface Tier {
  name: string;
  worstColor: number;
  worstClarity: number;
  cutOk: (cut: string | undefined) => boolean;
}

const TIERS: Tier[] = [
  { name: 'A', worstColor: COLOR_RANK.F!, worstClarity: CLARITY_RANK.VS1!, cutOk: (c) => c === undefined || c === 'Excellent' || c === 'Ideal' },
  { name: 'B', worstColor: COLOR_RANK.G!, worstClarity: CLARITY_RANK.VS2!, cutOk: (c) => c === undefined || c === 'Excellent' || c === 'Ideal' || c === 'Very Good' },
  { name: 'C', worstColor: COLOR_RANK.H!, worstClarity: CLARITY_RANK.SI1!, cutOk: () => true },
];

function passes(item: StoneItem, tier: Tier): boolean {
  const color = COLOR_RANK[item.color];
  const clarity = CLARITY_RANK[item.clarity];
  return color !== undefined && clarity !== undefined && color <= tier.worstColor && clarity <= tier.worstClarity && tier.cutOk(item.cut);
}

function count<T>(values: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

function topTable(m: Map<string, number>, limit: number): string {
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, n]) => `| \`${k}\` | ${n} |`)
    .join('\n');
}

async function main() {
  if (!process.env.BELGIUMDIA_API_KEY) throw new Error('BELGIUMDIA_API_KEY is not set');

  const rows = await fetchBelgiumDiaFeed('lab');
  const { items: allItems, holds } = normalizeStones(rows, 'lab');
  const items = allItems.filter((i): i is StoneItem => i.kind === 'lab');
  const lines: string[] = [];
  const out = (s: string) => lines.push(s);

  out('# Lab feed — curation analysis (read-only)');
  out('');
  out(`Feed rows: **${rows.length}** · normalized past gates: **${items.length}** · held: **${holds.length}**`);
  out('');
  out('Tier definitions used (assumptions — correct me):');
  out('- **A**: D–F, VS1+, cut Excellent/Ideal where graded');
  out('- **B**: D–G, VS2+, cut Very Good+ where graded');
  out('- **C**: D–H, SI1+, any cut');
  out('- Fancy shapes with no cut grade pass the cut test by default; see availability below.');
  out('');

  // Holds histogram
  const holdReasons = count(holds.map((h) => h.reason));
  out('## Holds');
  out('');
  out('| Reason | Count |');
  out('|---|---|');
  out(topTable(holdReasons as Map<string, number>, 20));
  out('');

  // Threshold matrix
  out('## Threshold matrix — stones passing each tier, by carat band (cumulative)');
  out('');
  out('| Carat band | Total | Tier A | Tier B | Tier C |');
  out('|---|---|---|---|---|');
  let above1 = 0;
  for (const band of CARAT_BANDS) {
    const inBand = items.filter((i) => i.carat >= band.lo && i.carat < band.hi);
    above1 += inBand.length;
    const a = inBand.filter((i) => passes(i, TIERS[0]!)).length;
    const b = inBand.filter((i) => passes(i, TIERS[1]!)).length;
    const c = inBand.filter((i) => passes(i, TIERS[2]!)).length;
    out(`| ${band.label} | ${inBand.length} | ${a} | ${b} | ${c} |`);
  }
  out(`| under 1.0ct | ${items.length - above1} | — | — | — |`);
  out('');

  // Carat distribution
  out('## Carat distribution (all normalized lab stones)');
  out('');
  out('| Band | Count |');
  out('|---|---|');
  const bands = new Map<string, number>();
  for (const i of items) {
    const lo = i.carat >= 5 ? '5.0+' : (Math.floor(i.carat * 2) / 2).toFixed(1);
    bands.set(lo, (bands.get(lo) ?? 0) + 1);
  }
  for (const [k, n] of [...bands.entries()].sort((x, y) => parseFloat(x[0]) - parseFloat(y[0]))) {
    out(`| ${k}ct | ${n} |`);
  }
  out('');

  // Cut-grade availability by shape
  out('## Cut-grade availability by shape');
  out('');
  out('| Shape | Stones | With cut grade | % |');
  out('|---|---|---|---|');
  const byShape = new Map<string, StoneItem[]>();
  for (const i of items) {
    const list = byShape.get(i.shape) ?? [];
    list.push(i);
    byShape.set(i.shape, list);
  }
  for (const [shape, list] of [...byShape.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12)) {
    const withCut = list.filter((i) => i.cut).length;
    out(`| ${shape} | ${list.length} | ${withCut} | ${((withCut / list.length) * 100).toFixed(0)}% |`);
  }
  out('');

  // Casing quirks straight from the raw rows
  out('## Raw feed values (casing quirks, before normalization)');
  for (const [label, keys] of [
    ['Shape', ['shape', 'cut_shape', 'stone_shape']],
    ['Cut', ['cut', 'cut_grade', 'make']],
    ['Color', ['color', 'colour', 'color_grade']],
    ['Clarity', ['clarity', 'clarity_grade']],
    ['Lab', ['lab', 'cert_lab', 'certificate_lab', 'grading_lab', 'cert']],
  ] as Array<[string, string[]]>) {
    const raw = count(rows.map((r) => String(pick(r as Record<string, unknown>, keys) ?? '(empty)')));
    out('');
    out(`### ${label} — ${raw.size} distinct values`);
    out('');
    out('| Raw value | Count |');
    out('|---|---|');
    out(topTable(raw as Map<string, number>, 15));
  }
  out('');

  // Pricing samples: Tier A at 1ct+, nearest to each target weight.
  out('## Pricing samples — Tier A, current config/pricing.ts multiples');
  out('');
  out('For checking against major lab retailers before locking the multiple.');
  out('');
  out('| Stock ref | Shape | Carat | Colour | Clarity | Cut | Cost | Multiplier | Retail | Retail $/ct |');
  out('|---|---|---|---|---|---|---|---|---|---|');
  const tierA = items.filter((i) => i.carat >= 1 && passes(i, TIERS[0]!));
  const used = new Set<string>();
  for (const target of [1.0, 1.5, 2.0, 2.5, 3.0]) {
    // Prefer Rounds for retailer comparability; fall back to any shape.
    const pool = (tierA.some((i) => i.shape === 'Round' && !used.has(i.stockRef))
      ? tierA.filter((i) => i.shape === 'Round')
      : tierA
    ).filter((i) => !used.has(i.stockRef));
    if (pool.length === 0) break;
    const pick_ = pool.reduce((best, i) => (Math.abs(i.carat - target) < Math.abs(best.carat - target) ? i : best));
    used.add(pick_.stockRef);
    const priced = priceLab(pick_);
    const tier = LAB_TIERS.find((t) => pick_.carat <= t.maxCarat);
    if (!priced.ok) {
      out(`| ${pick_.stockRef} | ${pick_.shape} | ${pick_.carat} | ${pick_.color} | ${pick_.clarity} | ${pick_.cut ?? '—'} | $${pick_.costUsd.toLocaleString()} | — | HELD: ${priced.hold.reason} | — |`);
      continue;
    }
    out(
      `| ${pick_.stockRef} | ${pick_.shape} | ${pick_.carat} | ${pick_.color} | ${pick_.clarity} | ${pick_.cut ?? '—'} | ` +
        `$${pick_.costUsd.toLocaleString()} | ×${tier?.multiplier ?? '?'} | $${priced.priced.retailUsd.toLocaleString()} | ` +
        `$${Math.round(priced.priced.retailUsd / pick_.carat).toLocaleString()} |`,
    );
  }
  out('');
  out(`Tier A at 1ct+ pool: ${tierA.length} stones.`);
  out('');

  const report = lines.join('\n');
  await mkdir('out', { recursive: true });
  await writeFile(path.join('out', 'lab-analysis.md'), report);
  console.log(report);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
