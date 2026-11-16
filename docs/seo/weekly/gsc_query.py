#!/usr/bin/env python3
"""Read-only Google Search Console queries for the weekly site pulse.

No key file, and no secrets in the repo. The environment holds a GCP service
account as a network secret; Claude's egress proxy swaps the placeholder bearer
token below for a short-lived Google access token on requests to googleapis.com
(the same mechanism gcloud and bq use). Use the read-only scope when creating
the secret: https://www.googleapis.com/auth/webmasters.readonly

The placeholder is read from CLOUDSDK_AUTH_ACCESS_TOKEN (or GSC_ACCESS_TOKEN)
and is never printed.

  python3 docs/seo/weekly/gsc_query.py sites
  python3 docs/seo/weekly/gsc_query.py query --days 28 --dims query --rows 25
  python3 docs/seo/weekly/gsc_query.py query --days 28 --dims page --page-contains /products/lg-
  python3 docs/seo/weekly/gsc_query.py query --days 90 --dims date
  python3 docs/seo/weekly/gsc_query.py inspect https://www.lauramilman.com/ https://www.lauramilman.com/products/...

Search Console data runs about 3 days behind, so the window ends 3 days ago.
"""
import argparse
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

# The URL-prefix property is the only one (no Domain property exists).
# Known limit, 2026-10-15: Search Analytics puts the property id in the URL
# path, and this environment's egress proxy does not pass an encoded "/"
# through (double-encoded is refused; single-encoded reaches Google altered
# and 404s). URL Inspection takes the site in the request body and works.
SITE = os.environ.get("GSC_SITE", "https://www.lauramilman.com/")
ANALYTICS_SITE = os.environ.get("GSC_ANALYTICS_SITE", SITE)
API = "https://searchconsole.googleapis.com/webmasters/v3"
INSPECT_API = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect"


def bearer():
    token = (os.environ.get("GSC_ACCESS_TOKEN") or os.environ.get("CLOUDSDK_AUTH_ACCESS_TOKEN") or "").strip()
    if not token:
        sys.exit("No access token placeholder in the environment (CLOUDSDK_AUTH_ACCESS_TOKEN / GSC_ACCESS_TOKEN). "
                 "Is the GCP service-account network secret set for this environment?")
    return token


def call(url, body=None):
    headers = {"Authorization": f"Bearer {bearer()}"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:400]
        sys.exit(f"HTTP {e.code} from {url.split('?')[0]}: {detail}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("sites")
    q = sub.add_parser("query")
    q.add_argument("--days", type=int, default=28)
    q.add_argument("--dims", default="query", help="comma list: query,page,date,device,country")
    q.add_argument("--rows", type=int, default=25)
    q.add_argument("--page-contains", default="")
    q.add_argument("--query-contains", default="")
    i = sub.add_parser("inspect", help="index status per URL (URL Inspection API, 2,000 a day)")
    i.add_argument("urls", nargs="+")
    args = ap.parse_args()

    if args.cmd == "inspect":
        out = []
        for u in args.urls:
            r = call(INSPECT_API, {"inspectionUrl": u, "siteUrl": SITE}).get("inspectionResult", {})
            st = r.get("indexStatusResult", {})
            out.append({"url": u, "verdict": st.get("verdict"), "coverageState": st.get("coverageState"),
                        "lastCrawlTime": st.get("lastCrawlTime"), "googleCanonical": st.get("googleCanonical"),
                        "robotsTxtState": st.get("robotsTxtState"), "pageFetchState": st.get("pageFetchState")})
        print(json.dumps(out, indent=1))
        return

    if args.cmd == "sites":
        sites = call(f"{API}/sites").get("siteEntry", [])
        print(json.dumps([{"siteUrl": s["siteUrl"], "permission": s["permissionLevel"]} for s in sites], indent=1))
        return

    end = dt.date.today() - dt.timedelta(days=3)
    start = end - dt.timedelta(days=args.days - 1)
    body = {
        "startDate": start.isoformat(), "endDate": end.isoformat(),
        "dimensions": [d.strip() for d in args.dims.split(",") if d.strip()],
        "rowLimit": args.rows, "dataState": "final",
    }
    filters = []
    if args.page_contains:
        filters.append({"dimension": "page", "operator": "contains", "expression": args.page_contains})
    if args.query_contains:
        filters.append({"dimension": "query", "operator": "contains", "expression": args.query_contains})
    if filters:
        body["dimensionFilterGroups"] = [{"filters": filters}]
    url = f"{API}/sites/{urllib.parse.quote(ANALYTICS_SITE, safe='')}/searchAnalytics/query"
    try:
        res = call(url, body)
    except SystemExit as e:
        if "HTTP 404" in str(e) and "/" in ANALYTICS_SITE:
            sys.exit("Search Analytics unavailable here: the proxy does not pass the encoded '/' in the property id "
                     f"{ANALYTICS_SITE!r}, so Google returns 404. Use the Drive export for queries and pages; "
                     "URL Inspection ('inspect') still works.")
        raise
    print(json.dumps({"site": ANALYTICS_SITE, "startDate": body["startDate"], "endDate": body["endDate"],
                      "dimensions": body["dimensions"], "rows": res.get("rows", [])}, indent=1))


if __name__ == "__main__":
    main()
