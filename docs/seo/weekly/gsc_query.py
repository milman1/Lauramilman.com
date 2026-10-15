#!/usr/bin/env python3
"""Read-only Google Search Console queries for the weekly site pulse.

Credentials come from the environment, never from the repo:
  GSC_SERVICE_ACCOUNT_JSON  the service account key file's contents, or
  GSC_SERVICE_ACCOUNT_FILE  a path to that file outside the repo.
The token is requested with the read-only scope only, and the key is never
printed.

  python3 docs/seo/weekly/gsc_query.py sites
  python3 docs/seo/weekly/gsc_query.py query --days 28 --dims query --rows 25
  python3 docs/seo/weekly/gsc_query.py query --days 28 --dims page --page-contains /products/lg-
  python3 docs/seo/weekly/gsc_query.py query --days 90 --dims date

Search Console data runs about 3 days behind, so the window ends 3 days ago.
"""
import argparse
import base64
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

SITE = "https://www.lauramilman.com/"
SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
TOKEN_URL = "https://oauth2.googleapis.com/token"
API = "https://searchconsole.googleapis.com/webmasters/v3"


def load_key():
    raw = os.environ.get("GSC_SERVICE_ACCOUNT_JSON", "").strip()
    path = os.environ.get("GSC_SERVICE_ACCOUNT_FILE", "").strip()
    if not raw and path:
        with open(path, encoding="utf-8") as f:
            raw = f.read()
    if not raw:
        sys.exit("No credentials: set GSC_SERVICE_ACCOUNT_JSON (key contents) or GSC_SERVICE_ACCOUNT_FILE (path).")
    try:
        key = json.loads(raw)
    except json.JSONDecodeError:
        sys.exit("GSC_SERVICE_ACCOUNT_JSON is not valid JSON (paste the whole key file).")
    for field in ("client_email", "private_key", "token_uri"):
        if not key.get(field):
            sys.exit(f"Key is missing '{field}'; is this a service account JSON key?")
    return key


def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def access_token(key):
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    now = int(time.time())
    header = b64url(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claims = b64url(json.dumps({
        "iss": key["client_email"], "scope": SCOPE, "aud": TOKEN_URL,
        "iat": now, "exp": now + 3600,
    }).encode())
    signing_input = f"{header}.{claims}".encode()
    private_key = serialization.load_pem_private_key(key["private_key"].encode(), password=None)
    signature = b64url(private_key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256()))
    body = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": f"{header}.{claims}.{signature}",
    }).encode()
    resp = call(TOKEN_URL, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
    return resp["access_token"]


def call(url, data=None, headers=None, token=None):
    headers = dict(headers or {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:500]
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
    args = ap.parse_args()

    key = load_key()
    token = access_token(key)
    if args.cmd == "sites":
        sites = call(f"{API}/sites", token=token).get("siteEntry", [])
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
    url = f"{API}/sites/{urllib.parse.quote(SITE, safe='')}/searchAnalytics/query"
    res = call(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, token=token)
    print(json.dumps({"site": SITE, "startDate": body["startDate"], "endDate": body["endDate"],
                      "dimensions": body["dimensions"], "rows": res.get("rows", [])}, indent=1))


if __name__ == "__main__":
    main()
