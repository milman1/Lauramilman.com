/**
 * Laura Milman — API-backed diamond filter.
 * Keeps lm-dfilter visual classes; data from Supabase Edge Function
 * (or App Proxy /apps/diamonds once wired).
 */
(function () {
  'use strict';

  var root = document.getElementById('lm-diamond-api');
  if (!root) return;

  var cfg = {
    apiBase: (root.dataset.apiBase || '').replace(/\/+$/, ''),
    anonKey: root.dataset.anonKey || '',
    kind: root.dataset.kind || 'lab',
    perPage: parseInt(root.dataset.perPage || '24', 10) || 24,
    currency: root.dataset.currency || 'USD',
  };

  /**
   * Homepage mode: show only the filter. View Diamonds opens the stone search
   * (lab-grown or natural) with the choices in the link; nothing loads here.
   */
  var searchOnly = root.dataset.searchOnly === 'true';
  var searchTarget = root.dataset.searchUrl || '/collections/lab-grown-diamonds';

  var state = {
    page: 1,
    sort: 'price_asc',
    requestId: 0,
  };

  /**
   * Ring builder mode (collection template ring-builder, section setting
   * "Ring builder mode"). With a setting chosen (?ring=<handle> from the
   * setting page, or the one kept in sessionStorage lmBuilder), the shape is
   * fixed to the setting's, each card shows the ring total, and Choose goes
   * back to the setting with ?diamond=<stone handle>, where the pairing
   * panel checks fit and availability again before anything is added.
   */
  var builderOn = root.dataset.ringBuilder === 'true' && !searchOnly;
  var builderView = root.dataset.builderView || 'ring-builder';
  var builder = null;
  var HANDLE = /^[a-z0-9][a-z0-9-]{0,99}$/;

  /* Any shape button on the filter, including Ashoka and the other stocked cuts. */
  function acceptedShape(name) {
    var want = String(name || '').trim().toLowerCase();
    if (!want || !form) return '';
    var inputs = form.querySelectorAll('.lm-shape input');
    for (var i = 0; i < inputs.length; i++) {
      var label = inputs[i].closest('.lm-shape');
      var shown = label && label.querySelector('.lm-shape__name');
      var text = shown ? shown.textContent.trim() : '';
      var values = String(inputs[i].value).toLowerCase().split(',');
      if (text.toLowerCase() === want || values.indexOf(want) !== -1) return text || name;
    }
    return '';
  }

  var form = document.getElementById('DiamondFilterForm');
  var resultsEl = document.getElementById('lm-diamond-results');
  var countEl = document.getElementById('lm-diamond-count');
  var pagerEl = document.getElementById('lm-diamond-pager');
  var sortEl = document.getElementById('lm-diamond-sort');

  function money(n) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: cfg.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(n) || 0);
    } catch (e) {
      return '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
    }
  }

  function headers() {
    var h = { Accept: 'application/json' };
    if (cfg.anonKey) {
      h.apikey = cfg.anonKey;
      h.Authorization = 'Bearer ' + cfg.anonKey;
    }
    return h;
  }

  /* A shape from the search URL that has no button yet still filters the API. */
  var pinnedShapes = null;

  function checkedShapes() {
    return Array.prototype.map
      .call(form.querySelectorAll('.lm-shape input:checked'), function (el) {
        return el.value;
      })
      .filter(Boolean);
  }

  function selectedShapes() {
    var checked = checkedShapes();
    if (checked.length) return checked;
    return pinnedShapes ? pinnedShapes.slice() : [];
  }

  /** Grade scale: the grades the shopper ticked, each picked on its own. */
  function selectedGrades(name) {
    return Array.prototype.map
      .call(form.querySelectorAll('[data-scale="' + name + '"] input:checked'), function (el) {
        return el.value;
      })
      .filter(Boolean);
  }

  function rangePair(key) {
    var wrap = form.querySelector('[data-range-key="' + key + '"]');
    if (!wrap) return { min: null, max: null };
    var minEl = wrap.querySelector('[data-range-min]');
    var maxEl = wrap.querySelector('[data-range-max]');
    var min = minEl && minEl.value !== '' ? Number(minEl.value) : null;
    var max = maxEl && maxEl.value !== '' ? Number(maxEl.value) : null;
    return {
      min: Number.isFinite(min) ? min : null,
      max: Number.isFinite(max) ? max : null,
    };
  }

  function buildQuery() {
    var params = new URLSearchParams();
    params.set('kind', cfg.kind);
    params.set('page', String(state.page));
    params.set('per_page', String(cfg.perPage));
    params.set('sort', state.sort);

    var shapes = selectedShapes();
    if (shapes.length) params.set('shapes', shapes.join(','));

    var colors = selectedGrades('color');
    if (colors.length) params.set('colors', colors.join(','));

    var clarities = selectedGrades('clarity');
    if (clarities.length) params.set('clarities', clarities.join(','));

    var cuts = selectedGrades('cut');
    if (cuts.length) params.set('cuts', cuts.join(','));

    var carat = rangePair('carat');
    if (carat.min !== null) params.set('min_carat', String(carat.min));
    if (carat.max !== null) params.set('max_carat', String(carat.max));

    var price = rangePair('price');
    if (price.min !== null) params.set('min_price', String(price.min));
    if (price.max !== null) params.set('max_price', String(price.max));

    return params;
  }

  function syncURL() {
    var params = new URLSearchParams(window.location.search);
    ['shape', 'shapes', 'filter.p.m.custom.diamond_shape', 'color', 'colors', 'clarity', 'clarities', 'cut', 'cuts', 'min_carat', 'max_carat', 'min_price', 'max_price', 'page', 'sort'].forEach(function (key) { params.delete(key); });
    var filters = buildQuery();
    filters.delete('kind');
    filters.delete('per_page');
    filters.forEach(function (value, key) { params.set(key, value); });
    if (state.page === 1) params.delete('page');
    if (state.sort === 'price_asc') params.delete('sort');
    var query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : ''));
  }

  function productHandle(stone) {
    var prefix = stone.kind === 'natural' ? 'nd' : 'lg';
    var ref = String(stone.stock_ref || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return prefix + '-' + ref;
  }

  function cardHtml(stone) {
    var img = (stone.image_urls && stone.image_urls[0]) || '';
    var img2 = (stone.image_urls && stone.image_urls[1]) || '';
    var title =
      stone.carat +
      'ct ' +
      stone.shape +
      ', ' +
      stone.color +
      ' ' +
      stone.clarity +
      (stone.lab ? ' — ' + stone.lab : '');
    var href = '/products/' + productHandle(stone);
    var images =
      (img
        ? '<img class="product-card__image product-card__image--primary" src="' +
          escapeAttr(img) +
          '" alt="' +
          escapeAttr(title) +
          '" width="600" height="600" loading="lazy">'
        : '<div class="product-card__image product-card__image--placeholder" aria-hidden="true"></div>') +
      (img2
        ? '<img class="product-card__image product-card__image--hover" src="' +
          escapeAttr(img2) +
          '" alt="" width="600" height="600" loading="lazy">'
        : '');

    var origin = stone.kind || cfg.kind;
    var labTag =
      origin === 'lab' ? '<span class="lab-grown-tag">Lab Grown Diamond</span>' : '';

    return (
      '<div class="product-card" data-stock="' +
      escapeAttr(stone.stock_ref) +
      '" data-handle="' +
      escapeAttr(href.replace('/products/', '')) +
      '">' +
      '<a href="' +
      escapeAttr(href) +
      '" class="product-card__image-wrapper" aria-label="' +
      escapeAttr(title) +
      '">' +
      images +
      '</a>' +
      '<div class="product-card__content">' +
      labTag +
      '<h3 class="product-card__title"><a href="' +
      escapeAttr(href) +
      '">' +
      escapeHtml(title) +
      '</a></h3>' +
      '<div class="product-card__price"><span>' +
      money(stone.retail_usd) +
      '</span></div>' +
      '<div class="product-card__meta"><span class="product-card__type">' +
      escapeHtml(
        [stone.shape, stone.color, stone.clarity, stone.cut].filter(Boolean).join(' · '),
      ) +
      '</span></div>' +
      (builder ? builderActions(stone, href.replace('/products/', '')) :
      '<div class="lm-stone-card__actions">' +
      '<button type="button" class="lm-stone-card__atc" data-add-handle="' +
      escapeAttr(href.replace('/products/', '')) +
      '">Add to cart</button>' +
      '<button type="button" class="lm-stone-card__buy" data-buy-handle="' +
      escapeAttr(href.replace('/products/', '')) +
      '">Buy now</button>' +
      '<button type="button" class="lm-stone-card__reserve" data-reserve-stone' +
      ' data-reserve-title="' +
      escapeAttr(title) +
      '" data-reserve-url="' +
      escapeAttr(href) +
      '" data-reserve-stock="' +
      escapeAttr(stone.stock_ref || '') +
      '" data-reserve-price="' +
      escapeAttr(money(stone.retail_usd)) +
      '">Ask about this stone</button>' +
      '</div>') +
      '</div></div>'
    );
  }

  function ringPath(extra) {
    var q = '?view=' + encodeURIComponent(builderView);
    if (builder.variant) q += '&variant=' + encodeURIComponent(builder.variant);
    return '/products/' + builder.handle + q + (extra || '');
  }

  function builderActions(stone, handle) {
    var total = builder.price != null ? Number(stone.retail_usd) + builder.price / 100 : null;
    return (
      (total != null
        ? '<p class="lm-stone-card__ring">Ring total ' + money(total) + '</p>'
        : '') +
      '<div class="lm-stone-card__actions">' +
      '<a class="lm-stone-card__choose" href="' +
      escapeAttr(ringPath('&diamond=' + encodeURIComponent(handle) + '#RingPairing')) +
      '">Choose this diamond</a>' +
      '</div>'
    );
  }

  function readBuilder() {
    try {
      return JSON.parse(sessionStorage.getItem('lmBuilder') || 'null');
    } catch (e) {
      return null;
    }
  }

  /** Resolves the chosen setting from ?ring= (checked against the store) or the visit's lmBuilder. */
  function initBuilder() {
    if (!builderOn) return Promise.resolve(null);
    var params = new URLSearchParams(window.location.search);
    var stored = readBuilder();
    var storedRing = stored && stored.ring && HANDLE.test(String(stored.ring.handle || '')) ? stored.ring : null;
    var handle = String(params.get('ring') || (storedRing && storedRing.handle) || '').toLowerCase();
    if (!HANDLE.test(handle)) return Promise.resolve(null);
    var sameRing = storedRing && storedRing.handle === handle;
    var urlShapes = (params.get('shape') || '').split(',').map(acceptedShape).filter(Boolean);
    var shape = sameRing && storedRing.shape ? storedRing.shape : urlShapes.length === 1 ? urlShapes[0] : '';
    if (!shape) return Promise.resolve(null);
    var wanted = String(params.get('variant') || (sameRing && storedRing.variant) || '');
    return fetch('/products/' + handle + '.js', { headers: { Accept: 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (p) {
        if (!p || (p.tags || []).indexOf('ring-setting') === -1) return null;
        var variants = (p.variants || []).filter(function (v) { return v.available; });
        var variant = variants.filter(function (v) { return String(v.id) === wanted; })[0] || variants[0];
        if (!variant) return null;
        var ring = {
          handle: p.handle,
          title: p.title,
          shape: shape,
          image: p.featured_image || '',
          path: '/products/' + p.handle + '?view=' + builderView,
          variant: variant.id,
          options: (variant.options || [])
            .filter(function (v) { return v && v !== 'Default Title'; })
            .map(function (v, i) {
              var name = (p.options || [])[i];
              name = name && name.name ? name.name : String(name || '');
              return /size/i.test(name) ? 'Size ' + v : v;
            })
            .join(' · '),
          price: variant.price,
        };
        var keep = stored && stored.diamond && sameRing ? stored.diamond : null;
        try {
          sessionStorage.setItem('lmBuilder', JSON.stringify({ ring: ring, diamond: keep }));
          document.dispatchEvent(new CustomEvent('lm:builder-change'));
        } catch (e) {}
        return ring;
      })
      .catch(function () { return null; });
  }

  function lockShape() {
    if (!builder || !form) return;
    form.querySelectorAll('.lm-shape input').forEach(function (input) {
      input.checked = input.value === builder.shape;
      input.disabled = true;
      var label = input.closest('.lm-shape');
      if (label) label.classList.toggle('is-active', input.checked);
    });
  }

  function showBuilder() {
    lockShape();
    var group = form && form.querySelector('.lm-dfilter__shapes');
    if (group && !form.querySelector('.lm-shape-lock')) {
      var lock = document.createElement('p');
      lock.className = 'lm-shape-lock';
      lock.textContent = builder.shape + ' only: your setting takes ' + builder.shape.toLowerCase() + ' center stones.';
      group.parentNode.appendChild(lock);
    }
    if (resultsEl && !root.querySelector('.lm-builder-note')) {
      var note = document.createElement('p');
      note.className = 'lm-builder-note';
      note.textContent =
        'Showing ' + builder.shape.toLowerCase() + ' diamonds that fit the ' + builder.title +
        (builder.options ? ' (' + builder.options + ')' : '') +
        '. Each stone shows your ring total.';
      var back = document.createElement('a');
      back.href = ringPath('#RingPairing');
      back.textContent = 'Back to the setting';
      note.appendChild(back);
      var toolbar = root.querySelector('.lm-dfilter__toolbar');
      (toolbar || resultsEl).parentNode.insertBefore(note, toolbar || resultsEl);
    }
    // Switching between natural and lab-grown keeps the setting.
    root.querySelectorAll('.lm-dfilter__origin-btn').forEach(function (a) {
      var u = new URL(a.getAttribute('href'), window.location.origin);
      if (!/^\/collections\/(natural|lab-grown)-diamonds$/.test(u.pathname)) {
        a.hidden = true;
        return;
      }
      u.searchParams.set('view', builderView);
      u.searchParams.set('ring', builder.handle);
      u.searchParams.set('shape', builder.shape);
      if (builder.variant) u.searchParams.set('variant', builder.variant);
      a.setAttribute('href', u.pathname + u.search);
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  function renderPager(totalPages) {
    if (!pagerEl) return;
    if (totalPages <= 1) {
      pagerEl.innerHTML = '';
      return;
    }
    var html = '';
    if (state.page > 1) {
      html +=
        '<button type="button" class="lm-pagination__arrow" data-page="' +
        (state.page - 1) +
        '" aria-label="Previous">‹</button>';
    }
    var start = Math.max(1, state.page - 2);
    var end = Math.min(totalPages, start + 4);
    for (var i = start; i <= end; i++) {
      html +=
        '<button type="button" class="lm-pagination__page' +
        (i === state.page ? ' lm-pagination__page--current' : '') +
        '" data-page="' +
        i +
        '">' +
        i +
        '</button>';
    }
    if (state.page < totalPages) {
      html +=
        '<button type="button" class="lm-pagination__arrow" data-page="' +
        (state.page + 1) +
        '" aria-label="Next">›</button>';
    }
    pagerEl.innerHTML = '<nav class="lm-pagination" aria-label="Results pages">' + html + '</nav>';
  }

  function narrowedRange(key) {
    var wrap = form.querySelector('[data-range-key="' + key + '"]');
    if (!wrap) return null;
    var pair = rangePair(key);
    var floor = Number(wrap.dataset.floor);
    var ceil = Number(wrap.dataset.ceil);
    if (pair.min === null || pair.max === null) return null;
    if (pair.min <= floor && pair.max >= ceil) return null;
    return pair;
  }

  function resultSummary(total) {
    var carat = narrowedRange('carat');
    var labels = selectedShapes().map(function (value) {
      return window.LMNYDiamondQuery ? window.LMNYDiamondQuery.shapeLabel(value) : value;
    });
    var hasGrades = selectedGrades('color').length || selectedGrades('clarity').length;
    if (!labels.length && !carat && !hasGrades) {
      return (total || 0).toLocaleString('en-US') + ' stone' + (total === 1 ? '' : 's');
    }
    if (!window.LMNYDiamondQuery) {
      return (total || 0).toLocaleString('en-US') + ' stone' + (total === 1 ? '' : 's');
    }
    return window.LMNYDiamondQuery.diamondResultSummary({
      total: total,
      kind: cfg.kind,
      shapes: labels,
      minCarat: carat ? carat.min : null,
      maxCarat: carat ? carat.max : null,
      colors: selectedGrades('color'),
      clarities: selectedGrades('clarity'),
    });
  }

  async function load() {
    if (searchOnly || !cfg.apiBase) return;
    var requestId = ++state.requestId;
    syncURL();
    if (resultsEl) {
      resultsEl.classList.add('is-loading');
      resultsEl.innerHTML = '<p>Loading diamonds matching your selection…</p>';
    }
    if (countEl) countEl.textContent = 'Loading diamonds…';
    if (pagerEl) pagerEl.innerHTML = '';
    try {
      var url = cfg.apiBase + '?' + buildQuery().toString();
      var res = await fetch(url, { headers: headers() });
      var data = await res.json();
      if (requestId !== state.requestId) return;
      if (!res.ok) throw new Error(data.error || 'Request failed');
      if (countEl) countEl.textContent = resultSummary(data.total || 0);
      if (resultsEl) {
        if (!data.stones || !data.stones.length) {
          resultsEl.innerHTML =
            '<div class="lm-dfilter__empty"><p class="lm-dfilter__empty-title">No stones match</p>' +
            '<p class="lm-dfilter__empty-copy">Widen a grade or carat range and try again.</p></div>';
        } else {
          resultsEl.innerHTML =
            '<div class="products-grid lm-dfilter__results">' +
            data.stones.map(cardHtml).join('') +
            '</div>';
        }
      }
      renderPager(data.total_pages || 1);
    } catch (err) {
      if (requestId !== state.requestId) return;
      if (countEl) countEl.textContent = 'Diamonds unavailable';
      if (pagerEl) pagerEl.innerHTML = '';
      if (resultsEl) {
        resultsEl.innerHTML =
          '<div class="lm-dfilter__empty"><p class="lm-dfilter__empty-title">Unable to load stones</p>' +
          '<p class="lm-dfilter__empty-copy">' +
          'Please try again or browse the diamond collections below.' +
          '</p></div>';
      }
    } finally {
      if (requestId === state.requestId && resultsEl) resultsEl.classList.remove('is-loading');
    }
  }

  /* ── Grade scale / shape / range paint (same UX as facet version) ── */
  function wireScales() {
    form.querySelectorAll('[data-scale]').forEach(function (scale) {
      /* Reset calls this again; repaint instead of adding a second click
         handler, which would toggle each grade twice and cancel out. */
      if (scale.lmPaint) return scale.lmPaint();
      var stops = Array.prototype.slice.call(scale.querySelectorAll('[data-grade]'));
      if (!stops.length) return;
      var fill = scale.querySelector('[data-scale-fill]');
      var hint = scale.parentNode.querySelector('[data-scale-hint]');
      var noun = hint ? hint.textContent : '';

      function paint() {
        var picked = [];
        stops.forEach(function (stop) {
          var on = stop.querySelector('input').checked;
          stop.classList.toggle('is-in-range', on);
          stop.classList.toggle('is-floor', on);
          if (on) picked.push(stop.dataset.grade);
        });
        if (fill) {
          fill.style.left = '0%';
          fill.style.right = '100%';
        }
        if (hint) {
          hint.textContent = picked.length ? picked.join(', ') : noun;
        }
      }

      stops.forEach(function (stop) {
        stop.addEventListener('click', function (event) {
          event.preventDefault();
          var input = stop.querySelector('input');
          input.checked = !input.checked;
          paint();
        });
      });
      scale.lmPaint = paint;
      paint();
    });
  }

  /**
   * Links such as ?shape=Oval (or ?shape=Oval,Pear) pre-select shapes. The
   * homepage search also sends color, clarity, cut (comma lists) and
   * min_carat / max_carat / min_price / max_price.
   */
  function hydrateShapesFromURL() {
    var params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (e) {
      return;
    }
    function list(key) {
      return params.getAll(key).join(',').split(',').map(function (v) { return v.trim().toLowerCase(); }).filter(Boolean);
    }
    // Landing pages (a collection with a preset) open already filtered to their
    // shape and size, unless the link itself carries filters.
    var urlHasFilters = ['shape', 'shapes', 'filter.p.m.custom.diamond_shape', 'color', 'colors', 'clarity', 'clarities', 'cut', 'cuts', 'min_carat', 'max_carat', 'min_price', 'max_price']
      .some(function (key) { return params.has(key); });
    if (!urlHasFilters) {
      var presetShape = root.dataset.presetShape || '';
      if (presetShape) params.set('shape', presetShape);
      if (root.dataset.presetMinCarat) params.set('min_carat', root.dataset.presetMinCarat);
      if (root.dataset.presetMaxCarat) params.set('max_carat', root.dataset.presetMaxCarat);
    }
    var page = Number(params.get('page'));
    if (Number.isInteger(page) && page > 0) state.page = page;
    var sort = params.get('sort');
    if (['price_asc', 'price_desc', 'carat_asc', 'carat_desc'].indexOf(sort) !== -1) {
      state.sort = sort;
      if (sortEl) sortEl.value = sort;
    }
    // Older links (ring pages) use Shopify's filter.p.m.custom.diamond_shape.
    var shapes = list('shape').concat(list('shapes'), list('filter.p.m.custom.diamond_shape'));
    var matchedShape = false;
    form.querySelectorAll('.lm-shape input').forEach(function (input) {
      var values = String(input.value).toLowerCase().split(',');
      var on = values.some(function (value) { return shapes.indexOf(value.trim()) !== -1; });
      if (on) {
        input.checked = true;
        matchedShape = true;
      }
    });
    if (!matchedShape && shapes.length && window.LMNYDiamondQuery) {
      pinnedShapes = window.LMNYDiamondQuery.queryShapes(shapes);
    }
    ['color', 'clarity', 'cut'].forEach(function (name) {
      var plural = { color: 'colors', clarity: 'clarities', cut: 'cuts' }[name];
      var wanted = list(name).concat(list(plural));
      if (!wanted.length) return;
      form.querySelectorAll('[data-scale="' + name + '"] input').forEach(function (input) {
        if (wanted.indexOf(String(input.value).toLowerCase()) !== -1) input.checked = true;
      });
    });
    ['carat', 'price'].forEach(function (key) {
      var wrap = form.querySelector('[data-range-key="' + key + '"]');
      if (!wrap) return;
      var min = Number(params.get('min_' + key));
      var max = Number(params.get('max_' + key));
      var minEl = wrap.querySelector('[data-range-min]');
      var maxEl = wrap.querySelector('[data-range-max]');
      if (params.get('min_' + key) && Number.isFinite(min) && minEl) minEl.value = String(min);
      if (params.get('max_' + key) && Number.isFinite(max) && maxEl) maxEl.value = String(max);
    });
  }

  function wireShapes() {
    form.querySelectorAll('.lm-shape').forEach(function (label) {
      var input = label.querySelector('input');
      if (!input) return;
      label.classList.toggle('is-active', input.checked);
      input.addEventListener('change', function () {
        pinnedShapes = null;
        label.classList.toggle('is-active', input.checked);
      });
    });
  }

  function wireRanges() {
    form.querySelectorAll('[data-range]').forEach(function (wrap) {
      var minEl = wrap.querySelector('[data-range-min]');
      var maxEl = wrap.querySelector('[data-range-max]');
      var fill = wrap.querySelector('[data-range-fill]');
      var floor = Number(wrap.dataset.floor || 0);
      var ceil = Number(wrap.dataset.ceil || 100);
      function paint() {
        if (!fill || !minEl || !maxEl) return;
        var min = Number(minEl.value);
        var max = Number(maxEl.value);
        if (!Number.isFinite(min)) min = floor;
        if (!Number.isFinite(max)) max = ceil;
        var span = ceil - floor || 1;
        var left = Math.max(0, Math.min(100, ((min - floor) / span) * 100));
        var right = Math.max(0, Math.min(100, ((max - floor) / span) * 100));
        fill.style.left = Math.min(left, right) + '%';
        fill.style.right = (100 - Math.max(left, right)) + '%';
      }
      if (minEl) minEl.addEventListener('input', paint);
      if (maxEl) maxEl.addEventListener('input', paint);
      paint();
    });
  }

  /** Link to the stone search carrying only the choices that differ from "any". */
  function goToSearch() {
    var params = new URLSearchParams();
    var shapes = selectedShapes();
    if (shapes.length) params.set('shape', shapes.join(','));
    ['color', 'clarity', 'cut'].forEach(function (name) {
      var picked = selectedGrades(name);
      if (picked.length) params.set(name, picked.join(','));
    });
    ['carat', 'price'].forEach(function (key) {
      var wrap = form.querySelector('[data-range-key="' + key + '"]');
      if (!wrap) return;
      var floor = Number(wrap.dataset.floor);
      var ceil = Number(wrap.dataset.ceil);
      var pair = rangePair(key);
      if (pair.min !== null && pair.min > floor) params.set('min_' + key, String(pair.min));
      if (pair.max !== null && pair.max < ceil) params.set('max_' + key, String(pair.max));
    });
    var query = params.toString();
    window.location.href = searchTarget + (query ? '?' + query : '');
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (searchOnly) {
        goToSearch();
        return;
      }
      state.page = 1;
      load();
    });
    if (searchOnly) {
      root.querySelectorAll('.lm-dfilter__origin-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          searchTarget = btn.getAttribute('href') || searchTarget;
          root.querySelectorAll('.lm-dfilter__origin-btn').forEach(function (other) {
            var on = other === btn;
            other.classList.toggle('is-active', on);
            if (on) other.setAttribute('aria-current', 'page');
            else other.removeAttribute('aria-current');
          });
        });
      });
    }
    var reset = form.querySelector('.lm-dfilter__reset');
    if (reset) {
      reset.addEventListener('click', function (e) {
        e.preventDefault();
        form.reset();
        pinnedShapes = null;
        form.querySelectorAll('.lm-shape').forEach(function (l) {
          l.classList.remove('is-active');
        });
        lockShape();
        wireScales();
        wireRanges();
        state.page = 1;
        load();
      });
    }
    hydrateShapesFromURL();
    wireScales();
    wireShapes();
    wireRanges();
  }

  if (sortEl) {
    sortEl.addEventListener('change', function () {
      state.sort = sortEl.value || 'price_asc';
      state.page = 1;
      load();
    });
  }

  if (pagerEl) {
    pagerEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-page]');
      if (!btn) return;
      state.page = parseInt(btn.getAttribute('data-page'), 10) || 1;
      load();
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (resultsEl) {
    resultsEl.addEventListener('click', function (e) {
      var buyBtn = e.target.closest('[data-buy-handle], [data-add-handle]');
      if (!buyBtn) return;
      e.preventDefault();
      var handle = buyBtn.getAttribute('data-buy-handle') || buyBtn.getAttribute('data-add-handle');
      var checkout = buyBtn.hasAttribute('data-buy-handle');
      if (!handle) return;
      var original = buyBtn.textContent;
      buyBtn.disabled = true;
      buyBtn.textContent = '…';
      fetch('/products/' + handle + '.js', { headers: { Accept: 'application/json' } })
        .then(function (res) {
          if (!res.ok) throw new Error('Stone is not available to purchase yet');
          return res.json();
        })
        .then(function (product) {
          var variant = (product.variants || []).filter(function (v) {
            return v.available !== false;
          })[0];
          if (!variant || !variant.id) throw new Error('This stone cannot be added to cart');
          if (typeof window.lmAddToCart === 'function') {
            return window.lmAddToCart(variant.id, { checkout: checkout });
          }
          return fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ id: variant.id, quantity: 1 }),
          }).then(function (res) {
            return res.json().then(function (data) {
              if (!res.ok || data.status) throw new Error(data.description || 'Could not add to cart');
              if (checkout) window.location.href = '/checkout';
              return data;
            });
          });
        })
        .then(function () {
          if (checkout) return;
          buyBtn.textContent = '✓ Added';
          setTimeout(function () {
            buyBtn.textContent = original;
            buyBtn.disabled = false;
          }, 1800);
        })
        .catch(function (err) {
          buyBtn.textContent = err.message || 'Unavailable';
          setTimeout(function () {
            buyBtn.textContent = original;
            buyBtn.disabled = false;
          }, 2200);
        });
    });
  }

  initBuilder().then(function (ring) {
    builder = ring;
    if (builder) showBuilder();
    load();
  });
})();
