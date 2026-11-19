/**
 * Temporary read-only probe: does the Belgium Dia feed carry fancy-color
 * diamonds? Prints counts only (no costs, no stock numbers, no key).
 */
import { fetchBelgiumDiaFeed, type BelgiumDiaKind } from '../src/feeds/belgiumdia.js';

const WHITE = new Set('D E F G H I J K L M N O P Q R S T U V W X Y Z'.split(' '));
const pick = (r: Record<string, unknown>, names: string[]) => {
  for (const [k, v] of Object.entries(r)) if (names.includes(k.toLowerCase()) && v != null && String(v).trim()) return String(v).trim();
  return '';
};

for (const kind of ['natural', 'lab'] as BelgiumDiaKind[]) {
  const rows = await fetchBelgiumDiaFeed(kind);
  const colors = new Map<string, number>();
  let fancy = 0;
  const fancyCarat: number[] = [];
  for (const r of rows) {
    const c = pick(r, ['color', 'colour', 'color_grade']);
    const fc = pick(r, ['fancy_color', 'fancycolor', 'fancy_colour', 'f_color', 'fancy_color_intensity', 'intensity', 'fancy_intensity']);
    const key = (c || '(blank)').toUpperCase() + (fc ? ` | fancy:${fc}` : '');
    colors.set(key, (colors.get(key) ?? 0) + 1);
    if (fc || (c && !WHITE.has(c.toUpperCase()))) { fancy++; fancyCarat.push(Number(pick(r, ['carat', 'carats', 'weight', 'size'])) || 0); }
  }
  const fieldNames = [...new Set(rows.slice(0, 50).flatMap((r) => Object.keys(r)))].filter((k) => /colou?r|fancy|intens|overtone|hue/i.test(k));
  console.log(`\n== ${kind}: ${rows.length} stones; non-D-to-Z or fancy: ${fancy}`);
  console.log('color-related fields:', fieldNames.join(', ') || '(none)');
  const top = [...colors.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, n] of top.filter(([k]) => !WHITE.has(k))) console.log(`  ${k}: ${n}`);
  console.log(`  (white D-Z grades: ${top.filter(([k]) => WHITE.has(k)).reduce((s, [, n]) => s + n, 0)})`);
  if (fancyCarat.length) { fancyCarat.sort((a, b) => a - b); console.log(`  fancy carat range ${fancyCarat[0]}-${fancyCarat.at(-1)}`); }
}

// Does the API expose a separate colored-diamond type? Status and row count only.
const key = process.env.BELGIUMDIA_API_KEY ?? '';
for (const type of ['fancy', 'color', 'colored', 'fancy_color', 'fancycolor', 'natural_fancy', 'lab_fancy', 'colour']) {
  try {
    const u = new URL('https://belgiumdia.com/api/developer-api/diamond');
    u.search = new URLSearchParams({ type, page: '1', key }).toString();
    const r = await fetch(u, { signal: AbortSignal.timeout(30000) });
    let n = '?';
    try { const j: any = await r.json(); const arr = Array.isArray(j) ? j : j?.data ?? j?.diamonds ?? j?.result; n = Array.isArray(arr) ? String(arr.length) : `keys:${Object.keys(j ?? {}).slice(0, 6).join('/')}`; } catch { n = 'non-JSON'; }
    console.log(`type=${type}: HTTP ${r.status}, page-1 rows ${n}`);
  } catch { console.log(`type=${type}: request failed`); }
}
