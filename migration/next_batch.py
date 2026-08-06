#!/usr/bin/env python3
"""Print the next N products not yet in done.json, in compact form.

Bodies are fully templated (verified byte-exact against the CSV for all 108),
so only the per-product deltas are printed. Reconstruct the body as:

  {INTRO}<h3>Specifications</h3><table>
  <tr>{TD}Band Width{TD2}5mm (custom widths by request)</td></tr>
  <tr>{TD}Pattern{TD2}{PATTERN}</td></tr>
  <tr>{TD}Finish{TD2}{FINISH}</td></tr>
  <tr>{TD}Metal Type{TD2}{METAL}</td></tr>
  <tr>{TD}Ring Sizes{TD2}8.5 to 13</td></tr></table>{TAIL}

where TD  = <td style="padding:6px 16px 6px 0"><strong>
      TD2 = </strong></td><td style="padding:6px 0">
"""
import csv, json, os, sys

n = int(sys.argv[1]) if len(sys.argv) > 1 else 8
done = set(json.load(open('done.json'))) if os.path.exists('done.json') else set()
idmap = json.load(open('idmap.json'))
compact = json.load(open('compact.json'))
rows = [r for r in csv.DictReader(open('lmny-mens-bands-seo-rebuild.csv', encoding='utf-8'))
        if r['Handle'] not in done]

print(f"# {len(rows)} remaining; showing {min(n, len(rows))}")
for i, r in enumerate(rows[:n]):
    h = r['Handle']; c = compact[h]
    print(f"===== p{i} {h}")
    print(f"id      {idmap[h]}")
    print(f"title   {r['Title']}")
    print(f"pattern {c['pattern']}")
    print(f"finish  {c['finish']}")
    print(f"metal   {c['metal']}")
    print(f"tail    {c['tail']}")
    print(f"tags    {json.dumps([t.strip() for t in r['Tags'].split(',') if t.strip()], ensure_ascii=False)}")
    print(f"seoT    {r['SEO Title']}")
    print(f"seoD    {r['SEO Description']}")
    print(f"intro   {c['intro']}")
print("# handles: " + " ".join(r['Handle'] for r in rows[:n]))
