/**
 * Laura Milman — API-backed diamond filter + inquiry/reserve.
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
    reserveUrl: (root.dataset.reserveUrl || '').replace(/\/+$/, ''),
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

  /** Grade scale: floor and better (checked stops). */
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

  function hasStonePhoto(stone) {
    return !!(stone.image_urls && stone.image_urls[0]);
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
      '<button type="button" class="lm-stone-card__reserve" data-reserve="' +
      escapeAttr(stone.stock_ref) +
      '">Reserve instead</button>' +
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
        // Belgium Dia often ships cert PDFs but no ImageLink. Those SKUs are
        // Shopify drafts; skip cream placeholders rather than listing them.
        var stones = (data.stones || []).filter(hasStonePhoto);
        if (!stones.length) {
          resultsEl.innerHTML =
            '<div class="lm-dfilter__empty"><p class="lm-dfilter__empty-title">No stones match</p>' +
            '<p class="lm-dfilter__empty-copy">Widen a grade or carat range and try again.</p></div>';
        } else {
          resultsEl.innerHTML =
            '<div class="products-grid lm-dfilter__results">' +
            stones.map(cardHtml).join('') +
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
        var floor = -1;
        stops.forEach(function (stop, i) {
          var on = stop.querySelector('input').checked;
          stop.classList.toggle('is-in-range', on);
          stop.classList.remove('is-floor');
          if (on && floor === -1) floor = i;
        });
        if (fill) {
          if (floor === -1) {
            fill.style.left = '0%';
            fill.style.right = '100%';
          } else {
            stops[floor].classList.add('is-floor');
            fill.style.left = ((floor + 0.5) / stops.length) * 100 + '%';
            fill.style.right = (100 / stops.length) * 0.5 + '%';
          }
        }
        if (hint) {
          hint.textContent = floor === -1 ? noun : stops[floor].dataset.grade + ' and better';
        }
      }

      stops.forEach(function (stop, index) {
        stop.addEventListener('click', function (event) {
          event.preventDefault();
          var isFloor = stop.classList.contains('is-floor');
          stops.forEach(function (s, i) {
            s.querySelector('input').checked = !isFloor && i >= index;
          });
          paint();
        });
      });
      paint();
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

  /* ── Reserve modal ── */
  var modal = document.getElementById('lm-reserve-modal');
  var reserveStock = null;

  function openReserve(stockRef, title) {
    reserveStock = stockRef;
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('lm-reserve-open');
    var t = modal.querySelector('[data-reserve-title]');
    if (t) t.textContent = title || 'Stock #' + stockRef;
    var stockInput = modal.querySelector('[name="stock_ref"]');
    if (stockInput) stockInput.value = stockRef;
    var status = modal.querySelector('[data-reserve-status]');
    if (status) {
      status.hidden = true;
      status.textContent = '';
    }
  }

  function closeReserve() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('lm-reserve-open');
    reserveStock = null;
  }

  async function submitReserve(event) {
    event.preventDefault();
    if (!cfg.reserveUrl || !reserveStock) return;
    var fd = new FormData(event.target);
    var payload = {
      stock_ref: reserveStock,
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      message: String(fd.get('message') || '').trim(),
    };
    var status = modal.querySelector('[data-reserve-status]');
    var btn = modal.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      var res = await fetch(cfg.reserveUrl, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers()),
        body: JSON.stringify(payload),
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Could not reserve');
      if (status) {
        status.hidden = false;
        status.textContent =
          'Reserved. We will confirm availability and send a private invoice to ' +
          payload.email +
          ' shortly.';
      }
      event.target.reset();
    } catch (err) {
      if (status) {
        status.hidden = false;
        status.textContent = err.message || String(err);
      }
    } finally {
      if (btn) btn.disabled = false;
    }
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
      var reserveBtn = e.target.closest('[data-reserve]');
      if (reserveBtn) {
        e.preventDefault();
        var card = reserveBtn.closest('.product-card');
        var title = card ? card.querySelector('.product-card__title') : null;
        openReserve(
          reserveBtn.getAttribute('data-reserve'),
          title ? title.textContent.trim() : '',
        );
        return;
      }

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

  if (modal) {
    modal.querySelectorAll('[data-reserve-close]').forEach(function (el) {
      el.addEventListener('click', closeReserve);
    });
    var reserveForm = modal.querySelector('form');
    if (reserveForm) reserveForm.addEventListener('submit', submitReserve);
  }

  load();
})();
