#!/usr/bin/env python3
"""
Laura Milman NY - watch backfill.

RETIREMENT CANDIDATE: the live Belgium Dia sync now maps Dial/Bezel/Bracelet/
Metal/MM/Links/Comment from the feed through watchListingBuilder.ts. Prefer a
content-hash resync (PRODUCT_SCHEMA_VERSION bump) over this script for those
fields. Keep this only for one-off recovery of titles that still have the old
bullet-list descriptionHtml and cannot wait for the next feed pass.

Applies docs/watch-listing-schema.md to every already-live watch whose
descriptionHtml is still the raw feed bullet list (Brand / Model / Reference /
Year / Condition / Accessories). This is the SAME schema as
src/watchListingBuilder.ts — if you change one, change both, or titles will
differ depending on whether a watch came in live or through this backfill.

It does not call the Belgium Dia API. It reads Brand/Model/Reference/Year/
Condition/Accessories straight out of the descriptionHtml already synced
into Shopify, which is where that data already lives.

SETUP
  pip install requests
  export SHOPIFY_TOKEN=shpat_xxxxxxxx   # or SHOPIFY_ADMIN_TOKEN
  python scripts/lmny_watches_backfill.py --dry-run

FLAGS
  --dry-run     print what would happen, change nothing
  --limit N     only process the first N matching products
  --only HANDLE process a single product

Safe to re-run: already-processed titles (starting "Pre-Owned " or "Unworn ")
are skipped. Anything with an unrecognized condition (e.g. "SLIDER") is
written to needs_review.csv instead of being touched.

Tags are merged with existing product tags so operational tags (lmny-feed,
full-set, other-watch-brand, …) are preserved.
"""

import argparse, csv, html, json, os, re, sys, time
from pathlib import Path

import requests

SHOP = os.environ.get("SHOPIFY_STORE_DOMAIN", "laura-milman.myshopify.com")
API = "2025-01"
ENDPOINT = f"https://{SHOP}/admin/api/{API}/graphql.json"
STATE = Path("watch_migrate_state.json")
REVIEW = Path("needs_review.csv")

TOKEN = os.environ.get("SHOPIFY_TOKEN") or os.environ.get("SHOPIFY_ADMIN_TOKEN")
if not TOKEN:
    sys.exit("Set SHOPIFY_TOKEN or SHOPIFY_ADMIN_TOKEN first.")

SESSION = requests.Session()
SESSION.headers.update({"X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json"})

# --- CONFIG: mirrors watchListingBuilder.ts CONFIG ---------------------------
# Leave empty until confirmed true for this inventory (see schema doc).
# SEO description still always ends with "Authenticated by Laura Milman New York."
TRUST_LINE = ""

# --- condition mapping: mirrors docs/watch-listing-schema.md exactly --------
STATE_MAP = {
    "PRE OWNED": {"state": "preowned", "title_word": "Pre-Owned", "grade": None, "google": "used"},
    "UNWORN":    {"state": "unworn",   "title_word": "Unworn",    "grade": None, "google": "new"},
}
GRADE_MAP = {
    "MINT": "Mint", "EXCELLENT": "Excellent", "VERY GOOD": "Very Good",
    "GOOD": "Good", "FAIR": "Fair",
}
MONTHS = {
    "JAN": "January", "FEB": "February", "MAR": "March", "APR": "April",
    "MAY": "May", "JUN": "June", "JUL": "July", "AUG": "August",
    "SEP": "September", "OCT": "October", "NOV": "November", "DEC": "December",
}


def map_condition(raw):
    key = (raw or "").strip().upper()
    if key in STATE_MAP:
        return STATE_MAP[key]
    if key in GRADE_MAP:
        return {"state": "preowned", "title_word": "Pre-Owned", "grade": GRADE_MAP[key], "google": "used"}
    return None


ACRONYMS = {"GMT"}  # extend as more turn up (watch models rarely use others)
ROMAN_NUMERAL = re.compile(r"^[IVXLCDM]+$")


def title_case(s):
    """Capitalizes after spaces AND hyphens, so 'DAY-DATE' -> 'Day-Date',
    not 'Day-date'. Matches watchListingBuilder.ts: lowercases first, then
    capitalizes pieces, preserving GMT and roman numerals."""
    def cap_piece(p):
        if not p:
            return p
        up = p.upper()
        if up in ACRONYMS or ROMAN_NUMERAL.match(up):
            return up
        return p[:1].upper() + p[1:].lower()

    def cap_word(w):
        return "-".join(cap_piece(p) for p in w.split("-"))

    return " ".join(cap_word(w) for w in s.lower().split() if w)


def escape_html(s):
    return html.escape(s, quote=False)


def normalize_year(y):
    if not y:
        return None
    y = y.strip()
    if re.match(r"^\d{4}$", y):
        return y
    m = re.match(r"^([A-Za-z]{3})-(\d{4})$", y)
    if m and m.group(1).upper() in MONTHS:
        return f"{MONTHS[m.group(1).upper()]} {m.group(2)}"
    return y


def infer_box_paper(accessories_raw):
    """The ~620 already-live watches only have the OLD combined 'Accessories'
    string in Shopify (e.g. 'Full set (box and papers)'), not the separate
    Box/Paper booleans the real source sheet tracks. This is a bridge:
    infer the two booleans from that string where the mapping is
    unambiguous. Returns (box, paper), either of which may be None if it
    can't be inferred — in which case that row is omitted downstream,
    exactly as if it were genuinely unstated."""
    if not accessories_raw:
        return None, None
    a = accessories_raw.strip().lower()
    if a == "watch only":
        return False, False
    if a == "with papers":
        return None, True  # box status genuinely unknown from this string
    if a.startswith("full set"):
        return True, True
    return None, None


def box_paper_clause(box, paper):
    if box is None and paper is None:
        return None
    if box and paper:
        return "as a full set with box and papers"
    if box and not paper:
        return "with its original box, but without papers"
    if not box and paper:
        return "with its papers, but without the original box"
    return "on its own, without box or papers"


def yes_no(v):
    if v is None:
        return None
    return "Yes" if v else "No"


def truncate_at_word(s, max_len):
    if len(s) <= max_len:
        return s
    cut = s[:max_len]
    idx = cut.rfind(" ")
    return (cut[:idx] if idx > 0 else cut).strip()


def already_processed(title):
    return bool(re.match(r"^(Pre-Owned|Unworn)\s", title.strip()))


# --- parse the existing bullet-list description ------------------------------
BULLET_RE = re.compile(
    r"<strong>Brand:</strong>\s*([^<]+)</li>.*?"
    r"<strong>Model:</strong>\s*([^<]+)</li>.*?"
    r"<strong>Reference:</strong>\s*([^<]+)</li>"
    r"(?:.*?<strong>Year:</strong>\s*([^<]+)</li>)?"
    r".*?<strong>Condition:</strong>\s*([^<]+)</li>"
    r"(?:.*?<strong>Accessories:</strong>\s*([^<]+)</li>)?",
    re.DOTALL,
)


def parse_feed_description(html_text):
    """Only matches the raw feed bullet-list shape. Returns None otherwise
    (e.g. for the already-optimized 'estate' template products, or the
    single placeholder product) — those are left alone by design."""
    m = BULLET_RE.search(html_text or "")
    if not m:
        return None
    brand, model, reference, year, condition, accessories = m.groups()
    return {
        "brand": brand.strip(),
        "model": model.strip(),
        "reference": reference.strip(),
        "year": year.strip() if year else None,
        "condition_raw": condition.strip(),
        "accessories": accessories.strip() if accessories else None,
    }


def build_listing(feed, handle=None):
    """NOTE ON SCOPE: this backfill only has access to what's already synced
    into Shopify's descriptionHtml for the ~620 already-live watches, which
    is Brand/Model/Reference/Year/Condition/Accessories only. It CANNOT
    populate Case Size, Metal, Dial, Bezel, Bracelet, Original Tag, Link, or
    Comment — that data exists in the master tracking sheet but was never
    synced to these products' descriptions. Those rows are simply absent
    from the output here, not guessed at. watchListingBuilder.ts (the
    ingest-time path, which sees the full source row) does populate all of
    them for every watch synced from now on. Closing this gap for the
    already-live 620 needs a one-off match against the master sheet by
    Stock # — a separate follow-up."""
    mapping = map_condition(feed["condition_raw"])
    if mapping is None:
        return None  # needs review

    brand = title_case(feed["brand"])
    model = title_case(feed["model"])
    reference = feed["reference"]  # never re-cased
    year = normalize_year(feed["year"])
    title_word = mapping["title_word"]
    grade = mapping["grade"]

    title = f"{title_word} {brand} {model} {reference}"

    year_clause = f" from {escape_html(year)}" if year else ""
    grade_clause = f" It is in {grade.lower()} condition." if grade else ""
    box, paper = infer_box_paper(feed["accessories"])
    bp_clause = box_paper_clause(box, paper)
    opening_clause = f" is offered by Laura Milman New York{' ' + bp_clause if bp_clause else ''}"

    # Stock # isn't in the description, but the handle carries it: "w-3194"
    # -> "3194", "w-p5344" -> "P5344". Matches the master sheet's format
    # closely enough to be useful, even though it's a derivation, not a
    # direct read of the Stock# column.
    stock_number = None
    if handle and handle.startswith("w-"):
        stock_number = handle[2:].upper()

    rows = [
        f"<tr><td>Brand</td><td>{escape_html(brand)}</td></tr>",
        f"<tr><td>Model</td><td>{escape_html(model)}</td></tr>",
        f"<tr><td>Reference</td><td>{escape_html(reference)}</td></tr>",
    ]
    if year:
        rows.append(f"<tr><td>Year</td><td>{escape_html(year)}</td></tr>")
    rows.append(f"<tr><td>Condition</td><td>{title_word}</td></tr>")
    if grade:
        rows.append(f"<tr><td>Condition Grade</td><td>{escape_html(grade)}</td></tr>")
    box_yn, paper_yn = yes_no(box), yes_no(paper)
    if box_yn:
        rows.append(f"<tr><td>Box</td><td>{box_yn}</td></tr>")
    if paper_yn:
        rows.append(f"<tr><td>Papers</td><td>{paper_yn}</td></tr>")
    if stock_number:
        rows.append(f"<tr><td>Stock #</td><td>{escape_html(stock_number)}</td></tr>")

    trust = f"<p>{escape_html(TRUST_LINE)}</p>" if TRUST_LINE else ""

    description_html = (
        f"<p>This {title_word} {escape_html(brand)} {escape_html(model)} {escape_html(reference)}"
        f"{year_clause}{opening_clause}.{grade_clause}</p>"
        f"<h3>Specifications</h3><table>{''.join(rows)}</table>{trust}"
    )

    seo_title = f"{brand} {model} {reference} \u2013 {title_word}"
    if len(seo_title) > 60:
        seo_title = truncate_at_word(f"{brand} {model} {reference}", 60)

    grade_suffix = f", {grade.lower()} condition" if grade else ""
    seo_description = truncate_at_word(
        f"Shop this {title_word.lower()} {brand} {model} {reference}{grade_suffix}. "
        f"Authenticated by Laura Milman New York.",
        160,
    )

    tags = list(dict.fromkeys([brand, f"{title_word} Watches", reference, model, "Watches"]))

    metafields = [
        {"namespace": "mm-google-shopping", "key": "condition", "value": mapping["google"], "type": "single_line_text_field"},
        {"namespace": "global", "key": "MPN", "value": reference, "type": "single_line_text_field"},
    ]

    return {
        "title": title, "descriptionHtml": description_html,
        "seoTitle": seo_title, "seoDescription": seo_description,
        "tags": tags, "metafields": metafields,
    }


# --- Shopify -----------------------------------------------------------------
Q_CANDIDATES = """
query($cursor: String) {
  products(first: 50, after: $cursor, query: "product_type:Watch AND status:active") {
    pageInfo { hasNextPage endCursor }
    nodes { id handle title descriptionHtml tags }
  }
}
"""

M_UPDATE = """
mutation($p: ProductUpdateInput!) {
  productUpdate(product: $p) { product { handle } userErrors { field message } }
}
"""


def gql(query, variables=None, tries=5):
    for attempt in range(tries):
        r = SESSION.post(ENDPOINT, json={"query": query, "variables": variables or {}}, timeout=60)
        if r.status_code in (429, 500, 502, 503, 504):
            time.sleep(2 ** attempt); continue
        r.raise_for_status()
        body = r.json()
        if "errors" in body:
            if any((e.get("extensions") or {}).get("code") == "THROTTLED" for e in body["errors"]):
                time.sleep(2 ** attempt); continue
            raise RuntimeError(json.dumps(body["errors"]))
        for payload in (body.get("data") or {}).values():
            if isinstance(payload, dict) and payload.get("userErrors"):
                raise RuntimeError(json.dumps(payload["userErrors"]))
        return body["data"]
    raise RuntimeError("gave up after retries")


def fetch_all_watches():
    cursor, out = None, []
    while True:
        data = gql(Q_CANDIDATES, {"cursor": cursor})["products"]
        out.extend(data["nodes"])
        if not data["pageInfo"]["hasNextPage"]:
            return out
        cursor = data["pageInfo"]["endCursor"]


def merge_tags(existing, schema_tags):
    """Union schema marketing tags with whatever the product already has."""
    return list(dict.fromkeys([*(existing or []), *schema_tags]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--only")
    args = ap.parse_args()

    print("Fetching all active watch products...")
    all_watches = fetch_all_watches()
    print(f"{len(all_watches)} active watches total")

    done = set(json.loads(STATE.read_text())) if STATE.exists() else set()
    needs_review = []
    candidates = []

    for p in all_watches:
        if args.only and p["handle"] != args.only:
            continue
        if p["handle"] in done or already_processed(p["title"]):
            continue
        feed = parse_feed_description(p["descriptionHtml"])
        if feed is None:
            continue  # not the raw bullet-list shape — estate template or placeholder, leave alone
        listing = build_listing(feed, handle=p["handle"])
        if listing is None:
            needs_review.append({**feed, "handle": p["handle"], "current_title": p["title"]})
            continue
        listing["tags"] = merge_tags(p.get("tags"), listing["tags"])
        candidates.append((p, listing))

    if args.limit:
        candidates = candidates[:args.limit]

    print(f"{len(candidates)} ready to update, {len(needs_review)} need manual review")
    if args.dry_run:
        print("DRY RUN\n")
        for p, listing in candidates[:10]:
            print(f"  {p['handle']}: {p['title']!r} -> {listing['title']!r}")
        if len(candidates) > 10:
            print(f"  ... and {len(candidates) - 10} more")

    if needs_review:
        with open(REVIEW, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["handle", "current_title", "brand", "model", "reference", "year", "condition_raw", "accessories"])
            w.writeheader()
            w.writerows(needs_review)
        print(f"Wrote {REVIEW} - {len(needs_review)} rows need a human look (unrecognized condition, e.g. SLIDER)")

    if args.dry_run:
        return

    failures = []
    for n, (p, listing) in enumerate(candidates, 1):
        print(f"[{n}/{len(candidates)}] {p['handle']}: {listing['title']}")
        try:
            gql(M_UPDATE, {"p": {
                "id": p["id"],
                "title": listing["title"],
                "descriptionHtml": listing["descriptionHtml"],
                "seo": {"title": listing["seoTitle"], "description": listing["seoDescription"]},
                "tags": listing["tags"],
                "metafields": listing["metafields"],
            }})
            done.add(p["handle"])
            STATE.write_text(json.dumps(sorted(done), indent=1))
        except Exception as exc:
            print(f"    FAILED: {exc}")
            failures.append((p["handle"], str(exc)))
        time.sleep(0.4)

    print(f"\ndone. {len(candidates) - len(failures)} ok, {len(failures)} failed")
    for h, e in failures:
        print(f"  {h}: {e[:150]}")


if __name__ == "__main__":
    main()
