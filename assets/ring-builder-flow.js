(function () {
  'use strict';
  function initialize() {
    const root = document.getElementById('lmny-ring-builder');
    if (!root || root.dataset.initialized) return;
    root.dataset.initialized = 'true';
    const cfg = JSON.parse(root.querySelector('[data-flow-config]').textContent);
    const main = root.querySelector('[data-flow-main]');
    const aside = root.querySelector('[data-flow-summary]');
    const status = root.querySelector('[data-flow-status]');
    const shapeSource = root.querySelector('[data-diamond-filter-template]');
    const shapeDoc = new DOMParser().parseFromString(shapeSource ? shapeSource.innerHTML : '', 'text/html');
    const listedShapes = [...shapeDoc.querySelectorAll('.lm-shape__name')].map(el => el.textContent.trim()).filter(Boolean);
    const shapeTokens = [...shapeDoc.querySelectorAll('.lm-shape input')].flatMap(input => String(input.value).toLowerCase().split(',')).map(value => value.trim()).filter(Boolean);
    const shapes = [...new Set(listedShapes.concat((cfg.settings || []).map(product => String(product.shape || '')).filter(Boolean)))];
    const shapeKnown = token => {
      const key = String(token || '').trim().toLowerCase();
      if (!key) return true;
      return shapes.some(shape => shape.toLowerCase() === key) || shapeTokens.includes(key);
    };
    const handlePattern = /^[a-z0-9][a-z0-9-]{0,99}$/;
    const storageKey = 'lmRingFlowV1';
    const keepFor = 30 * 24 * 60 * 60 * 1000;
    const translations = Object.fromEntries(Object.entries(cfg.copy).map(([key, value]) => [key, String(value).replace(/&(amp|lt|gt|quot|#39|#x27);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'" }[entity]))]));
    const t = (key, values = {}) => Object.entries(values).reduce((s, [k, v]) => s.replaceAll('{{ ' + k + ' }}', String(v)).replaceAll('__' + k + '__', String(v)), translations[key] || key);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const base = (cfg.root || '/').replace(/\/?$/, '/');
    const route = path => base + path;
    const money = (cents, currency = cfg.currency) => new Intl.NumberFormat(document.documentElement.lang || 'en-US', { style: 'currency', currency: currency || 'USD' }).format(cents / 100);
    const safeURL = value => {
      try {
        if (!value) return '';
        const u = new URL(String(value), window.location.origin);
        return u.protocol === 'https:' || u.origin === window.location.origin ? u.href : '';
      } catch (_) { return ''; }
    };
    const counted = (key, count) => t(Number(count) === 1 && translations[key + '_one'] ? key + '_one' : key, { count: Number(count).toLocaleString() });
    const button = (key, action, cls = 'primary', extra = '') => `<button type="button" class="${cls}" data-action="${esc(action)}" ${extra}>${esc(t(key))}</button>`;
    const image = (src, alt = '', cls = '', eager = false) => safeURL(src) ? `<img class="${cls}" src="${esc(safeURL(src))}" alt="${esc(alt)}" width="800" height="800" loading="${eager ? 'eager' : 'lazy'}">` : '';
    const state = { screen: 'start', kind: 'diamond', setting: null, diamond: null, band: null, bandOptions: [], options: [], size: '', engraving: '', font: 'block', date: '', detail: null, photo: 0, page: 1, totalPages: 1, rows: [], busy: false, generation: 0, group: '', editGroup: '', filters: { origin: 'lab', shape: 'Oval', metal: '', color: '', clarity: '', cut: '', min_carat: '', max_carat: '', min_price: '', max_price: '', sort: 'price_asc' } };
    const knownSettings = new Map(cfg.settings.filter(p => p.setting && shapes.includes(p.shape)).map(p => [p.handle, p]));
    const knownBands = new Set((cfg.bands || []).map(p => p.handle));
    const settingCount = shape => [...knownSettings.values()].filter(p => p.available && String(shape || '').split(',').some(s => s.trim().toLowerCase() === p.shape.toLowerCase())).length;
    const settingShape = shape => {
      const listed = String(shape || '').split(',').map(s => s.trim()).filter(Boolean);
      const own = shapes.find(s => listed.some(l => l.toLowerCase() === s.toLowerCase()) && settingCount(s));
      return own || shapes.slice().sort((a, b) => settingCount(b) - settingCount(a))[0] || listed[0] || '';
    };
    const fromPrice = p => {
      const prices = p.variants.filter(v => v.available).map(v => v.price);
      const low = Math.min(...prices);
      return prices.some(price => price !== low) ? t('price_from', { price: money(low) }) : money(low);
    };
    const metalOf = text => (String(text || '').match(/platinum|white|yellow|rose/i) || [''])[0].toLowerCase();
    const metalName = metal => t('metal_' + metal);
    const settingMetals = p => [...new Set(p.variants.filter(v => v.available).map(v => metalOf(v.options.join(' '))).concat(metalOf(p.title)).filter(Boolean))];
    const caratChips = [['1', '1.49'], ['1.5', '1.99'], ['2', '2.99'], ['3', '']];
    let ready = false, searchTimer = 0;
    const bandVariant = () => state.band?.variants.find(v => v.available && v.options.every((value, i) => value === state.bandOptions[i])) || null;
    const both = () => state.setting && state.diamond;
    const sizeIndex = p => p.options.findIndex(o => /size/i.test(o.name));
    const optionsOf = p => p.options.filter(o => !/size/i.test(o.name) && o.name !== 'Title');
    function pickedVariant(p = state.setting) {
      if (!p) return null;
      const si = sizeIndex(p);
      return p.variants.find(v => v.available && v.options.every((value, i) => i === si ? state.size === 'unsure' || !state.size || String(value) === state.size : !state.options[i] || value === state.options[i])) || null;
    }
    const variantPrice = p => p === state.setting ? pickedVariant(p)?.price : p?.variants?.find(v => v.available)?.price;
    const subtotal = () => (variantPrice(state.setting) || 0) + (state.diamond?.price || 0) + (bandVariant()?.price || 0);
    function notice(message, error = false) {
      status.textContent = message;
      status.classList.toggle('error', error);
      status.setAttribute('role', error ? 'alert' : 'status');
    }
    function persist() {
      const stored = { band: state.band?.handle, bandOptions: state.bandOptions, setting: state.setting?.handle, diamond: state.diamond?.handle, size: state.size, options: state.options, engraving: state.engraving, font: state.font, date: state.date, screen: state.screen, filters: state.filters, group: state.group, editGroup: state.editGroup };
      try { localStorage.setItem(storageKey, JSON.stringify({ ...stored, saved: Date.now() })); } catch (_) {}
      const u = new URL(window.location.href);
      for (const k of ['setting', 'diamond', 'step', 'edit_group']) u.searchParams.delete(k);
      if (state.editGroup) u.searchParams.set('edit_group', state.editGroup);
      if (stored.setting) u.searchParams.set('setting', stored.setting);
      if (stored.diamond) u.searchParams.set('diamond', stored.diamond);
      if (state.screen === 'review') u.searchParams.set('step', 'review');
      if (u.href !== window.location.href) history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
    async function request(url, options = {}) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        const data = await res.json();
        if (!res.ok || data.status >= 400) throw new Error(data.description || data.error || t('request_failed'));
        return data;
      } finally { clearTimeout(timer); }
    }
    function apiHeaders() {
      return cfg.apiKey ? { Accept: 'application/json', apikey: cfg.apiKey, Authorization: 'Bearer ' + cfg.apiKey } : { Accept: 'application/json' };
    }
    async function product(handle) {
      if (!handlePattern.test(handle || '')) throw new Error(t('unavailable'));
      const p = await request(route('products/' + handle + '?view=ring-flow-data'), { headers: { Accept: 'text/html' } });
      if (p.handle !== handle || !p.available || !Array.isArray(p.variants) || !p.variants.some(v => v.available && Number.isFinite(v.price) && v.price > 0)) throw new Error(t('unavailable'));
      return p;
    }
    function setSetting(p, restore = false) {
      if (!p.setting || !knownSettings.has(p.handle) || !shapes.includes(p.shape)) throw new Error(t('bad_selection'));
      if (state.diamond && p.shape !== state.diamond.shape) throw new Error(t('wrong_shape'));
      state.setting = p;
      if (!restore) {
        const first = p.variants.find(v => v.available && state.filters.metal && metalOf(v.options.join(' ')) === state.filters.metal) || p.variants.find(v => v.available);
        state.options = first.options.slice();
        const si = sizeIndex(p);
        if (si >= 0 && state.size && state.size !== 'unsure' && !p.variants.some(v => v.available && String(v.options[si]) === state.size)) state.size = '';
      }
      if (!pickedVariant()) {
        state.options = p.variants.find(v => v.available).options.slice();
        state.size = '';
      }
      state.filters.shape = p.shape;
    }
    async function diamond(handle, supplied) {
      const p = await product(handle);
      if (p.setting || !['Lab-Grown Diamond', 'Natural Diamond'].includes(p.type) || !shapes.includes(p.shape)) throw new Error(t('unavailable'));
      if (state.setting && state.setting.shape !== p.shape) throw new Error(t('wrong_shape'));
      let spec = supplied;
      if (!spec && cfg.apiBase) {
        const ref = handle.replace(/^(lg|nd)-/, '');
        try { spec = (await request(cfg.apiBase + '?stock_ref=' + encodeURIComponent(ref), { headers: apiHeaders() })).stone; } catch (_) {}
      }
      return { ...p, price: p.variants.find(v => v.available).price, variant: p.variants.find(v => v.available).id, spec: spec || {}, origin: p.type === 'Natural Diamond' ? 'natural' : 'lab' };
    }
    function summary() {
      aside.hidden = state.screen === 'start';
      root.querySelector('.layout').classList.toggle('solo', aside.hidden);
      root.querySelector('[data-flow-dock]').hidden = aside.hidden;
      document.body.classList.toggle('has-pdp-sticky', !aside.hidden);
      if (aside.hidden) return;
      aside.innerHTML = `<h2>${esc(t('your_ring'))}</h2><div class="summary-items">${['setting', 'diamond', ...(state.band ? ['band'] : [])].map(k => {
        const p = state[k];
        const price = k === 'setting' ? variantPrice(p) : k === 'band' ? bandVariant()?.price : p?.price;
        return `<div class="sum-item"><div class="sum-title"><span class="eyebrow">${esc(t(k))}</span>${p ? button(k === 'band' ? 'remove' : 'change', k === 'band' ? 'remove-band' : 'change-' + k, 'link') : ''}</div>${p ? `<div class="sum-product">${image(p.image, '', 'thumb')}<div>${esc(p.title)}<br>${price != null ? money(price) : esc(t('size_unavailable'))}</div></div>` : `<p class="quiet">${esc(t('empty_selection'))}</p>`}</div>`;
      }).join('')}</div><div class="row"><span>${esc(t(state.band ? 'order_subtotal' : both() ? 'subtotal' : 'selected_total'))}</span><span class="total">${money(subtotal())}</span></div><p class="quiet">${esc(t(both() ? 'included' : state.setting ? 'missing_diamond' : 'missing_setting'))}</p><p class="quiet">${esc(t('tax_shipping'))}</p>${state.screen === 'review' ? button(state.busy ? 'adding' : state.band ? 'add_with_band' : 'add', 'add', 'primary', !state.size || !pickedVariant() || state.busy || !both() || (state.band && !bandVariant()) ? 'disabled' : '') + (!state.size ? `<p class="quiet">${esc(t('size_required'))}</p>` : !pickedVariant() ? `<p class="error">${esc(t('size_unavailable'))}</p>` : '') : both() ? button('review_ring', 'review') : ''}<p class="quiet promise">${esc(t('promise'))}</p><a class="link" href="${esc(cfg.cartUrl)}">${esc(t('view_bag'))}</a>`;
      const dock = root.querySelector('[data-flow-dock]');
      const next = state.screen === 'review' ? button('add_short', 'dock-add', 'primary', state.busy || !both() ? 'disabled' : '') : both() ? button('review_ring', 'review') : button('view_summary', 'dock-summary', 'secondary');
      dock.innerHTML = `<div><span class="eyebrow">${esc(t('your_ring'))}</span><span class="total">${money(subtotal())}</span></div>${next}`;
      if (state.busy) lockControls();
    }
    function lockControls() {
      root.querySelectorAll('button,input,select').forEach(el => { el.disabled = true; });
      root.setAttribute('aria-busy', 'true');
    }
    function start() {
      if (main.dataset.initialStart !== 'true') main.innerHTML = `<h2>${esc(t('where'))}</h2><div class="paths">${['diamond', 'setting'].map(k => {
        const p = k === 'setting' ? cfg.settings[0] : null;
        const src = p?.image || root.dataset.diamondImage || '';
        return `<button type="button" class="path" data-action="start-${k}">${image(src, t(k), '', true)}<div><h2>${esc(t('start_' + k))}</h2><p class="quiet">${esc(t(k + '_intro'))}</p><span class="eyebrow">${esc(t('choose_' + k))} →</span></div></button>`;
      }).join('')}</div>`;
      main.dataset.initialStart = 'false';
    }
    function selectField(label, key, values, current, disabled = false) {
      return `<label>${esc(t(label))}<select data-filter="${key}" ${disabled ? 'disabled' : ''}>${values.map(([v, text]) => `<option value="${esc(v)}" ${v === current ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
    }
    function filters() {
      const lock = state.kind === 'diamond' ? state.setting : state.diamond;
      const shape = lock?.shape || state.filters.shape;
      const shapeOptions = shapes.filter(s => settingCount(s) || s === shape).map(s => [s, s]);
      const metals = [...new Set([...knownSettings.values()].filter(p => p.available && p.shape === shape).flatMap(settingMetals))];
      const metalField = metals.length > 1 ? selectField('metal', 'metal', [['', t('all_metals')], ...metals.map(m => [m, metalName(m)])], state.filters.metal) : '';
      if (state.kind === 'setting') return `<div class="filters">${selectField('shape', 'shape', shapeOptions, shape, !!lock)}${metalField}</div>${lock ? `<p class="quiet">${esc(t('shape_locked', { shape }))} ${button('clear_diamond', 'clear-diamond', 'link')}</p>` : ''}`;
      return root.querySelector('[data-diamond-filter-template]').innerHTML + (lock ? `<p class="quiet">${esc(t('shape_locked', { shape }))} ${button('clear_setting', 'clear-setting', 'link')}</p>` : '');
    }
    function paintDiamondFilters() {
      const form = main.querySelector('#DiamondFilterForm');
      if (!form) return;
      form.dataset.searchForm = '';
      const isNatural = state.filters.origin === 'natural';
      main.querySelector('.diamond-search').classList.toggle('lm-dfilter--navy', !isNatural);
      main.querySelectorAll('.lm-dfilter__origin-btn').forEach(link => {
        const origin = link.getAttribute('href').includes('/natural-') ? 'natural' : link.getAttribute('href').includes('/lab-grown-') ? 'lab' : '';
        if (!origin) { link.hidden = true; return; }
        link.dataset.origin = origin;
        link.classList.toggle('is-active', state.filters.origin === origin);
        if (state.filters.origin === origin) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
      });
      form.querySelector('.lm-dfilter__reset').dataset.action = 'reset';
      form.querySelectorAll('.lm-shape input').forEach(input => {
        const wanted = (state.setting?.shape || state.filters.shape).split(',').map(value => value.trim().toLowerCase());
        input.checked = String(input.value).split(',').some(value => wanted.includes(value.trim().toLowerCase()));
        input.disabled = !!state.setting;
        input.parentElement.classList.toggle('is-active', input.checked);
      });
      const more = form.querySelector('.more-shapes');
      if (more && more.querySelector('input:checked')) more.open = true;
      form.querySelectorAll('.carat-chips [data-action]').forEach((chip, i) => {
        const [low, high] = caratChips[i];
        chip.setAttribute('aria-pressed', String(state.filters.min_carat === low && state.filters.max_carat === high));
      });
      const toggle = form.querySelector('[data-action="more-filters"]');
      if (toggle) {
        const picked = ['color', 'clarity', 'cut'].filter(key => state.filters[key]).length;
        toggle.textContent = t(toggle.getAttribute('aria-expanded') === 'true' ? 'fewer_filters' : 'more_filters') + (picked ? ' (' + picked + ')' : '');
      }
      form.querySelectorAll('[data-scale]').forEach(scale => {
        const picked = state.filters[scale.dataset.scale].split(',').filter(Boolean);
        scale.querySelectorAll('input').forEach(input => {
          input.checked = picked.includes(input.value);
          input.parentElement.classList.toggle('is-in-range', input.checked);
          input.parentElement.classList.toggle('is-floor', input.checked);
        });
        scale.querySelector('[data-scale-fill]').style.right = '100%';
        const hint = scale.parentElement.querySelector('[data-scale-hint]');
        if (!hint.dataset.any) hint.dataset.any = hint.textContent;
        hint.textContent = picked.length ? picked.join(', ') : hint.dataset.any;
      });
      form.querySelectorAll('[data-range]').forEach(range => {
        const key = range.dataset.rangeKey;
        const floor = key === 'carat' ? 0.3 : 0;
        const ceil = key === 'carat' ? (isNatural ? 30 : 15) : (isNatural ? 250000 : 50000);
        range.dataset.ceil = ceil;
        ['min', 'max'].forEach(side => {
          const input = range.querySelector('[data-range-' + side + ']');
          input.dataset.filter = side + '_' + key;
          input.max = ceil;
          if (document.activeElement !== input) input.value = state.filters[side + '_' + key] || (side === 'min' ? floor : ceil);
        });
        const low = Number(range.querySelector('[data-range-min]').value);
        const high = Number(range.querySelector('[data-range-max]').value);
        const pct = n => Math.max(0, Math.min(100, (n - floor) / (ceil - floor) * 100));
        const fill = range.querySelector('[data-range-fill]');
        fill.style.left = Math.min(pct(low), pct(high)) + '%';
        fill.style.right = (100 - Math.max(pct(low), pct(high))) + '%';
      });
    }
    function decorateShapes() {
      const grid = main.querySelector('#DiamondFilterForm .lm-dfilter__shapes');
      if (!grid) return;
      const custom = [];
      grid.querySelectorAll('.lm-shape').forEach(label => {
        const n = settingCount([label.querySelector('.lm-shape__name')?.textContent || '', label.querySelector('input').value].join(','));
        if (!n) { custom.push(label); return; }
        const fit = document.createElement('span');
        fit.className = 'lm-shape__fit';
        fit.textContent = counted('shape_settings', n);
        label.append(fit);
      });
      if (!custom.length) return;
      const more = document.createElement('details');
      more.className = 'more-shapes';
      more.innerHTML = `<summary>${esc(t('more_shapes', { count: custom.length }))}</summary><div class="lm-dfilter__shapes"></div>`;
      more.lastElementChild.append(...custom);
      grid.after(more);
    }
    function decorateFilters() {
      const form = main.querySelector('#DiamondFilterForm');
      const carat = form?.querySelector('[data-range-key="carat"]');
      if (!form || !carat) return;
      const chips = document.createElement('div');
      chips.className = 'carat-chips';
      chips.setAttribute('role', 'group');
      chips.setAttribute('aria-label', t('carat_sizes'));
      chips.innerHTML = caratChips.map(([low, high], i) => `<button type="button" class="chip" data-action="carat-${i}" aria-pressed="false">${esc(t(high ? 'carat_value' : 'carat_plus', { carat: low }))}</button>`).join('');
      carat.before(chips);
      const groups = [...form.querySelectorAll('[data-scale]')].map(scale => scale.closest('.lm-dfilter__group'));
      if (!groups.length) return;
      const more = document.createElement('div');
      more.className = 'more-filters';
      more.dataset.moreFilters = '';
      more.hidden = !state.moreFilters && !['color', 'clarity', 'cut'].some(key => state.filters[key]);
      groups[0].before(more);
      more.append(...groups);
      more.insertAdjacentHTML('beforebegin', `<button type="button" class="more-toggle" data-action="more-filters" aria-expanded="${!more.hidden}"></button>`);
    }
    function readDiamondFilters() {
      const form = main.querySelector('#DiamondFilterForm');
      if (!form) return;
      if (!state.setting) state.filters.shape = [...form.querySelectorAll('.lm-shape input:checked')].map(input => input.value).join(',');
      for (const key of ['color', 'clarity', 'cut']) state.filters[key] = [...form.querySelectorAll('[data-scale="' + key + '"] input:checked')].map(input => input.value).join(',');
      form.querySelectorAll('[data-range]').forEach(range => {
        const key = range.dataset.rangeKey;
        for (const side of ['min', 'max']) {
          const value = range.querySelector('[data-range-' + side + ']').value;
          const bound = side === 'min' ? range.dataset.floor : range.dataset.ceil;
          state.filters[side + '_' + key] = Number(value) === Number(bound) ? '' : value;
        }
      });
    }

    function catalogShell() {
      const k = state.kind;
      main.innerHTML = `<div class="heading"><h2>${esc(t('choose_' + k))}.</h2>${button('back', 'start', 'link')}</div>${filters()}<div class="toolbar"><span class="quiet" data-count>${esc(t('loading'))}</span>${k === 'diamond' ? `<label>${esc(t('sort'))}<select data-sort>${['price_asc', 'price_desc', 'carat_asc', 'carat_desc'].map(s => `<option value="${s}" ${state.filters.sort === s ? 'selected' : ''}>${esc(t(s))}</option>`).join('')}</select></label>` : ''}</div><div data-results></div><div class="pager" data-pager></div><p class="quiet rule">${esc(t(k === 'diamond' ? 'unit_usd' : 'setting_only'))}</p>`;
      if (k === 'diamond') { decorateShapes(); decorateFilters(); paintDiamondFilters(); }
    }
    function empty(settings = false) {
      return `<div class="empty"><h3>${esc(t('no_matches'))}</h3><p class="quiet">${esc(t(settings ? 'no_settings' : 'widen'))}</p>${settings ? `<a class="secondary" href="${esc(cfg.contact)}">${esc(t('custom_setting'))}</a>` : button('reset', 'reset', 'secondary')}</div>`;
    }
    function settingResults() {
      const shape = state.diamond?.shape || state.filters.shape;
      state.rows = [...knownSettings.values()].filter(p => p.shape === shape && p.available && (!state.filters.metal || settingMetals(p).includes(state.filters.metal)));
      main.querySelector('[data-count]').textContent = counted('settings_results', state.rows.length);
      main.querySelector('[data-results]').innerHTML = state.rows.length ? `<div class="products">${state.rows.map((p, i) => `<article class="product">${image(p.image, p.title)}<h3>${esc(p.title)}</h3><div class="quiet">${esc(p.shape)} · ${esc(t('setting_only'))}</div><div class="price">${esc(fromPrice(p))}</div>${cardActions(i)}</article>`).join('')}</div>` : empty(true);
      returnToCard();
    }
    function returnToCard() {
      if (state.returnIndex == null) return;
      const card = main.querySelector('[data-action="details-' + state.returnIndex + '"]')?.closest('.product');
      state.returnIndex = null;
      if (card) card.scrollIntoView({ block: 'center' });
    }
    function rangesValid() {
      return [['min_carat', 'max_carat'], ['min_price', 'max_price']].every(pair => {
        const [low, high] = pair.map(k => state.filters[k]);
        return !((low !== '' && (!Number.isFinite(Number(low)) || Number(low) < 0)) || (high !== '' && (!Number.isFinite(Number(high)) || Number(high) < 0)) || (low !== '' && high !== '' && Number(low) > Number(high)));
      });
    }
    function queueSearch(delay) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { if (!rangesValid() || state.busy) return; notice(''); state.page = 1; search(); persist(); }, delay);
    }
    async function search() {
      clearTimeout(searchTimer);
      const generation = ++state.generation;
      const result = main.querySelector('[data-results]');
      if (!result) return;
      result.innerHTML = `<p>${esc(t('searching'))}</p>`;
      if (!cfg.apiBase) { result.innerHTML = `<p>${esc(t('search_unavailable'))}</p>`; return; }
      const params = new URLSearchParams({ kind: state.filters.origin, page: String(state.page), per_page: '12', sort: state.filters.sort, shape: state.setting?.shape || state.filters.shape });
      for (const [key, value] of Object.entries(state.filters)) if (value !== '' && !['origin', 'shape', 'sort', 'metal'].includes(key)) params.set(key === 'color' ? 'colors' : key === 'clarity' ? 'clarities' : key === 'cut' ? 'cuts' : key, value);
      try {
        const response = await request(cfg.apiBase + '?' + params, { headers: apiHeaders() });
        if (generation !== state.generation || state.screen !== 'catalog' || state.kind !== 'diamond') return;
        state.rows = response.stones || [];
        state.totalPages = Math.max(1, response.total_pages || 1);
        main.querySelector('[data-count]').textContent = counted('results', response.total || 0);
        result.innerHTML = state.rows.length ? `<div class="products">${state.rows.map((s, i) => `<article class="product"><div class="card-media" ${safeURL(s.video_urls?.[0]) ? `data-video="${esc(safeURL(s.video_urls[0]))}"` : ''}>${image(s.image_urls?.[0], stoneTitle(s))}</div><h3>${esc(stoneTitle(s))}</h3><div class="quiet">${esc([t(s.kind === 'natural' ? 'natural' : 'lab'), s.color, s.clarity, s.cut ? t('cut_value', { cut: s.cut }) : '', s.lab].filter(Boolean).join(' · '))}</div>${faceUpText(s.measurements) ? `<div class="quiet">${esc(faceUpText(s.measurements))}</div>` : ''}<div class="price">${money(Math.round(s.retail_usd * 100), 'USD')}</div>${cardActions(i)}</article>`).join('')}</div>` : empty();
        returnToCard();
        main.querySelector('[data-pager]').innerHTML = state.totalPages > 1 ? `${button('previous', 'previous', 'secondary', state.page <= 1 ? 'disabled' : '')}<span class="quiet">${esc(t('page', { page: state.page, pages: state.totalPages }))}</span>${button('next', 'next', 'secondary', state.page >= state.totalPages ? 'disabled' : '')}` : '';
      } catch (_) {
        if (generation !== state.generation || state.screen !== 'catalog') return;
        main.querySelector('[data-count]').textContent = '';
        result.innerHTML = `<p>${esc(t('load_failed'))}</p>${button('retry', 'retry', 'secondary')} <a class="link" href="${esc(cfg.contact)}">${esc(t('help'))}</a>`;
      }
    }
    function cardActions(i) { return `<div class="card-actions">${button('view_details', 'details-' + i, 'secondary')}${button('select_short', 'quick-' + i)}</div>`; }
    function stoneTitle(s) { return [s.carat ? s.carat + ' ct' : '', s.shape || ''].filter(Boolean).join(' '); }
    function stoneHandle(s) { return (s.kind === 'natural' ? 'nd-' : 'lg-') + String(s.stock_ref).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
    async function openDetails(index, quick = false) {
      const row = state.rows[index];
      if (!row) return;
      const generation = ++state.generation;
      const kind = state.kind;
      notice(t('loading_piece'));
      try {
        const p = kind === 'setting' ? await product(row.handle) : await diamond(stoneHandle(row), row);
        if (generation !== state.generation) return;
        if (kind === 'setting' && (!p.setting || p.shape !== (state.diamond?.shape || state.filters.shape))) throw new Error(t('wrong_shape'));
        if (kind === 'diamond') {
          try { p.spec = (await request(cfg.apiBase + '?stock_ref=' + encodeURIComponent(row.stock_ref), { headers: apiHeaders() })).stone || row; } catch (_) {}
          if (generation !== state.generation) return;
        }
        state.detail = p;
        state.photo = 0;
        state.detailIndex = index;
        notice('');
        if (quick) choose(); else go('detail');
      } catch (error) { if (generation === state.generation) notice(error.message || t('load_failed'), true); }
    }
    function detail() {
      const p = state.detail;
      if (!p) return go('catalog');
      const isSetting = state.kind === 'setting';
      const photos = p.images?.length ? p.images : [p.image];
      const s = p.spec || {};
      const facts = [['shape', p.shape], ...(!isSetting ? [['origin', t(p.origin === 'natural' ? 'natural' : 'lab')], ['color', s.color], ['clarity', s.clarity], ['cut', s.cut], ['polish', s.polish], ['symmetry', s.symmetry], ['fluorescence', s.fluorescence], ['measurements', s.measurements], ['table', s.table_pct != null ? s.table_pct + '%' : null], ['depth', s.depth_pct != null ? s.depth_pct + '%' : null], ['certificate', [s.lab, s.cert_number].filter(Boolean).join(' ')]] : [])].filter(([, value]) => value != null && value !== '');
      const videos = [...new Set([...(p.videos || []), ...(s.video_urls || [])].filter(safeURL))];
      main.innerHTML = `${button('back_results', 'catalog', 'link')}<div class="detail"><div><div class="media" data-media>${image(photos[state.photo], p.title, '', true)}</div>${photos.length > 1 ? `<div class="media-thumbs">${photos.map((src, i) => `<button type="button" data-action="photo-${i}" aria-label="${esc(t('photo', { number: i + 1 }))}" aria-pressed="${i === state.photo}">${image(src)}</button>`).join('')}</div>` : ''}${videos.map((src, i) => `<button type="button" class="link" data-action="video-${i}">${esc(t('video'))}</button>`).join('')}${safeURL(s.cert_url) ? `<p><a class="link" href="${esc(safeURL(s.cert_url))}" target="_blank" rel="noopener">${esc(t('report'))}</a></p>` : ''}</div><div><div class="eyebrow">${esc(t(isSetting ? 'setting' : 'diamond'))}</div><h2>${esc(p.title)}</h2><p class="total">${esc(isSetting ? fromPrice(p) : money(p.price))}</p><p class="quiet">${esc(t(isSetting ? 'setting_only' : 'diamond_only'))}</p>${button(isSetting ? 'select_setting' : 'select_diamond', 'select')}<p class="quiet">${esc(t(!isSetting && !state.setting && !settingCount(p.shape) ? 'no_setting_shape' : 'fits_check'))}</p><p class="detail-help"><a class="link" href="${esc(cfg.contact)}">${esc(t(isSetting ? 'ask_setting' : 'ask_stone'))}</a><a class="link" href="${esc(cfg.appointment)}">${esc(t('book_viewing'))}</a></p><div class="facts">${facts.map(([key, value]) => `<div class="row"><span class="fact-label">${esc(t(key))}</span><span>${esc(value)}</span></div>`).join('')}</div><a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(t('open_product'))}</a></div></div>`;
      state.detailVideos = videos;
    }
    function bandPicker() {
      if (!(cfg.bands || []).length) return '';
      const p = state.band;
      return `<section class="rule" aria-label="${esc(t('band_heading'))}"><h2>${esc(t('band_heading'))}</h2><p class="quiet">${esc(t('band_note'))}</p><label>${esc(t('band'))}<select data-band-product><option value="">${esc(t('no_band'))}</option>${bandOptions()}</select></label>${p ? `<div class="sum-product">${image(p.image, p.title, 'thumb')}<a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(t('open_product'))}</a></div><div class="fields">${p.options.map((o,i) => `<label>${esc(o.name)}<select data-band-option="${i}"><option value="">${esc(t('choose_option'))}</option>${o.values.map(v => `<option value="${esc(v)}" ${state.bandOptions[i] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`).join('')}</div><p class="${bandVariant() ? 'quiet' : 'error'}">${bandVariant() ? money(bandVariant().price) : esc(t('band_options_required'))}</p>` : ''}</section>`;
    }
    function bandOptions() {
      const ring = metalOf(pickedVariant()?.options.join(' ') || state.setting?.title);
      const option = b => `<option value="${esc(b.handle)}" ${state.band?.handle === b.handle ? 'selected' : ''}>${esc(b.title)}${b.price ? ' · ' + esc(b.price_varies ? t('price_from', { price: money(b.price) }) : money(b.price)) : ''}</option>`;
      const matching = cfg.bands.filter(b => ring && metalOf(b.title) === ring);
      if (!matching.length) return cfg.bands.map(option).join('');
      const others = cfg.bands.filter(b => !matching.includes(b));
      return `<optgroup label="${esc(t('band_match', { metal: metalName(ring).toLowerCase() }))}">${matching.map(option).join('')}</optgroup>${others.length ? `<optgroup label="${esc(t('band_other'))}">${others.map(option).join('')}</optgroup>` : ''}`;
    }
    async function selectBand(handle, options = []) {
      if (!knownBands.has(handle)) throw new Error(t('unavailable'));
      const p = await product(handle);
      if (!p.band) throw new Error(t('unavailable'));
      state.band = p;
      state.bandOptions = options;
      if (options.length) return;
      const ringMetal = pickedVariant()?.options.find(value => metalOf(value));
      p.options.forEach((o, i) => {
        const wanted = /size/i.test(o.name) ? state.size : /metal/i.test(o.name) ? ringMetal : '';
        if (wanted && o.values.includes(wanted)) state.bandOptions[i] = wanted;
      });
    }
    function review() {
      if (!both()) return go('catalog');
      const p = state.setting, si = sizeIndex(p), available = p.variants.filter(v => v.available);
      const sizes = si >= 0 ? [...new Set(p.variants.map(v => String(v.options[si])))] : Array.from({ length: 10 }, (_, i) => String(4 + i * .5));
      const sizeOptions = `<option value="">${esc(t('choose_size'))}</option>${sizes.map(s => `<option value="${esc(s)}" ${state.size === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}<option value="unsure" ${state.size === 'unsure' ? 'selected' : ''}>${esc(t('not_sure'))}</option>`;
      main.innerHTML = `<div class="heading"><h2>${esc(t('make_yours'))}</h2>${button('continue_browsing', 'catalog', 'link')}</div><div class="review-images">${['setting', 'diamond'].map(k => `<figure><div data-review-media="${k}">${image(state[k].image, state[k].title)}</div><figcaption>${esc(state[k].title)}${k === 'setting' && (state.setting.videos || []).some(safeURL) ? ` ${button('watch_setting', 'review-video', 'link')}` : ''}</figcaption></figure>`).join('')}</div>${scaleView()}<p class="detail-help">${button('share_ring', 'share', 'link')}<a class="link" href="${esc(cfg.contact)}">${esc(t('ask_ring'))}</a><a class="link" href="${esc(cfg.appointment)}">${esc(t('book_viewing'))}</a></p><p class="quiet">${esc(t('fits_check'))}</p><div class="fields"><div><label>${esc(t('size'))}<select data-field="size">${sizeOptions}</select></label><a class="link" href="${esc(cfg.sizeGuide)}" target="_blank" rel="noopener">${esc(t('size_guide'))}</a></div>${p.options.map((o, i) => i === si || o.name === 'Title' ? '' : `<label>${esc(o.name)}<select data-option="${i}">${o.values.map(v => `<option value="${esc(v)}" ${state.options[i] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`).join('')}</div>${!pickedVariant() ? `<p class="error">${esc(t('size_unavailable'))}</p>` : ''}<div class="fields rule"><label>${esc(t('engraving'))}<input data-field="engraving" maxlength="20" value="${esc(state.engraving)}"><span class="quiet">${esc(t('engraving_hint'))}</span></label><label>${esc(t('engraving_font'))}<select data-field="font"><option value="block" ${state.font === 'block' ? 'selected' : ''}>${esc(t('block'))}</option><option value="script" ${state.font === 'script' ? 'selected' : ''}>${esc(t('script'))}</option></select></label></div><div class="inscription ${state.font === 'script' ? 'script' : ''}" data-inscription aria-label="${esc(t('engraving_preview'))}" ${state.engraving ? '' : 'hidden'}>${esc(state.engraving)}</div><label class="rule">${esc(t('date'))}<input data-field="date" type="date" value="${esc(state.date)}"><span class="quiet">${esc(t('date_hint'))}</span></label><div class="callout"><strong>${esc(t('made_order'))}</strong><br>${esc(t('production_note'))}</div>${bandPicker()}`;
    }
    function faceUp(measurements) {
      const found = String(measurements || '').match(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*[x×*-]\s*(\d+(?:\.\d+)?)/i);
      const [length, width] = found ? [Number(found[1]), Number(found[2])].sort((a, b) => b - a) : [];
      return length > 2 && length < 40 && width > 1 ? [length, width] : [];
    }
    function faceUpText(measurements) {
      const [length, width] = faceUp(measurements);
      if (!length) return '';
      return length / width < 1.03 ? t('mm_round', { size: ((length + width) / 2).toFixed(1) }) : t('mm_face', { length: length.toFixed(1), width: width.toFixed(1) });
    }
    function shapeOutline(shape, w, h) {
      const key = String(shape || '').toLowerCase(), x = w / 2, y = h / 2, cut = Math.min(w, h) * (/asscher/.test(key) ? 0.25 : 0.14);
      if (/pear/.test(key)) return `<path d="M0 ${-y}C${x * 0.7} ${-y * 0.35} ${x} ${y * 0.1} ${x} ${y * 0.4}A${x} ${y * 0.6} 0 0 1 ${-x} ${y * 0.4}C${-x} ${y * 0.1} ${-x * 0.7} ${-y * 0.35} 0 ${-y}Z"/>`;
      if (/marquise/.test(key)) return `<path d="M0 ${-y}Q${w} 0 0 ${y}Q${-w} 0 0 ${-y}Z"/>`;
      if (/heart/.test(key)) return `<path d="M0 ${y}C${-x * 0.4} ${y * 0.55} ${-x} ${y * 0.1} ${-x} ${-y * 0.35}A${x / 2} ${y / 2} 0 0 1 0 ${-y * 0.45}A${x / 2} ${y / 2} 0 0 1 ${x} ${-y * 0.35}C${x} ${y * 0.1} ${x * 0.4} ${y * 0.55} 0 ${y}Z"/>`;
      if (/emerald|asscher|radiant/.test(key)) return `<path d="M${-x + cut} ${-y}H${x - cut}L${x} ${-y + cut}V${y - cut}L${x - cut} ${y}H${-x + cut}L${-x} ${y - cut}V${-y + cut}Z"/>`;
      if (/princess/.test(key)) return `<rect x="${-x}" y="${-y}" width="${w}" height="${h}"/>`;
      if (/cushion/.test(key)) return `<rect x="${-x}" y="${-y}" width="${w}" height="${h}" rx="${Math.min(w, h) * 0.28}"/>`;
      return `<ellipse rx="${x}" ry="${y}"/>`;
    }
    function scaleView() {
      const [length, width] = faceUp(state.diamond?.spec?.measurements);
      if (!length) return '';
      const size = Number(state.size) || 6, finger = 11.63 + 0.8128 * size, view = Math.max(26, length + 8);
      return `<figure class="scale" data-scale-view><svg viewBox="${-view / 2} ${-view / 2} ${view} ${view}" role="img" aria-label="${esc(t('scale_label'))}"><rect class="finger" x="${-finger / 2}" y="${-view / 2 - 2}" width="${finger}" height="${view + 4}"/><g class="stone">${shapeOutline(state.diamond.shape, width, length)}</g></svg><figcaption>${esc(t('scale_caption', { length: length.toFixed(2), width: width.toFixed(2), size: state.size && state.size !== 'unsure' ? state.size : 6, finger: finger.toFixed(1) }))}</figcaption></figure>`;
    }
    function ringLink() {
      const url = new URL(location.pathname, location.origin);
      url.searchParams.set('setting', state.setting.handle);
      url.searchParams.set('diamond', state.diamond.handle);
      return url;
    }
    function fillRingEmail(form) {
      const variant = pickedVariant();
      const values = {
        link: ringLink().href,
        setting: state.setting.title,
        diamond: state.diamond.title,
        size: state.size === 'unsure' ? t('not_sure') : state.size,
        options: [...state.setting.options.map((o, i) => /size/i.test(o.name) || o.name === 'Title' || !variant ? '' : o.name + ': ' + variant.options[i]), state.engraving.trim() ? t('engraving') + ': ' + state.engraving.trim() : ''].filter(Boolean).join(' · '),
        subtotal: money(subtotal())
      };
      form.querySelectorAll('[data-ring-email-field]').forEach(input => { input.value = values[input.dataset.ringEmailField] || ''; });
    }
    async function share() {
      const url = ringLink();
      try {
        if (navigator.share) await navigator.share({ title: t('your_ring'), text: [state.setting.title, state.diamond.title].join(' · '), url: url.href });
        else { await navigator.clipboard.writeText(url.href); notice(t('link_copied')); }
      } catch (error) { if (error?.name !== 'AbortError') notice(t('share_failed', { url: url.href }), true); }
    }
    function render() {
      root.removeAttribute('aria-busy');
      root.querySelector('footer button').disabled = false;
      if (state.screen === 'start') start();
      if (state.screen === 'catalog') { catalogShell(); if (state.kind === 'setting') settingResults(); else search(); }
      if (state.screen === 'detail') detail();
      if (state.screen === 'review') review();
      const stage = state.screen === 'review' ? 3 : state.setting || state.diamond ? 2 : 1;
      root.querySelectorAll('[data-stage]').forEach(el => { const on = +el.dataset.stage === stage; el.classList.toggle('active', on); if (on) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current'); });
      summary();
      persist();
      const mail = root.querySelector('[data-ring-email]');
      if (mail) {
        mail.hidden = state.screen !== 'review';
        mail.querySelectorAll('button,input').forEach(el => { el.disabled = false; });
      }
    }
    function reveal(target) {
      if (!target) return;
      const offset = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
      const top = target.getBoundingClientRect().top;
      if (top < offset || top > window.innerHeight * 0.75) window.scrollTo({ top: Math.max(0, top + window.scrollY - offset - 16), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    function go(screen) {
      const moved = ready && screen !== state.screen;
      const back = screen === 'catalog' && state.returnIndex != null;
      state.generation++;
      state.screen = screen;
      render();
      if (!moved) return;
      if (!back) reveal(root.querySelector('.layout'));
      const heading = main.querySelector('h2');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
    function resetSearch() {
      if (state.kind === 'diamond') state.filters.shape = state.setting?.shape || '';
      for (const key of ['color', 'clarity', 'cut', 'min_carat', 'max_carat', 'min_price', 'max_price']) state.filters[key] = '';
      state.page = 1;
      notice('');
      go('catalog');
    }
    async function cart() { return request(route('cart.js')); }
    function groupLines(c, group = state.group) { return (c.items || []).filter(item => item.properties?._lm_ring_id === group); }
    function completeGroup(lines, variant, stone) { return lines.length === (state.band ? 3 : 2) && (!state.band || (bandVariant() && lines.some(i => Number(i.variant_id || i.id) === Number(bandVariant().id) && i.quantity === 1))) && lines.some(i => Number(i.variant_id || i.id) === Number(variant.id) && i.quantity === 1) && lines.some(i => Number(i.variant_id || i.id) === Number(stone.variant) && i.quantity === 1); }
    async function removeGroup(lines) {
      if (!lines.length) return;
      const updates = Object.fromEntries(lines.map(item => [item.key, 0]));
      await request(route('cart/update.js'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ updates }) });
    }
    async function addRing() {
      if (state.busy || !both() || !state.size || !pickedVariant() || (state.band && !bandVariant())) return;
      const oldTotal = subtotal(), settingHandle = state.setting.handle, diamondHandle = state.diamond.handle;
      state.busy = true;
      notice(t('adding'));
      summary();
      lockControls();
      let addAttempted = false, selectedVariant;
      try {
        const [freshSetting, freshDiamond, freshBand] = await Promise.all([product(settingHandle), diamond(diamondHandle), state.band ? product(state.band.handle) : null]);
        if (freshBand) {
          if (!freshBand.band || !knownBands.has(freshBand.handle)) throw new Error(t('unavailable'));
          state.band = freshBand;
          if (!bandVariant()) throw new Error(t('band_options_required'));
        }
        setSetting(freshSetting, true);
        if (freshSetting.shape !== freshDiamond.shape) throw new Error(t('wrong_shape'));
        state.diamond = freshDiamond;
        selectedVariant = pickedVariant();
        if (!state.size || !selectedVariant) throw new Error(t('size_unavailable'));
        if (subtotal() !== oldTotal) throw new Error(t('price_changed'));
        if (!state.group) state.group = 'lmny-' + (globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2));
        persist();
        const current = await cart(), existing = groupLines(current);
        if (completeGroup(existing, selectedVariant, state.diamond)) { if (state.editGroup && state.editGroup !== state.group) await removeGroup(groupLines(current, state.editGroup)); window.location.assign(cfg.cartUrl); return; }
        if (existing.length) await removeGroup(existing);
        const properties = { _lm_ring_id: state.group, _lm_setting_handle: settingHandle, _lm_diamond_handle: diamondHandle, Ring: state.setting.title, Diamond: state.diamond.title, 'Ring size': state.size === 'unsure' ? t('not_sure') : state.size };
        if (state.band) properties._lm_band_handle = state.band.handle;
        if (state.size === 'unsure') properties['Size check'] = t('not_sure');
        state.setting.options.forEach((o, i) => { if (!/size/i.test(o.name) && o.name !== 'Title') properties[o.name] = selectedVariant.options[i]; });
        if (state.engraving.trim()) { properties.Engraving = state.engraving.trim().slice(0, 20); properties['Engraving font'] = t(state.font === 'script' ? 'script' : 'block'); }
        if (state.date) properties['Requested date'] = state.date;
        const items = [{ id: selectedVariant.id, quantity: 1, properties }, { id: state.diamond.variant, quantity: 1, properties: { _lm_ring_id: state.group, _lm_setting_handle: settingHandle, _lm_diamond_handle: diamondHandle, 'Set in': state.setting.title, 'Ring size': properties['Ring size'] } }];
        if (state.band) items.push({ id: bandVariant().id, quantity: 1, properties: { _lm_ring_id: state.group, _lm_band_handle: state.band.handle, _lm_setting_handle: settingHandle, _lm_diamond_handle: diamondHandle, 'Paired with': state.setting.title } });
        addAttempted = true;
        await request(route('cart/add.js'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items }) });
        const verified = groupLines(await cart());
        if (!completeGroup(verified, selectedVariant, state.diamond)) { await removeGroup(verified); throw new Error(t('cart_failed')); }
        if (state.editGroup && state.editGroup !== state.group) await removeGroup(groupLines(await cart(), state.editGroup));
        state.editGroup = ''; persist();
        notice(t('added'));
        window.location.assign(cfg.cartUrl);
      } catch (error) {
        if (addAttempted) {
          try {
            const lines = groupLines(await cart());
            if (selectedVariant && completeGroup(lines, selectedVariant, state.diamond)) { if (state.editGroup && state.editGroup !== state.group) await removeGroup(groupLines(await cart(), state.editGroup)); window.location.assign(cfg.cartUrl); return; }
            await removeGroup(lines);
          } catch (_) { error = new Error(t('cart_uncertain')); }
        }
        state.busy = false;
        go('review');
        notice(error.message || t('cart_failed'), true);
      }
    }
    function choose() {
      try {
        if (state.kind === 'setting') setSetting(state.detail);
        else { if (state.setting && state.detail.shape !== state.setting.shape) throw new Error(t('wrong_shape')); state.diamond = state.detail; state.filters.shape = state.diamond.shape; }
        state.group = '';
        if (both()) go('review'); else { state.kind = state.kind === 'setting' ? 'diamond' : 'setting'; state.page = 1; state.returnIndex = null; go('catalog'); }
      } catch (error) { notice(error.message, true); }
    }
    root.addEventListener('mouseover', event => {
      const media = event.target.closest('[data-video]');
      if (!media || media.querySelector('video') || !matchMedia('(hover: hover)').matches) return;
      media.insertAdjacentHTML('beforeend', `<video muted loop playsinline autoplay preload="none" aria-hidden="true" src="${esc(media.dataset.video)}"></video>`);
    });
    root.addEventListener('mouseout', event => {
      const media = event.target.closest('[data-video]');
      if (media && !media.contains(event.relatedTarget)) media.querySelector('video')?.remove();
    });
    root.addEventListener('click', async event => {
      const originLink = event.target.closest('[data-origin]');
      if (originLink) {
        event.preventDefault();
        if (state.busy) return;
        readDiamondFilters(); state.filters.origin = originLink.dataset.origin;
        state.page = 1; paintDiamondFilters(); search(); persist(); return;
      }
      const resetLink = event.target.closest('.lm-dfilter__reset');
      if (resetLink) event.preventDefault();
      const el = event.target.closest('[data-action]');
      if (!el || el.disabled || state.busy) return;
      const action = el.dataset.action;
      if (!action.startsWith('photo-') && !action.startsWith('video-')) notice('');
      if (action === 'remove-band') { state.band = null; state.bandOptions = []; state.group = ''; render(); }
      else if (action.startsWith('start-') || action.startsWith('change-')) {
        state.kind = action.split('-')[1]; state.page = 1; state.returnIndex = null;
        if (state.kind === 'setting') state.filters.shape = state.diamond ? state.diamond.shape : settingShape(state.filters.shape);
        if (state.kind === 'diamond' && state.setting) state.filters.shape = state.setting.shape;
        go('catalog');
      } else if (action.startsWith('details-')) openDetails(Number(action.slice(8)));
      else if (action.startsWith('quick-')) openDetails(Number(action.slice(6)), true);
      else if (action === 'select') choose();
      else if (action === 'more-filters') { state.moreFilters = el.getAttribute('aria-expanded') !== 'true'; el.setAttribute('aria-expanded', String(state.moreFilters)); main.querySelector('[data-more-filters]').hidden = !state.moreFilters; paintDiamondFilters(); }
      else if (action.startsWith('carat-')) {
        readDiamondFilters();
        const [low, high] = caratChips[Number(action.slice(6))];
        const on = state.filters.min_carat === low && state.filters.max_carat === high;
        state.filters.min_carat = on ? '' : low; state.filters.max_carat = on ? '' : high;
        paintDiamondFilters(); state.page = 1; search(); persist();
      } else if (action.startsWith('clear-')) { state[action.slice(6)] = null; state.group = ''; go('catalog'); }
      else if (action === 'review') go('review');
      else if (action === 'catalog' || action === 'start') { state.returnIndex = action === 'catalog' && state.screen === 'detail' ? state.detailIndex : null; go(action); }
      else if (action === 'reset') resetSearch();
      else if (action === 'retry') search();
      else if (action === 'next' || action === 'previous') { state.page += action === 'next' ? 1 : -1; reveal(main.querySelector('.toolbar')); search(); persist(); }
      else if (action === 'dock-summary') reveal(aside);
      else if (action === 'share') share();
      else if (action === 'review-video') {
        const src = (state.setting.videos || []).map(safeURL).find(Boolean);
        if (src) main.querySelector('[data-review-media="setting"]').innerHTML = `<video controls playsinline autoplay muted preload="metadata" src="${esc(src)}"></video>`;
      }
      else if (action === 'dock-add') {
        const field = main.querySelector('[data-field="size"]');
        if (!state.size && field) { notice(t('size_required'), true); reveal(field); field.focus({ preventScroll: true }); }
        else if (!pickedVariant()) notice(t('size_unavailable'), true);
        else if (state.band && !bandVariant()) notice(t('band_options_required'), true);
        else addRing();
      }
      else if (action.startsWith('photo-')) { state.photo = Number(action.slice(6)); detail(); }
      else if (action.startsWith('video-')) {
        const src = safeURL(state.detailVideos[Number(action.slice(6))]);
        if (src) main.querySelector('[data-media]').innerHTML = `<video controls playsinline preload="metadata" src="${esc(src)}"></video>`;
      } else if (action === 'add') addRing();
      else if (action === 'restart') {
        state.setting = null; state.diamond = null; state.band = null; state.bandOptions = []; state.size = ''; state.options = []; state.engraving = ''; state.font = 'block'; state.date = ''; state.group = ''; state.editGroup = ''; state.page = 1; go('start');
      }
    });
    root.addEventListener('submit', event => {
      if (event.target.id === 'RingEmailForm') { if (both()) fillRingEmail(event.target); else event.preventDefault(); return; }
      if (!event.target.matches('[data-search-form]')) return;
      event.preventDefault();
      if (state.busy) return;
      readDiamondFilters();
      if (!rangesValid()) { clearTimeout(searchTimer); notice(t('range_error'), true); return; }
      notice(''); state.page = 1; search(); persist();
    });
    root.addEventListener('change', async event => {
      if (state.busy) return;
      const el = event.target;
      if (el.hasAttribute('data-band-product')) {
        const handle = el.value;
        if (!handle) { state.band = null; state.bandOptions = []; state.group = ''; render(); return; }
        state.busy = true; lockControls(); notice(t('loading_piece'));
        try { await selectBand(handle); state.group = ''; notice(''); }
        catch (error) { notice(error.message, true); }
        finally { state.busy = false; render(); }
        return;
      }
      if (el.hasAttribute('data-band-option')) { state.bandOptions[Number(el.dataset.bandOption)] = el.value; state.group = ''; render(); return; }
      if (el.closest('#DiamondFilterForm')) { readDiamondFilters(); paintDiamondFilters(); persist(); queueSearch(el.type === 'number' ? 700 : 250); return; }
      if (el.dataset.filter) {
        state.filters[el.dataset.filter] = el.value;
        if (state.kind === 'setting') {
          state.page = 1;
          if (el.dataset.filter === 'shape') { state.filters.metal = ''; catalogShell(); main.querySelector('[data-filter="shape"]').focus(); }
          settingResults(); persist();
        }
      } else if (el.hasAttribute('data-sort')) { state.filters.sort = el.value; state.page = 1; search(); persist(); }
      else if (el.hasAttribute('data-option')) { state.options[Number(el.dataset.option)] = el.value; state.group = ''; render(); }
      else if (el.dataset.field) {
        state[el.dataset.field] = el.value;
        state.group = '';
        if (el.dataset.field === 'size') { summary(); main.querySelector('[data-scale-view]')?.insertAdjacentHTML('afterend', scaleView()); main.querySelector('[data-scale-view]')?.remove(); }
        if (el.dataset.field === 'font') main.querySelector('[data-inscription]').classList.toggle('script', state.font === 'script');
        persist();
      }
    });
    root.addEventListener('input', event => {
      if (state.busy) return;
      const el = event.target;
      if (el.closest('#DiamondFilterForm')) { readDiamondFilters(); paintDiamondFilters(); if (el.type === 'number') queueSearch(700); return; }
      if (el.dataset.filter) state.filters[el.dataset.filter] = el.value;
      if (el.dataset.field === 'engraving') { state.engraving = el.value.slice(0, 20); state.group = ''; const inscription = main.querySelector('[data-inscription]'); inscription.textContent = state.engraving; inscription.hidden = !state.engraving; persist(); }
    });
    async function restore() {
      let stored = {};
      try { stored = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch (_) {}
      if (!(Date.now() - Number(stored.saved) < keepFor)) stored = {};
      const params = new URLSearchParams(location.search);
      const linked = params.has('setting') || params.has('diamond') || params.has('start');
      const settingHandle = linked ? params.get('setting') : stored.setting;
      const diamondHandle = linked ? params.get('diamond') : stored.diamond;
      const requestedShape = params.get('shape');
      const edit = params.get('edit_group') || stored.editGroup;
      if (/^lmny-[a-z0-9-]+$/i.test(edit || '')) state.editGroup = edit;
      const sameSelection = (!params.has('setting') || params.get('setting') === stored.setting) && (!params.has('diamond') || params.get('diamond') === stored.diamond);
      if (sameSelection) {
        state.size = typeof stored.size === 'string' ? stored.size : '';
        state.options = Array.isArray(stored.options) ? stored.options : [];
        state.engraving = typeof stored.engraving === 'string' ? stored.engraving.slice(0, 20) : '';
        state.date = /^\d{4}-\d{2}-\d{2}$/.test(stored.date || '') ? stored.date : '';
        state.font = stored.font === 'script' ? 'script' : 'block';
        state.group = /^lmny-[a-z0-9-]+$/i.test(stored.group || '') ? stored.group : '';
        if (stored.filters && String(stored.filters.shape).split(',').every(shapeKnown)) state.filters = { ...state.filters, ...stored.filters };
      }
      if (requestedShape && shapeKnown(requestedShape)) state.filters.shape = requestedShape;
      if (!settingHandle && !diamondHandle) {
        main.dataset.initialStart = 'true';
        root.dataset.diamondImage = main.querySelector('[data-action="start-diamond"] img')?.src || '';
        const begin = params.get('start');
        if (begin === 'diamond' || begin === 'setting') {
          state.kind = begin; state.page = 1;
          if (begin === 'setting') state.filters.shape = settingShape(state.filters.shape);
          go('catalog');
        }
        ready = true;
        return;
      }
      root.dataset.diamondImage = main.querySelector('[data-action="start-diamond"] img')?.src || '';
      notice(t('restoring'));
      state.busy = true; lockControls();
      let editLine = null, editBand = null;
      if (state.editGroup) {
        try {
          const lines = groupLines(await cart(), state.editGroup);
          editBand = lines.find(line => line.properties?._lm_band_handle === line.handle);
          editLine = lines.find(line => line.properties?._lm_setting_handle === settingHandle && line.handle === settingHandle);
          if (editLine) {
            const props = editLine.properties || {};
            state.size = props['Size check'] ? 'unsure' : String(props['Ring size'] || '');
            state.engraving = String(props.Engraving || '').slice(0, 20);
            state.font = props['Engraving font'] === t('script') ? 'script' : 'block';
            state.date = /^\d{4}-\d{2}-\d{2}$/.test(props['Requested date'] || '') ? props['Requested date'] : '';
            state.group = state.editGroup;
          }
        } catch (_) {}
      }
      let failed = false;
      if (settingHandle) { try { const p = await product(settingHandle); if (editLine) state.options = p.variants.find(v => Number(v.id) === Number(editLine.variant_id || editLine.id))?.options?.slice() || []; setSetting(p, sameSelection || !!editLine); } catch (_) { failed = true; state.setting = null; } }
      if (diamondHandle) { try { state.diamond = await diamond(diamondHandle); } catch (_) { failed = true; state.diamond = null; } }
      if (editBand || (!state.editGroup && sameSelection && stored.band)) {
        try {
          await selectBand(editBand?.handle || stored.band, Array.isArray(stored.bandOptions) ? stored.bandOptions : []);
          if (editBand) state.bandOptions = state.band.variants.find(v => Number(v.id) === Number(editBand.variant_id || editBand.id))?.options.slice() || [];
        } catch (_) { failed = true; state.band = null; state.bandOptions = []; }
      }
      state.busy = false;
      state.kind = state.setting ? 'diamond' : state.diamond ? 'setting' : 'diamond';
      if (state.setting) state.filters.shape = state.setting.shape;
      if (state.diamond) state.filters.shape = state.diamond.shape;
      go(both() ? 'review' : 'catalog');
      notice(failed ? t('restore_failed') : '', failed);
      ready = true;
    }
    restore();
  }
  initialize();
  document.addEventListener('shopify:section:load', initialize);
})();
