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

  var state = {
    page: 1,
    sort: 'price_asc',
    loading: false,
  };

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
        maximumFractionDigits: 0,
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

  function selectedShapes() {
    return Array.prototype.map
      .call(form.querySelectorAll('.lm-shape input:checked'), function (el) {
        return el.value;
      })
      .filter(Boolean);
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
      '<div class="lm-stone-card__actions">' +
      '<button type="button" class="lm-stone-card__atc" data-add-handle="' +
      escapeAttr(href.replace('/products/', '')) +
      '">Add to cart</button>' +
      '<button type="button" class="lm-stone-card__buy" data-buy-handle="' +
      escapeAttr(href.replace('/products/', '')) +
      '">Buy now</button>' +
      '</div>' +
      '</div></div>'
    );
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

  async function load() {
    if (!cfg.apiBase || state.loading) return;
    state.loading = true;
    if (resultsEl) resultsEl.classList.add('is-loading');
    try {
      var url = cfg.apiBase + '?' + buildQuery().toString();
      var res = await fetch(url, { headers: headers() });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      if (countEl) {
        countEl.textContent =
          (data.total || 0).toLocaleString('en-US') +
          ' stone' +
          (data.total === 1 ? '' : 's');
      }
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
      if (resultsEl) {
        resultsEl.innerHTML =
          '<div class="lm-dfilter__empty"><p class="lm-dfilter__empty-title">Unable to load stones</p>' +
          '<p class="lm-dfilter__empty-copy">' +
          escapeHtml(err.message || String(err)) +
          '</p></div>';
      }
    } finally {
      state.loading = false;
      if (resultsEl) resultsEl.classList.remove('is-loading');
    }
  }

  /* ── Grade scale / shape / range paint (same UX as facet version) ── */
  function wireScales() {
    form.querySelectorAll('[data-scale]').forEach(function (scale) {
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
      paint();
    });
  }

  /** Links such as ?shape=Oval (or ?shape=Oval,Pear) pre-select shapes. */
  function hydrateShapesFromURL() {
    var raw;
    try {
      raw = new URLSearchParams(window.location.search).get('shape');
    } catch (e) {
      return;
    }
    if (!raw) return;
    var wanted = raw.split(',').map(function (v) { return v.trim().toLowerCase(); }).filter(Boolean);
    form.querySelectorAll('.lm-shape input').forEach(function (input) {
      if (wanted.indexOf(String(input.value).toLowerCase()) !== -1) input.checked = true;
    });
  }

  function wireShapes() {
    form.querySelectorAll('.lm-shape').forEach(function (label) {
      var input = label.querySelector('input');
      if (!input) return;
      label.classList.toggle('is-active', input.checked);
      input.addEventListener('change', function () {
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

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      state.page = 1;
      load();
    });
    var reset = form.querySelector('.lm-dfilter__reset');
    if (reset) {
      reset.addEventListener('click', function (e) {
        e.preventDefault();
        form.reset();
        form.querySelectorAll('.lm-shape').forEach(function (l) {
          l.classList.remove('is-active');
        });
        wireScales();
        wireRanges();
        state.page = 1;
        load();
      });
    }
    wireScales();
    hydrateShapesFromURL();
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
          })[0] || (product.variants || [])[0];
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

  load();
})();
