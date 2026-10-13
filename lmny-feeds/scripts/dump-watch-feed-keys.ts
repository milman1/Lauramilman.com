/**
 * One-off diagnostic: fetch the Belgium Dia watch feed and print the union of
 * raw field keys (+ a redacted sample). Does not write to Shopify.
 */
import { fetchBelgiumDiaFeed } from '../src/feeds/belgiumdia.js';

function redact(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.toLowerCase();
    if (/image|video|pic|url|link/.test(key) && typeof v === 'string' && /^https?:/i.test(v)) {
      out[k] = v.replace(/https?:\/\/[^/]+/, 'https://…') + ` (len=${v.length})`;
    } else if (/price|amount|cost/.test(key)) {
      out[k] = v; // pricing numbers are fine to show
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function main() {
  const rows = await fetchBelgiumDiaFeed('watch');
  console.log(`Fetched ${rows.length} watch rows`);
  if (rows.length === 0) {
    console.log('EMPTY FEED — cannot inspect keys');
    process.exit(2);
  }

  const keyCounts = new Map<string, { present: number; nonEmpty: number }>();
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      const cur = keyCounts.get(k) ?? { present: 0, nonEmpty: 0 };
      cur.present += 1;
      if (v !== null && v !== undefined && String(v).trim() !== '') cur.nonEmpty += 1;
      keyCounts.set(k, cur);
    }
  }

  const keys = [...keyCounts.keys()].sort((a, b) => a.localeCompare(b));
  console.log('\n=== UNION OF RAW KEYS ===');
  for (const k of keys) {
    const c = keyCounts.get(k)!;
    console.log(`${k}\tpresent=${c.present}/${rows.length}\tnonEmpty=${c.nonEmpty}`);
  }

  const interesting = [
    'Dial', 'Bezel', 'Bracelet', 'Metal', 'MM', 'Link', 'OG Tag', 'OG_Tag', 'OgTag',
    'Comment', 'Year', 'Stock', 'Stock#', 'Stock_No', 'Box', 'Paper', 'Condition',
    'Brand', 'Model', 'Reference', 'Price', 'ImageLink', 'VideoLink', 'Pic', 'Amount',
  ];
  console.log('\n=== LOOKUP FOR EXPECTED SPEC FIELDS (case-insensitive) ===');
  const lowerMap = new Map(keys.map((k) => [k.toLowerCase().replace(/[^a-z0-9]/g, ''), k]));
  for (const want of interesting) {
    const norm = want.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hit = lowerMap.get(norm);
    console.log(`${want}: ${hit ? `FOUND as "${hit}"` : 'NOT PRESENT'}`);
  }

  // Prefer a row that has Dial/Metal if those keys exist; else first row.
  const dialKey = lowerMap.get('dial');
  const sample =
    (dialKey && rows.find((r) => r[dialKey] != null && String(r[dialKey]).trim() !== '')) ||
    rows[0]!;
  console.log('\n=== SAMPLE ROW (redacted URLs) ===');
  console.log(JSON.stringify(redact(sample), null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
