(() => {
  function productHandle(stone) {
    const ref = String(stone.stock_ref ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return ref ? `${stone.kind === 'natural' ? 'nd' : 'lg'}-${ref}` : '';
  }

  async function json(url, headers = { Accept: 'application/json' }) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout?.(8000) });
    if (!response.ok) throw new Error('Could not load diamond');
    return response.json();
  }

  function link(title, href) {
    if (!href) return title || '—';
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.textContent = title;
    return anchor;
  }

  function reportLink(stone) {
    const label = [stone.lab, stone.cert_number].filter(Boolean).join(' ');
    try {
      const url = new URL(stone.cert_url);
      if (url.protocol === 'https:') return link(label || 'View report', url.href);
    } catch (_) {}
    return label || '—';
  }

  function render(target, selected, alternatives, currency) {
    const table = document.createElement('table');
    table.setAttribute('aria-label', 'Loose diamond comparison');
    const header = table.createTHead().insertRow();
    for (const heading of ['Diamond', 'Price', 'Color and clarity', 'Dimensions', 'Grading report']) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = heading;
      header.append(cell);
    }
    const money = new Intl.NumberFormat(document.documentElement.lang || 'en-US', { style: 'currency', currency });
    const body = table.createTBody();
    for (const stone of [selected, ...alternatives]) {
      const row = body.insertRow();
      const name = document.createElement('th');
      name.scope = 'row';
      name.append(link(stone.title, stone.href));
      if (stone === selected) name.append(document.createElement('br'), 'Selected diamond');
      else if (stone.video_urls?.length) name.append(document.createElement('br'), 'Video on product page');
      row.append(name);
      for (const value of [money.format(stone.price / 100), [stone.color, stone.clarity].filter(Boolean).join(' / '), stone.measurements, reportLink(stone)]) {
        row.insertCell().append(value || '—');
      }
    }
    target.replaceChildren(table);
    target.hidden = false;
  }

  async function alternativesFor(data) {
    const api = window.LMNYDiamondQuery;
    if (!api) throw new Error('Diamond search unavailable');
    const price = Number(data.price);
    const carat = Number(data.carat);
    const minPrice = price * 0.75;
    const maxPrice = price * 1.25;
    const query = new URLSearchParams({ kind: data.kind, shape: data.shape, per_page: '48',
      min_carat: (carat * 0.8).toFixed(2), max_carat: (carat * 1.2).toFixed(2) });
    if (data.currency === 'USD') {
      query.set('min_price', String(minPrice / 100));
      query.set('max_price', String(maxPrice / 100));
    }
    const headers = { Accept: 'application/json', apikey: api.DIAMOND_ANON_KEY, Authorization: `Bearer ${api.DIAMOND_ANON_KEY}` };
    const { stones } = await json(`${api.DIAMOND_API}?${query}`, headers);
    const candidates = new Map();
    for (const stone of stones) {
      if (stone.kind !== data.kind || stone.shape?.toLowerCase() !== data.shape.toLowerCase()) continue;
      const handle = productHandle(stone);
      if (handle && handle !== data.handle) candidates.set(handle, stone);
    }
    const ranked = [...candidates].sort(([, a], [, b]) => {
      const sizeGap = Math.abs(a.carat - carat) - Math.abs(b.carat - carat);
      if (data.currency !== 'USD') return sizeGap;
      return Math.abs(a.retail_usd * 100 - price) - Math.abs(b.retail_usd * 100 - price) || sizeGap;
    });

    const root = data.root.replace(/\/?$/, '/');
    const matches = [];
    for (let offset = 0; offset < Math.min(ranked.length, 12) && matches.length < 3; offset += 6) {
      const batch = await Promise.allSettled(ranked.slice(offset, offset + 6).map(async ([handle, stone]) => {
        const href = `${root}products/${handle}`;
        const product = await json(`${href}.js`);
        const variant = product.variants?.find(item => item.available && item.price >= minPrice && item.price <= maxPrice);
        if (product.handle === handle && variant) return { ...stone, href, title: product.title, price: variant.price };
      }));
      matches.push(...batch.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []));
    }
    return matches.sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price)).slice(0, 3);
  }

  function initialize() {
    for (const details of document.querySelectorAll('[data-diamond-comparison]:not([data-comparison-ready])')) {
      details.dataset.comparisonReady = '';
      const status = details.querySelector('[data-comparison-status]');
      const results = details.querySelector('[data-comparison-results]');
      const data = details.dataset;
      let loaded = false;
      details.addEventListener('toggle', async () => {
        if (!details.open || loaded) return;
        loaded = true;
        status.textContent = 'Checking availability of similar diamonds…';
        const selected = { ...data, price: Number(data.price), cert_url: data.report };
        try {
          const matches = await alternativesFor(data);
          render(results, selected, matches, data.currency);
          status.textContent = matches.length ? '' : 'No similar in-stock diamonds were found in this price range.';
        } catch (_) {
          loaded = false;
          status.textContent = 'Similar diamonds could not be loaded. Browse by shape below or reopen the comparison to try again.';
        }
      });
    }
  }

  initialize();
  document.addEventListener('shopify:section:load', initialize);
})();
