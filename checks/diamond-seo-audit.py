#!/usr/bin/env python3
"""Read-only live regression checks; exits nonzero on confirmed failures."""
import argparse
import datetime
import json
import re
import urllib.request
from html import unescape
from html.parser import HTMLParser


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.canonical = None
        self.robots = ''
        self.links = []
        self.schemas = []
        self.ld = None
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonical = a.get('href')
        if tag == 'meta' and a.get('name') == 'robots':
            self.robots = a.get('content', '')
        if tag == 'a':
            self.links.append(a.get('href', ''))
        if tag == 'script' and a.get('type') == 'application/ld+json':
            self.ld = ''

    def handle_data(self, data):
        if self.ld is not None:
            self.ld += data

    def handle_endtag(self, tag):
        if tag == 'script' and self.ld is not None:
            self.schemas.append(json.loads(self.ld))
            self.ld = None


def fetch(url, agent='LMNY-SEO-regression/1.0'):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': agent}), timeout=30) as r:
        return r.status, r.url, r.headers, r.read().decode()


def audit(base):
    results = []

    def check(name, fn):
        try:
            detail = fn()
            results.append({'check': name, 'status': 'PASS', 'detail': detail})
        except Exception as e:
            results.append({'check': name, 'status': 'FAIL', 'detail': str(e)})

    def filters(query):
        _, _, _, html = fetch(base + '/collections/lab-grown-diamonds?' + query)
        page = Page(html)
        assert page.canonical == base + '/collections/lab-grown-diamonds', page.canonical
        host = html.split('id="lm-diamond-results"', 1)[1].split('id="lm-diamond-pager"', 1)[0]
        assert not re.search(r'/products/(lg|nd)-', host), 'Unfiltered product links in API fallback'
        assert not any(s.get('@type') == 'CollectionPage' and 'mainEntity' in s for s in page.schemas), 'Unfiltered ItemList'
        return 'No unrelated fallback products or ItemList; canonical is the search collection'

    for query in ['shape=Oval', 'min_carat=2&max_carat=3', 'shape=Oval&min_carat=2&max_carat=2.49']:
        check('crawlable filter ' + query, lambda q=query: filters(q))

    def api_inventory():
        _, _, _, html = fetch(base + '/collections/lab-grown-diamonds')
        endpoint = unescape(re.search(r'data-api-base="([^"]+)"', html)[1])
        key = unescape(re.search(r'data-anon-key="([^"]+)"', html)[1])
        request = urllib.request.Request(endpoint + '?kind=lab&shapes=Oval&min_carat=2&max_carat=2.49&per_page=12', headers={'apikey': key})
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.load(response)
        assert data['stones'], 'No representative inventory returned'
        for stone in data['stones']:
            assert stone['shape'] == 'Oval' and 2 <= stone['carat'] <= 2.49, stone['stock_ref']
        for stone in data['stones'][:3]:
            handle = 'lg-' + re.sub(r'[^a-z0-9]+', '-', stone['stock_ref'].lower()).strip('-')
            _, _, _, body = fetch(base + '/products/' + handle + '.js')
            variant = json.loads(body)['variants'][0]
            assert variant['available'], 'API lists an unavailable Shopify stone: ' + handle
            assert round(stone['retail_usd'] * 100) == variant['price'], 'API/Shopify price mismatch: ' + handle
        return {'shape_and_range_matches': len(data['stones']), 'price_and_availability_matches': min(3, len(data['stones']))}

    check('API filters and Shopify price/availability consistency', api_inventory)

    def landing():
        url = base + '/collections/2-carat-oval-lab-grown-diamonds'
        _, final, headers, html = fetch(url)
        p = Page(html)
        assert final == url and p.canonical == url, 'Landing URL/canonical mismatch'
        assert 'noindex' not in p.robots + headers.get('X-Robots-Tag', ''), 'Landing noindexed'
        handles = list(dict.fromkeys(re.findall(r'/products/(lg-[\w-]+)', html)))
        assert handles, 'No crawlable stones'
        assert 'id="lm-diamond-api"' not in html, 'Unrestricted API replaces landing inventory'
        for handle in handles:
            _, _, _, body = fetch(base + '/products/' + handle)
            product = next(s for s in Page(body).schemas if s.get('@type') == 'Product')
            props = {x['name']: x['value'] for x in product['additionalProperty']}
            assert props.get('Diamond shape') == 'Oval', (handle, props)
            assert 2 <= float(props['Carat weight']) < 2.5, (handle, props)
        return {'matching_stones_on_first_page': len(handles), 'range': '2.00–2.49 ct'}

    check('indexable supplier-backed landing', landing)

    def product(handle):
        url = base + '/products/' + handle
        _, _, _, html = fetch(url)
        page = Page(html)
        schemas = [s for s in page.schemas if s.get('@type') == 'Product']
        assert len(schemas) == 1, 'Expected one Product entity'
        s = schemas[0]
        _, _, _, body = fetch(url + '.js')
        shop = json.loads(body)
        v = shop['variants'][0]
        offer = s['offers'][0] if isinstance(s['offers'], list) else s['offers']
        assert s['name'] and s['image'] and s['sku'] == v['sku'], 'Missing identity/image/SKU'
        assert s['url'] == url and page.canonical == url, 'Product URL mismatch'
        assert offer['@type'] == 'Offer' and offer['url'].startswith(url), 'Invalid Offer'
        assert offer['priceCurrency'] == 'USD', 'Currency is not USD'
        assert round(float(offer['price']) * 100) == v['price'] > 0, 'Price mismatch'
        assert offer['availability'] == 'https://schema.org/' + ('InStock' if v['available'] else 'OutOfStock'), 'Availability mismatch'
        assert 'aggregateRating' not in s and 'review' not in s, 'Review provenance needs manual verification'
        assert s.get('additionalProperty'), 'Missing specifications'
        assert 'UNCERTIFIED Certified' not in s['name'], 'False certificate claim'
        with urllib.request.urlopen(s['image'][0], timeout=30) as image:
            assert image.status == 200 and image.headers.get('Content-Type', '').startswith('image/')
        return {'handle': handle, 'sku': v['sku'], 'price': offer['price'], 'currency': 'USD', 'availability': offer['availability']}

    for handle in ['lg-416419', 'lg-929885', 'lg-100742831311']:
        check('Product/Offer ' + handle, lambda h=handle: product(h))

    def crawler(agent):
        for path in ['/robots.txt', '/sitemap.xml', '/collections/lab-grown-diamonds?shape=Oval', '/products/lg-100742831311']:
            status, _, headers, body = fetch(base + path, agent)
            assert status == 200 and 'noindex' not in headers.get('X-Robots-Tag', ''), (path, status)
            assert body, path
        return 'HTTP 200 for robots, sitemap, filter and product (UA simulation, not verified bot IP)'

    for agent in ['Googlebot', 'OAI-SearchBot']:
        check('crawler access ' + agent, lambda a=agent: crawler(a))
    return {'checked_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'base': base, 'results': results}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='https://www.lauramilman.com')
    parser.add_argument('--output')
    args = parser.parse_args()
    report = audit(args.base.rstrip('/'))
    data = json.dumps(report, indent=2)
    if args.output:
        with open(args.output, 'w') as f:
            f.write(data + '\n')
    print(data)
    raise SystemExit(any(r['status'] == 'FAIL' for r in report['results']))
