#!/usr/bin/env python3
"""Build bulkOperationRunMutation JSONL for the SEO pass.

One line per product, each the `variables` payload for:
  mutation call($product: ProductUpdateInput!) { productUpdate(product: $product) { ... } }

Field mapping is identical to do_seo() in lmny_bands_migrate.py:
  Title -> title, Body (HTML) -> descriptionHtml, Tags -> tags (split on comma),
  SEO Title/SEO Description -> seo.title/seo.description.
"""
import csv, json, sys

idmap = json.load(open('idmap.json'))
rows = list(csv.DictReader(open('lmny-mens-bands-seo-rebuild.csv', encoding='utf-8')))

out, missing = [], []
for r in rows:
    h = r['Handle']
    if h not in idmap:
        missing.append(h); continue
    out.append({"product": {
        "id": idmap[h],
        "title": r['Title'],
        "descriptionHtml": r['Body (HTML)'],
        "tags": [t.strip() for t in r['Tags'].split(',') if t.strip()],
        "seo": {"title": r['SEO Title'], "description": r['SEO Description']},
    }})

if missing:
    sys.exit(f"handles with no product id: {missing}")

with open('seo_pass.jsonl', 'w', encoding='utf-8') as f:
    for o in out:
        f.write(json.dumps(o, ensure_ascii=False) + "\n")
print(f"wrote {len(out)} lines")
