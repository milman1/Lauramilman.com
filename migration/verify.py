#!/usr/bin/env python3
"""Diff live Shopify state against the SEO CSV.

Usage: python3 verify.py <live-export.jsonl>
Compares title, descriptionHtml, tags (as a set) and seo title/description for
every handle in the CSV that is present in the export. Exits non-zero on drift.
"""
import csv, json, re, sys


def norm_html(s):
    """Shopify reflows block-level tags on save (newlines around <tr> etc).
    Collapse inter-tag whitespace so we compare content, not formatting."""
    s = re.sub(r'>\s+<', '><', s or '')
    return s.strip()

live_path = sys.argv[1]
idmap = json.load(open('idmap.json'))
rows = {r['Handle']: r for r in csv.DictReader(open('lmny-mens-bands-seo-rebuild.csv', encoding='utf-8'))}

live = {}
for line in open(live_path, encoding='utf-8'):
    o = json.loads(line)
    if 'handle' in o:
        live[o['handle']] = o

matched, drift, absent = [], [], []
for h, r in rows.items():
    l = live.get(h)
    if not l:
        absent.append(h); continue
    want_tags = sorted({t.strip() for t in r['Tags'].split(',') if t.strip()})
    got_tags = sorted(set(l.get('tags') or []))
    seo = l.get('seo') or {}
    diffs = []
    if l.get('title') != r['Title']:
        diffs.append('title')
    if norm_html(l.get('descriptionHtml')) != norm_html(r['Body (HTML)']):
        diffs.append('descriptionHtml')
    if got_tags != want_tags:
        diffs.append('tags')
    if (seo.get('title') or '') != r['SEO Title']:
        diffs.append('seoTitle')
    if (seo.get('description') or '') != r['SEO Description']:
        diffs.append('seoDescription')
    (drift if diffs else matched).append((h, diffs))

print(f"exact match : {len(matched)}/{len(rows)}")
print(f"drift       : {len(drift)}")
print(f"not in export: {len(absent)}")
for h, d in drift:
    print(f"  DRIFT {h}: {','.join(d)}")
json.dump({"matched": [h for h, _ in matched], "drift": {h: d for h, d in drift}},
          open('verify_result.json', 'w'), indent=1)
sys.exit(1 if drift else 0)
