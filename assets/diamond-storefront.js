/**
 * Laura Milman — API-backed diamond filter + Buy now checkout.
 * Lists available stones from Supabase; purchase goes through the matching
 * Shopify product (handle nd-/lg-<stock_ref>) after a live availability check.
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
      '" data-kind="' +
      escapeAttr(stone.kind || cfg.kind) +
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
      '<button type="button" class="lm-stone-card__buy" data-buy="' +
      escapeAttr(stone.stock_ref) +
      '" data-kind="' +
      escapeAttr(stone.kind || cfg.kind) +
      '">Buy now</button>' +
      '<p class="lm-stone-card__buy-status" data-buy-status hidden></p>' +
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
        fill.style.left = ((min - floor) / span) * 100 + '%';
        fill.style.right = 100 - ((max - floor) / span) * 100 + '%';
      }
      if (minEl) minEl.addEventListener('input', paint);
      if (maxEl) maxEl.addEventListener('input', paint);
      paint();
    });
  }

  /**
   * Buy now: re-check API availability, resolve Shopify variant, add to cart,
   * go straight to checkout. Products still exist as nd-/lg-<stock_ref>.
   */
  async function buyNow(btn) {
    var stockRef = btn.getAttribute('data-buy');
    var kind = btn.getAttribute('data-kind') || cfg.kind;
    var card = btn.closest('.product-card');
    var status = card ? card.querySelector('[data-buy-status]') : null;
    var label = btn.textContent;

    function setStatus(msg, isError) {
      if (!status) return;
      status.hidden = !msg;
      status.textContent = msg || '';
      status.classList.toggle('is-error', !!isError);
    }

    btn.disabled = true;
    btn.textContent = 'Checking…';
    setStatus('');

    try {
      var availRes = await fetch(
        cfg.apiBase + '?stock_ref=' + encodeURIComponent(stockRef),
        { headers: headers() },
      );
      var availData = await availRes.json().catch(function () {
        return {};
      });
      if (!availRes.ok || !availData.stone) {
        throw new Error('This diamond is no longer available.');
      }

      var stone = availData.stone;
      var handle = productHandle({
        kind: stone.kind || kind,
        stock_ref: stone.stock_ref || stockRef,
      });

      btn.textContent = 'Adding…';
      var prodRes = await fetch('/products/' + encodeURIComponent(handle) + '.js', {
        headers: { Accept: 'application/json' },
      });
      if (!prodRes.ok) {
        throw new Error('This diamond isn’t ready to purchase yet. Please try again shortly.');
      }
      var product = await prodRes.json();
      var variant =
        (product.variants || []).find(function (v) {
          return v.available;
        }) || (product.variants || [])[0];
      if (!variant || !variant.id) {
        throw new Error('This diamond is no longer available.');
      }
      if (variant.available === false) {
        throw new Error('This diamond is no longer available.');
      }

      var cartRes = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              id: variant.id,
              quantity: 1,
              properties: {
                _stock_ref: String(stone.stock_ref || stockRef),
                _cert: stone.lab ? String(stone.lab) : '',
                _api_checked: 'yes',
              },
            },
          ],
        }),
      });
      var cartData = await cartRes.json().catch(function () {
        return {};
      });
      if (!cartRes.ok) {
        throw new Error(
          cartData.description || cartData.message || 'Could not add this diamond to your bag.',
        );
      }

      btn.textContent = 'Redirecting…';
      window.location.href = '/checkout';
    } catch (err) {
      btn.disabled = false;
      btn.textContent = label;
      setStatus(err.message || String(err), true);
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
      var buyBtn = e.target.closest('[data-buy]');
      if (buyBtn && !buyBtn.disabled) {
        e.preventDefault();
        buyNow(buyBtn);
      }
    });
  }

  load();
})();
