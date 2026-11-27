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
    const sentBox = root.querySelector('[data-ring-sent]');
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
    const image = (src, alt = '', cls = '', eager = false) => safeURL(src) ? `<img class="${cls}" src="${esc(safeURL(src))}" alt="${esc(alt)}" width="800" height="800" loading="${eager ? 'eager' : 'lazy'}" decoding="async">` : '';
    const state = { screen: 'start', kind: 'diamond', entry: '', setting: null, diamond: null, bandSelections: [{ product: null, options: [] }, { product: null, options: [] }], bandSlot: 0, bandsCollapsed: false, bandCategory: 'diamond', showAllBands: false, bandMetal: '', bandStyle: '', options: [], size: '', choicePrompt: false, engraving: '', font: 'block', date: '', detail: null, photo: 0, page: 1, totalPages: 1, rows: [], busy: false, generation: 0, group: '', editGroup: '', filters: { origin: 'lab', shape: 'Oval', style: '', metal: '', color: '', clarity: '', cut: '', min_carat: '', max_carat: '', min_price: '', max_price: '', sort: 'price_asc' } };
    let historyMode = 'replace', navPush = false;
    // The picker edits one slot; totals, persistence and cart operations use both.
    Object.defineProperties(state, {
      band: { get: () => state.bandSelections[state.bandSlot].product, set: p => { state.bandSelections[state.bandSlot].product = p; } },
      bandOptions: { get: () => state.bandSelections[state.bandSlot].options, set: options => { state.bandSelections[state.bandSlot].options = options; } }
    });
    const knownSettings = new Map(cfg.settings.filter(p => p.setting && shapes.includes(p.shape)).map(p => [p.handle, p]));
    const knownBands = new Set((cfg.bands || []).map(p => p.handle));
    const settingCount = shape => supplierDesigns.filter(design => String(shape || '').split(',').some(s => s.trim().toLowerCase() === design.shape.toLowerCase())).length;
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
    function accentText(p) {
      const n = Number(p.accent);
      if (p.accent != null && p.accent !== '' && Number.isFinite(n)) return t('accent_carat', { carat: n.toFixed(2) });
      const match = String(p.handle || '').match(/-(\d+)-(\d+)-ct$/);
      return match ? t('accent_carat', { carat: Number(match[1] + '.' + match[2]).toFixed(2) }) : '';
    }
    function settingHeading(p) {
      const accent = accentText(p);
      const duplicated = [...knownSettings.values()].filter(s => s.title === p.title).length > 1;
      return duplicated && accent ? p.title + ' — ' + accent : p.title;
    }
    function settingSubtitle(p) {
      return [p.shape, t('setting_only'), p.metalLabel, accentText(p)].filter(Boolean).join(' · ');
    }
    function metalPriceLines(p) {
      const lines = new Map();
      for (const v of (p.variants || []).filter(v => v.available)) {
        const label = (p.options || []).map((o, i) => /size/i.test(o.name) || o.name === 'Title' ? '' : v.options[i]).filter(Boolean).join(' · ');
        if (!label) continue;
        const price = Number(v.price);
        if (!lines.has(label) || price < lines.get(label)) lines.set(label, price);
      }
      return [...lines.entries()];
    }
    function settingPriceHtml(p) {
      const lines = metalPriceLines(p);
      if (lines.length <= 1) return esc(lines.length ? money(lines[0][1]) : fromPrice(p));
      return lines.map(([label, price]) => `<span class="metal-price">${esc(label)} ${esc(money(price))}</span>`).join('');
    }
    const metalOf = text => (String(text || '').match(/platinum|white|yellow|rose/i) || [''])[0].toLowerCase();
    const metalName = metal => t('metal_' + metal);
    const settingMetals = p => [...new Set(p.variants.filter(v => v.available).map(v => metalOf(v.options.join(' '))).concat(metalOf(p.title)).filter(Boolean))];
    const caratChips = [['1', '1.49'], ['1.5', '1.99'], ['2', '2.99'], ['3', '']];
    const gradePick = { color: 'G,F,E,D', clarity: 'VS2,VS1,VVS2,VVS1,IF,FL' };
    let ready = false, searchTimer = 0;
    const bandVariant = (slot = state.bandSlot) => { const b = state.bandSelections[slot]; return b.product?.variants.find(v => v.available && v.options.every((value, i) => value === b.options[i])) || null; };
    const chosenBands = () => state.bandSelections.map((b, slot) => ({ ...b, slot, variant: bandVariant(slot) })).filter(b => b.product);
    const bandsValid = () => chosenBands().every(b => b.variant);
    const hasBands = () => chosenBands().length > 0;
    const bandLabel = slot => t(slot ? 'band_for_partner' : 'band_for_ring');
    const bandOptionText = b => b.product.options.map((o, i) => o.name === 'Title' ? '' : o.name + ': ' + (b.options[i] || t('choose_option'))).filter(Boolean).join(' · ');
    const both = () => state.setting && state.diamond;
    const sizeIndex = p => p.options.findIndex(o => /size/i.test(o.name));
    const optionsOf = p => p.options.filter(o => !/size/i.test(o.name) && o.name !== 'Title');
    function optionsReady(p = state.setting) {
      if (!p) return false;
      const si = sizeIndex(p);
      return p.options.every((o, i) => i === si || o.name === 'Title' || o.values.length < 2 || state.options[i]);
    }
    function chosenDetails(p) {
      if (!p) return '';
      const si = sizeIndex(p);
      return p.options.map((o, i) => i === si || o.name === 'Title' || !state.options[i] ? '' : state.options[i]).filter(Boolean).join(' · ');
    }
    // An empty size must not match a variant. The first available variant is
    // often size 6, and treating "no choice" as that variant put size 6 in the bag.
    function pickedVariant(p = state.setting) {
      if (!p || !state.size || !optionsReady(p)) return null;
      const si = sizeIndex(p);
      return p.variants.find(v => v.available && v.options.every((value, i) => i === si ? state.size === 'unsure' || String(value) === String(state.size) : value === state.options[i])) || null;
    }
    function explicitOptions(p, seed) {
      const si = sizeIndex(p);
      return p.options.map((o, i) => {
        if (o.name === 'Title') return seed?.[i] || o.values[0] || '';
        if (i === si || o.values.length > 1) return '';
        return o.values[0] || seed?.[i] || '';
      });
    }
    const styleOf = p => /three[- ]stone/i.test(p.title + ' ' + p.handle) ? 'three-stone' : /hidden[- ]halo/i.test(p.title + ' ' + p.handle) ? 'hidden-halo' : /solitaire/i.test(p.title + ' ' + p.handle) ? 'solitaire' : '';
    const variantPrice = p => p === state.setting ? pickedVariant(p)?.price : p?.variants?.find(v => v.available)?.price;
    const subtotal = () => (variantPrice(state.setting) || 0) + (state.diamond?.price || 0) + chosenBands().reduce((total, b) => total + (b.variant?.price || 0), 0);
    // The consent API is not automatically present on every storefront visit.
    // Wait for its supported loader; never interpret an unavailable API as consent.
    const privacyReady = new Promise(resolve => {
      if (window.Shopify?.customerPrivacy) return resolve();
      if (!window.Shopify?.loadFeatures) return resolve();
      try { window.Shopify.loadFeatures([{ name: 'consent-tracking-api', version: '0.2' }], () => resolve()); }
      catch (_) { resolve(); }
    });
    let openedTracked = false;
    function track(event, extra = {}) {
      const data = { screen: state.screen, origin: state.diamond?.origin || state.filters.origin, band_count: chosenBands().length, device_type: matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop', ...extra };
      return privacyReady.then(() => {
        if (!root.isConnected || window.Shopify?.customerPrivacy?.analyticsProcessingAllowed?.() !== true) return;
        if (event === 'builder_opened' && openedTracked) return;
        if (typeof window.LMNYGa4?.track !== 'function') return;
        if (event === 'builder_opened') openedTracked = true;
        // Share the storefront Google tag and its session identity.
        return window.LMNYGa4.track(event, data).then(result => {
          if (event === 'builder_opened' && result === false) openedTracked = false;
        });
      }).catch(() => { if (event === 'builder_opened') openedTracked = false; });
    }
    document.addEventListener('visitorConsentCollected', () => {
      if (ready && !openedTracked) track('builder_opened');
    });
    function consultationLink() {
      const url = new URL(cfg.appointment, location.origin);
      url.searchParams.set('interest', 'ring');
      if (both()) url.hash = 'ring=' + encodeURIComponent(ringLink().href);
      return url.href;
    }
    function notice(message, error = false) {
      status.textContent = message;
      status.classList.toggle('error', error);
      status.setAttribute('role', error ? 'alert' : 'status');
    }
    const urlFilters = ['design', 'origin', 'shape', 'style', 'metal', 'color', 'clarity', 'cut', 'min_carat', 'max_carat', 'min_price', 'max_price', 'sort'];
    function persist() {
      const stored = { bands: state.bandSelections.map(b => ({ handle: b.product?.handle, options: b.options })), bandSlot: state.bandSlot, entry: state.entry, setting: state.setting?.handle, diamond: state.diamond?.handle, size: state.size, options: state.options, engraving: state.engraving, font: state.font, date: state.date, screen: state.screen, filters: state.filters, group: state.group, editGroup: state.editGroup };
      try { localStorage.setItem(storageKey, JSON.stringify({ ...stored, saved: Date.now() })); if (ready && both() && !state.savedEvent) { state.savedEvent = true; track('build_saved'); } } catch (_) {}
      const u = new URL(window.location.href);
      if (u.hash.startsWith('#build=')) u.hash = '';
      for (const k of ['setting', 'diamond', 'step', 'edit_group', ...urlFilters]) u.searchParams.delete(k);
      if (state.entry === 'setting' || state.entry === 'diamond') u.searchParams.set('start', state.entry);
      if (state.editGroup) u.searchParams.set('edit_group', state.editGroup);
      if (stored.setting) u.searchParams.set('setting', stored.setting);
      if (stored.diamond) u.searchParams.set('diamond', stored.diamond);
      const step = state.screen === 'review' ? 'review' : state.screen === 'catalog' || state.screen === 'detail' ? state.kind : '';
      if (step) u.searchParams.set('step', step);
      for (const key of urlFilters) {
        const value = state.filters[key];
        const skip = !value || (key === 'origin' && value === 'lab') || (key === 'sort' && value === 'price_asc') || (key === 'shape' && value === 'Oval' && !state.filters.style);
        if (!skip) u.searchParams.set(key, value);
      }
      const next = u.pathname + u.search + u.hash;
      const current = window.location.pathname + window.location.search + window.location.hash;
      if (next !== current) {
        if (historyMode === 'push') history.pushState({ lmRing: 1 }, '', next);
        else history.replaceState({ lmRing: 1 }, '', next);
      }
    }
    async function request(url, options = {}) {
      const timeout = options.timeout || 20000;
      const parent = options.signal;
      const rest = { ...options };
      delete rest.timeout;
      delete rest.signal;
      const controller = new AbortController();
      const stopParent = () => controller.abort();
      if (parent) {
        if (parent.aborted) controller.abort();
        else parent.addEventListener('abort', stopParent, { once: true });
      }
      let timer;
      const timed = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          const error = new Error(t('load_timeout'));
          error.name = 'TimeoutError';
          reject(error);
        }, timeout);
      });
      try {
        const res = await Promise.race([fetch(url, { ...rest, signal: controller.signal }), timed]);
        const data = await res.json();
        if (!res.ok || data.status >= 400) throw new Error(data.description || data.error || t('request_failed'));
        return data;
      } finally {
        clearTimeout(timer);
        if (parent) parent.removeEventListener('abort', stopParent);
      }
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
      const previous = state.options.slice();
      state.setting = p;
      if (!restore) {
        const first = p.variants.find(v => v.available && state.filters.metal && metalOf(v.options.join(' ')) === state.filters.metal) || p.variants.find(v => v.available);
        // Multi-value metals stay blank until the shopper picks one. A single
        // metal is the only choice, so it can be selected and highlighted.
        state.options = explicitOptions(p, first?.options);
        p.options.forEach((o, i) => {
          if (sizeIndex(p) !== i && o.name !== 'Title' && o.values.length > 1 && previous[i] && o.values.includes(previous[i])) state.options[i] = previous[i];
        });
        const si = sizeIndex(p);
        if (si >= 0 && state.size && state.size !== 'unsure' && !p.variants.some(v => v.available && String(v.options[si]) === String(state.size))) state.size = '';
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
    function reviewAction(action) {
      const label = state.busy ? 'adding' : !state.size ? 'choose_size' : !optionsReady() || !pickedVariant() || !bandsValid() ? 'choose_option' : chosenBands().length > 1 ? 'add_with_bands' : hasBands() ? 'add_with_band' : 'add';
      const hint = !state.size ? 'size_required' : !optionsReady() ? 'metal_required' : !pickedVariant() ? 'size_unavailable' : !bandsValid() ? 'band_options_required' : '';
      return button(label, action, 'primary', state.busy || !both() ? 'disabled' : '') + (hint ? `<p class="${state.choicePrompt ? 'error' : 'quiet'} next-step">${esc(t(hint))}</p>` : '');
    }
    function summary() {
      aside.hidden = state.screen === 'start';
      root.querySelector('.layout').classList.toggle('solo', aside.hidden);
      root.querySelector('[data-flow-dock]').hidden = aside.hidden;
      document.body.classList.toggle('has-pdp-sticky', !aside.hidden);
      if (aside.hidden) return;
      aside.innerHTML = `<h2>${esc(t('your_ring'))}</h2><div class="summary-items">${['setting', 'diamond'].map(k => {
        const p = state[k];
        const price = k === 'setting' ? variantPrice(p) : p?.price;
        const detail = k === 'setting' ? chosenDetails(p) : '';
        return `<div class="sum-item"><div class="sum-title"><span class="eyebrow">${esc(t(k))}</span>${p ? button('change', 'change-' + k, 'link') : ''}</div>${p ? `<div class="sum-product">${image(p.image, '', 'thumb')}<div>${esc(p.title)}${detail ? ' · ' + esc(detail) : ''}<br>${price != null ? money(price) : esc(t(k === 'setting' && state.size && !optionsReady() ? 'metal_required' : 'size_unavailable'))}</div></div>` : `<p class="quiet">${esc(t('empty_selection'))}</p>`}</div>`;
      }).join('')}${bandSummary()}</div><div class="summary-checkout"><div class="row"><span>${esc(t(hasBands() ? 'order_subtotal' : both() ? 'subtotal' : 'selected_total'))}</span><span class="total">${money(subtotal())}</span></div><p class="quiet">${esc(t(both() ? 'included' : state.setting ? 'missing_diamond' : state.diamond ? 'missing_setting' : 'intro'))}</p><p class="quiet">${esc(t('tax_shipping'))}</p>${both() ? `<p class="quiet pairing-note">${esc(t('pairing_note'))}</p>` : ''}${state.screen === 'review' ? button(state.busy ? 'adding' : chosenBands().length > 1 ? 'add_with_bands' : hasBands() ? 'add_with_band' : 'add', 'add', 'primary', !state.size || !optionsReady() || !pickedVariant() || state.busy || !both() || !bandsValid() ? 'disabled' : '') + (!state.size ? `<p class="${state.choicePrompt ? 'error' : 'quiet'}">${esc(t('size_required'))}</p>` : !optionsReady() ? `<p class="${state.choicePrompt ? 'error' : 'quiet'}">${esc(t('metal_required'))}</p>` : !pickedVariant() ? `<p class="error">${esc(t('size_unavailable'))}</p>` : !bandsValid() ? `<p class="quiet">${esc(t('band_options_required'))}</p>` : '') : both() ? button('review_ring', 'review') : ''}<p class="quiet promise">${esc(t('promise'))}</p><a class="link" href="${esc(cfg.cartUrl)}">${esc(t('view_bag'))}</a></div>`;
      const dock = root.querySelector('[data-flow-dock]');
      const next = state.screen === 'review' ? reviewAction('dock-add') : both() ? button('review_ring', 'review') : button('choose_' + (state.setting ? 'diamond' : state.diamond ? 'setting' : state.kind), 'catalog', 'primary');
      const selections = ['setting', 'diamond'].map(k => `<span class="dock-selection" title="${esc(state[k]?.title || t('empty_selection'))}">${esc(t(k))}: ${esc(state[k]?.title || t('empty_selection'))}</span>`).join('');
      dock.innerHTML = `<div><span class="eyebrow">${esc(t(hasBands() ? 'order_subtotal' : both() ? 'subtotal' : 'selected_total'))}</span>${selections}<span class="total">${money(subtotal())}</span></div><div class="dock-action">${next}</div>`;
      const purchase = main.querySelector('[data-review-purchase]');
      if (purchase) purchase.innerHTML = `<div class="row"><span>${esc(t(hasBands() ? 'order_subtotal' : 'subtotal'))}</span><strong class="total">${money(subtotal())}</strong></div>${reviewAction('review-add')}<p class="quiet">${esc(t('production_note'))} <a class="link" href="${esc(consultationLink())}">${esc(t('compare_with_laura'))}</a></p>`;
      if (state.busy) lockControls();
    }
    function lockControls() {
      root.querySelectorAll('button,input,select').forEach(el => { el.disabled = true; });
      root.setAttribute('aria-busy', 'true');
    }
    function start() {
      const serverStart = main.dataset.initialStart === 'true' && main.querySelector('[data-action="start-diamond"]');
      main.dataset.initialStart = 'false';
      if (!serverStart) main.innerHTML = `<h2>${esc(t('where'))}</h2><div class="paths">${['diamond', 'setting'].map(k => {
        const p = k === 'setting' ? supplierDesigns[0] : null;
        const src = p?.image || root.dataset.diamondImage || '';
        return `<button type="button" class="path" data-action="start-${k}">${image(src, t(k), '', true)}<div><h2>${esc(t('start_' + k))}</h2><p class="quiet">${esc(t(k + '_intro'))}</p><span class="eyebrow">${esc(t('choose_' + k))} →</span></div></button>`;
      }).join('')}</div>`;
    }
    function selectField(label, key, values, current, disabled = false) {
      return `<label>${esc(t(label))}<select data-filter="${key}" ${disabled ? 'disabled' : ''}>${values.map(([v, text]) => `<option value="${esc(v)}" ${v === current ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
    }
    function filters() {
      const lock = state.kind === 'diamond' ? state.setting : state.diamond;
      const shape = lock?.shape || state.filters.shape;
      const shapeOptions = shapes.filter(s => supplierDesigns.some(design => design.shape === s) || s === shape).map(s => [s, s]);
      if (!lock) shapeOptions.unshift(['', t('all_shapes')]);
      const metals = [...new Set(supplierDesigns.filter(design => (!shape || design.shape === shape) && (!state.filters.style || design.style === state.filters.style)).map(design => metalOf(design.metal)).filter(Boolean))];
      const metalField = metals.length > 1 ? selectField('metal', 'metal', [['', t('all_metals')], ...metals.map(m => [m, metalName(m)])], state.filters.metal) : '';
      const styles = [...new Set(supplierDesigns.filter(design => !shape || design.shape === shape).map(design => design.style))].sort();
      const styleLabel = style => style.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
      const styleField = selectField('Style', 'style', [['', 'All styles'], ...styles.map(style => [style, styleLabel(style)])], state.filters.style);
      if (state.kind === 'setting') return `<div class="filters">${selectField('shape', 'shape', shapeOptions, shape, !!lock)}${styleField}${metalField}</div>${lock ? `<p class="quiet">${esc(t('shape_locked', { shape }))} ${button('clear_diamond', 'clear-diamond', 'link')}</p>` : ''}`;
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
      form.querySelectorAll('.carat-chips [data-action^="carat-"]').forEach((chip, i) => {
        const [low, high] = caratChips[i];
        chip.setAttribute('aria-pressed', String(state.filters.min_carat === low && state.filters.max_carat === high));
      });
      form.querySelector('[data-action="pick-grades"]')?.setAttribute('aria-pressed', String(state.filters.color === gradePick.color && state.filters.clarity === gradePick.clarity));
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
          input.placeholder = String(side === 'min' ? floor : ceil);
          // The ceiling is a placeholder, not the value. Writing 250000 back into
          // the field after the shopper applied 15000 made the box disagree with the results.
          if (document.activeElement !== input) input.value = state.filters[side + '_' + key] || '';
        });
        const rawLow = range.querySelector('[data-range-min]').value;
        const rawHigh = range.querySelector('[data-range-max]').value;
        const low = rawLow === '' ? floor : Number(rawLow);
        const high = rawHigh === '' ? ceil : Number(rawHigh);
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
      chips.innerHTML = caratChips.map(([low, high], i) => `<button type="button" class="chip" data-action="carat-${i}" aria-pressed="false">${esc(t(high ? 'carat_value' : 'carat_plus', { carat: low }))}</button>`).join('') + `<button type="button" class="chip" data-action="pick-grades" aria-pressed="false">${esc(t('pick_grades'))}</button>`;
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
          const value = range.querySelector('[data-range-' + side + ']').value.trim();
          const bound = side === 'min' ? range.dataset.floor : range.dataset.ceil;
          state.filters[side + '_' + key] = value === '' || Number(value) === Number(bound) ? '' : value;
        }
      });
    }

    function catalogShell() {
      const k = state.kind;
      main.innerHTML = `<div class="heading"><h2>${esc(t('choose_' + k))}.</h2>${button('back', 'back-step', 'link')}</div>${filters()}<div class="toolbar"><span class="quiet" data-count>${esc(t('loading'))}</span>${k === 'diamond' ? `<label>${esc(t('sort'))}<select data-sort>${['price_asc', 'price_desc', 'carat_asc', 'carat_desc'].map(s => `<option value="${s}" ${state.filters.sort === s ? 'selected' : ''}>${esc(t(s))}</option>`).join('')}</select></label>` : ''}</div><div data-results></div><div class="pager" data-pager></div><p class="quiet rule">${esc(t(k === 'diamond' ? 'unit_usd' : 'setting_only'))}</p>`;
      if (k === 'diamond') { decorateShapes(); decorateFilters(); paintDiamondFilters(); }
    }
    function empty(settings = false) {
      return `<div class="empty"><h3>${esc(t('no_matches'))}</h3><p class="quiet">${esc(t(settings ? 'no_settings' : 'widen'))}</p>${settings ? `<a class="secondary" href="${esc(cfg.contact)}">${esc(t('custom_setting'))}</a>` : button('reset', 'reset', 'secondary')}</div>`;
    }
    // Made-to-order supplier designs. Quote-only prices use twice the estimated setting cost, after deducting a comparable center diamond.
    const supplierDesigns = [
      {
        "title": "Oval Hidden Halo",
        "reference": "oval-hidden-halo-3",
        "style": "hidden-halo",
        "video": "https://im.lgdus.co/Jwl/RG8540/RG8540.mp4",
        "price": 248596,
        "shape": "Oval",
        "center": 3,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8540_20_1.png?v=1791392613"
      },
      {
        "title": "Oval Three-Stone",
        "reference": "oval-three-stone-3",
        "style": "three-stone",
        "video": "https://lgdus.co/RGW3OVHM/RGW3OVHM%20(1).mp4",
        "price": 286790,
        "shape": "Oval",
        "center": 3,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGW3OVHM_20_1.png?v=1791392607",
        "genericPhoto": true
      },
      {
        "title": "Oval Solitaire",
        "reference": "oval-solitaire-2",
        "style": "solitaire",
        "video": "https://im.lgdus.co/Jwl/RG7834/RG7834.mp4",
        "price": 199398,
        "shape": "Oval",
        "center": 2,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7834_20_1.png?v=1791392616"
      },
      {
        "title": "Marquise Solitaire",
        "style": "solitaire",
        "shape": "Marquise",
        "center": 2.05,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG6142_20_1.png?v=1790487325",
        "reference": "2-05-ct-marquise-lab-grown-diamond-solitaire-ring-in-14k-yellow-gold-rg14ysomq200pin",
        "price": 189160,
        "finishedHandle": "2-05-ct-marquise-lab-grown-diamond-solitaire-ring-in-14k-yellow-gold-rg14ysomq200pin"
      },
      {
        "title": "Marquise Solitaire",
        "style": "solitaire",
        "shape": "Marquise",
        "center": 2.6,
        "metal": "14K Two-Tone Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG6091_20_1.png?v=1790487327",
        "reference": "2-6-ct-marquise-lab-grown-diamond-solitaire-ring-in-14k-two-tone-rg14ttsomq250pns",
        "price": 207480,
        "finishedHandle": "2-6-ct-marquise-lab-grown-diamond-solitaire-ring-in-14k-two-tone-rg14ttsomq250pns"
      },
      {
        "title": "Marquise Solitaire",
        "style": "solitaire",
        "shape": "Marquise",
        "center": 1.59,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7692_20_1.png?v=1790487329",
        "reference": "1-59-ct-marquise-lab-grown-diamond-solitaire-ring-in-14k-yellow-gold-rg14ysomq150pns",
        "price": 205656,
        "finishedHandle": "1-59-ct-marquise-lab-grown-diamond-solitaire-ring-in-14k-yellow-gold-rg14ysomq150pns"
      },
      {
        "title": "Oval Solitaire",
        "style": "solitaire",
        "shape": "Oval",
        "center": 1.52,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7666_20_1.png?v=1790487331",
        "reference": "1-52-ct-oval-lab-grown-diamond-solitaire-ring-in-14k-yellow-gold-rg14ysoov150pns",
        "price": 212640,
        "finishedHandle": "1-52-ct-oval-lab-grown-diamond-solitaire-ring-in-14k-yellow-gold-rg14ysoov150pns"
      },
      {
        "title": "Emerald Solitaire",
        "style": "solitaire",
        "shape": "Emerald",
        "center": 1.41,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8674_20_1.png?v=1790487336",
        "reference": "1-41-ct-emerald-lab-grown-diamond-solitaire-ring-in-14k-yellow-gold-rg14ysoem125pns",
        "price": 153120,
        "finishedHandle": "1-41-ct-emerald-lab-grown-diamond-solitaire-ring-in-14k-yellow-gold-rg14ysoem125pns"
      },
      {
        "title": "Marquise Solitaire",
        "style": "solitaire",
        "shape": "Marquise",
        "center": 2.04,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8972_20_1.png?v=1790487338",
        "reference": "2-04-ct-marquise-lab-grown-diamond-solitaire-ring-in-14k-white-gold-rg14wsomq200pns",
        "price": 172672,
        "finishedHandle": "2-04-ct-marquise-lab-grown-diamond-solitaire-ring-in-14k-white-gold-rg14wsomq200pns"
      },
      {
        "title": "Marquise Solitaire",
        "style": "solitaire",
        "shape": "Marquise",
        "center": 2.53,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8974_20_1.png?v=1790487340",
        "reference": "2-53-ct-marquise-lab-grown-diamond-solitaire-ring-in-14k-white-gold-rg14wsomq250pns",
        "price": 191424,
        "finishedHandle": "2-53-ct-marquise-lab-grown-diamond-solitaire-ring-in-14k-white-gold-rg14wsomq250pns"
      },
      {
        "title": "Round Solitaire",
        "style": "solitaire",
        "video": "https://cdn.shopify.com/videos/c/vp/51018d7bb5884b7d9a338247501cd89d/51018d7bb5884b7d9a338247501cd89d.SD-480p-1.5Mbps-95854380.mp4",
        "shape": "Round",
        "center": 1.25,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG5465_20_1.png?v=1790662356",
        "reference": "lab-grown-round-diamond-solitaire-ring-1-25-ct-14k-white-gold",
        "price": 146936,
        "finishedHandle": "lab-grown-round-diamond-solitaire-ring-1-25-ct-14k-white-gold"
      },
      {
        "title": "Emerald East-West",
        "style": "east-west",
        "video": "https://cdn.shopify.com/videos/c/vp/f9881f0c62554409bdfc560ad31db295/f9881f0c62554409bdfc560ad31db295.SD-480p-1.5Mbps-95854398.mp4",
        "shape": "Emerald",
        "center": 0.8,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG6231_20_1.png?v=1790662357",
        "reference": "lab-grown-emerald-diamond-east-west-ring-0-80-ct-14k-yellow-gold",
        "price": 123680,
        "finishedHandle": "lab-grown-emerald-diamond-east-west-ring-0-80-ct-14k-yellow-gold"
      },
      {
        "title": "Antique Marquise Solitaire",
        "style": "solitaire",
        "video": "https://cdn.shopify.com/videos/c/vp/685f7eae7f7b41b2a60914ebb771730a/685f7eae7f7b41b2a60914ebb771730a.SD-480p-1.5Mbps-95854413.mp4",
        "shape": "Marquise",
        "center": 1.02,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8942_20_1.png?v=1790662359",
        "reference": "lab-grown-antique-marquise-diamond-solitaire-ring-1-02-ct-14k-white-gold",
        "price": 147102,
        "finishedHandle": "lab-grown-antique-marquise-diamond-solitaire-ring-1-02-ct-14k-white-gold"
      },
      {
        "title": "Step Marquise Solitaire",
        "style": "solitaire",
        "video": "https://cdn.shopify.com/videos/c/vp/175c277bc5434eb2b692a1a67b40dc6c/175c277bc5434eb2b692a1a67b40dc6c.SD-480p-1.5Mbps-96457194.mp4",
        "shape": "Step Marquise",
        "center": 1.02,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8987_20_1.png?v=1791208774",
        "reference": "step-marquise-lab-grown-diamond-ring-1-02-ct-white-gold",
        "price": 148386,
        "finishedHandle": "step-marquise-lab-grown-diamond-ring-1-02-ct-white-gold"
      },
      {
        "title": "Step Marquise Solitaire",
        "style": "solitaire",
        "video": "https://cdn.shopify.com/videos/c/vp/50011479b2534131829465418d659517/50011479b2534131829465418d659517.SD-480p-1.5Mbps-96457797.mp4",
        "shape": "Step Marquise",
        "center": 1.64,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8988_20_1.png?v=1791209129",
        "reference": "step-marquise-lab-grown-diamond-ring-1-64-ct-white-gold",
        "price": 165680,
        "finishedHandle": "step-marquise-lab-grown-diamond-ring-1-64-ct-white-gold"
      },
      {
        "title": "Step Marquise Solitaire",
        "style": "solitaire",
        "video": "https://cdn.shopify.com/videos/c/vp/580bdce81a124dc0b85fb83943c09015/580bdce81a124dc0b85fb83943c09015.SD-480p-1.5Mbps-96457872.mp4",
        "shape": "Step Marquise",
        "center": 2.51,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8992_20_1.png?v=1791209147",
        "reference": "step-marquise-lab-grown-diamond-ring-2-51-ct-white-gold",
        "price": 169760,
        "finishedHandle": "step-marquise-lab-grown-diamond-ring-2-51-ct-white-gold"
      },
      {
        "title": "Step Marquise Solitaire",
        "style": "solitaire",
        "video": "https://cdn.shopify.com/videos/c/vp/b11dfccd1c884ca085439e630a33bcf3/b11dfccd1c884ca085439e630a33bcf3.SD-480p-1.5Mbps-96457798.mp4",
        "shape": "Step Marquise",
        "center": 2.16,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8935_20_1.png?v=1791209159",
        "reference": "step-marquise-lab-grown-diamond-ring-2-16-ct-white-gold",
        "price": 184192,
        "finishedHandle": "step-marquise-lab-grown-diamond-ring-2-16-ct-white-gold"
      },
      {
        "title": "Step Marquise Solitaire",
        "style": "solitaire",
        "video": "https://cdn.shopify.com/videos/c/vp/ba76439e199d4a3b91990e5130d46c66/ba76439e199d4a3b91990e5130d46c66.SD-480p-1.5Mbps-96458410.mp4",
        "shape": "Step Marquise",
        "center": 3.58,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8997_20_1.png?v=1791209726",
        "reference": "step-marquise-lab-grown-diamond-ring-3-58-ct-white-gold",
        "price": 223816,
        "finishedHandle": "step-marquise-lab-grown-diamond-ring-3-58-ct-white-gold"
      },
      {
        "title": "Round Hidden Halo",
        "reference": "design-rg8453",
        "style": "hidden-halo",
        "shape": "Round",
        "center": 1.73,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8453_20_1.png?v=1795803941",
        "video": "https://im.lgdus.co/Jwl/RG8453/RG8453.mp4",
        "price": 166040,
        "finishedHandle": "round-lab-grown-diamond-hidden-halo-ring-1-73-ct-14k-white-gold-rg8453"
      },
      {
        "title": "Radiant Hidden Halo",
        "reference": "design-rg1522",
        "style": "hidden-halo",
        "shape": "Radiant",
        "center": 1.01,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG1522_20_1.png?v=1795803998",
        "video": "https://lgdus.co/RG1522/RG1522.mp4",
        "price": 180284,
        "finishedHandle": "radiant-lab-grown-diamond-hidden-halo-ring-1-01-ct-14k-white-gold-rg1522"
      },
      {
        "title": "Emerald Hidden Halo",
        "reference": "design-rg1657",
        "style": "hidden-halo",
        "shape": "Emerald",
        "center": 1.64,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGWEMSS_20_1_b0a8438b-88e5-4ced-9ade-c683446e1886.png?v=1795804000",
        "video": "https://im.lgdus.co/Jwl/RGWEMSS/RGWEMSS.mp4",
        "price": 211470,
        "finishedHandle": "emerald-lab-grown-diamond-hidden-halo-ring-1-64-ct-14k-white-gold-rg1657"
      },
      {
        "title": "Emerald Split Shank",
        "reference": "design-rg1556",
        "style": "split-shank",
        "shape": "Emerald",
        "center": 1,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGWSSEM_20_1.jpg?v=1795803983",
        "video": "https://lgdus.co/RGWSSEM/RGWSSEM.mp4",
        "price": 191354,
        "finishedHandle": "emerald-lab-grown-diamond-split-shank-ring-1-ct-14k-white-gold-rg1556"
      },
      {
        "title": "Emerald Hidden Halo",
        "reference": "design-rg8435",
        "style": "hidden-halo",
        "shape": "Emerald",
        "center": 4.09,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8435_20_1.png?v=1795803999",
        "video": "https://im.lgdus.co/Jwl/RG8435/RG8435.mp4",
        "price": 257480,
        "finishedHandle": "emerald-lab-grown-diamond-hidden-halo-ring-4-09-ct-14k-white-gold-rg8435"
      },
      {
        "title": "Round Three-Stone",
        "reference": "design-rg1387",
        "style": "three-stone",
        "shape": "Round",
        "center": 1.55,
        "metal": "Platinum",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGBRPLTHM_20_1.png?v=1795803943",
        "video": "https://im.lgdus.co/Jwl/RGBRPLTHM/RGBRPLTHM.mp4",
        "price": 249400,
        "finishedHandle": "round-lab-grown-diamond-three-stone-ring-1-55-ct-platinum-rg1387"
      },
      {
        "title": "Marquise Split Shank",
        "reference": "design-rg1243",
        "style": "split-shank",
        "shape": "Marquise",
        "center": 3.15,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGYSSMQ_1.jpg?v=1795804000",
        "video": "https://lgdus.co/RGYSSMQ/RGYSSMQ.mp4",
        "price": 580020,
        "finishedHandle": "marquise-lab-grown-diamond-split-shank-ring-3-15-ct-14k-yellow-gold-rg1243"
      },
      {
        "title": "Emerald Split Shank",
        "reference": "design-rg874",
        "style": "split-shank",
        "shape": "Emerald",
        "center": 1.51,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGWSSEM_20_1_3f3522fd-0a25-4621-bbfe-f8c315dd2516.jpg?v=1795804001",
        "video": "https://lgdus.co/RGWSSEM/RGWSSEM.mp4",
        "price": 235272,
        "finishedHandle": "emerald-lab-grown-diamond-split-shank-ring-1-51-ct-14k-white-gold-rg874"
      },
      {
        "title": "Emerald Hidden Halo",
        "reference": "design-rg3405",
        "style": "hidden-halo",
        "shape": "Emerald",
        "center": 2.11,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG3405_20_1.png?v=1795804003",
        "video": "https://im.lgdus.co/Jwl/RG3405/RG3405.mp4",
        "price": 258700,
        "finishedHandle": "emerald-lab-grown-diamond-hidden-halo-ring-2-11-ct-14k-white-gold-rg3405"
      },
      {
        "title": "Oval Three-Stone",
        "reference": "design-rg986",
        "style": "three-stone",
        "shape": "Oval",
        "center": 1.56,
        "metal": "Platinum",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGW3OVHM_20_1_1c5481aa-e783-4387-8fe2-ac34004a656b.png?v=1795804004",
        "video": "https://lgdus.co/RGW3OVHM/RGW3OVHM%20(1).mp4",
        "price": 261184,
        "finishedHandle": "oval-lab-grown-diamond-three-stone-ring-1-56-ct-platinum-rg986"
      },
      {
        "title": "Radiant Split Shank",
        "reference": "design-rg1496",
        "style": "split-shank",
        "shape": "Radiant",
        "center": 1.67,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGWSSRAD_20_1.png?v=1795804004",
        "video": "https://lgdus.co/RGWSSRAD/RGWSSRAD.mp4",
        "price": 257960,
        "finishedHandle": "radiant-lab-grown-diamond-split-shank-ring-1-67-ct-14k-white-gold-rg1496"
      },
      {
        "title": "Oval Three-Stone",
        "reference": "design-rg928",
        "style": "three-stone",
        "shape": "Oval",
        "center": 2.03,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGW3OVHM_20_1_136801ba-38c3-4bd4-a855-49ee790be7aa.png?v=1795804005",
        "video": "https://lgdus.co/RGW3OVHM/RGW3OVHM%20(1).mp4",
        "price": 304656,
        "finishedHandle": "oval-lab-grown-diamond-three-stone-ring-2-03-ct-14k-white-gold-rg928"
      },
      {
        "title": "Radiant Split Shank",
        "reference": "design-rg2352",
        "style": "split-shank",
        "shape": "Radiant",
        "center": 3.28,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG2352_20_1.png?v=1795804006",
        "video": "https://im.lgdus.co/Jwl/RG2352/RG2352.mp4",
        "price": 261680,
        "finishedHandle": "radiant-lab-grown-diamond-split-shank-ring-3-28-ct-14k-white-gold-rg2352"
      },
      {
        "title": "Oval Three-Stone",
        "reference": "design-rg2096",
        "style": "three-stone",
        "shape": "Oval",
        "center": 2.08,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/NLR_200407_20_1.png?v=1795804006",
        "video": "https://im.lgdus.co/Jwl/NLR%200407/NLR%200407.mp4",
        "price": 288154,
        "finishedHandle": "oval-lab-grown-diamond-three-stone-ring-2-08-ct-14k-white-gold-rg2096"
      },
      {
        "title": "Emerald Three-Stone",
        "reference": "design-rg2118",
        "style": "three-stone",
        "shape": "Emerald",
        "center": 2.06,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG2118_20_1.png?v=1795804007",
        "video": "https://im.lgdus.co/Jwl/RG2118/RG2118.mp4",
        "price": 230194,
        "finishedHandle": "emerald-lab-grown-diamond-three-stone-ring-2-06-ct-14k-white-gold-rg2118"
      },
      {
        "title": "Emerald Three-Stone",
        "reference": "design-rg1696",
        "style": "three-stone",
        "shape": "Emerald",
        "center": 1.01,
        "metal": "Platinum",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGW3EMTRA_20_2.png?v=1795804009",
        "video": "https://lgdus.co/RGW3EMTRA/RGW3EMTRA%20(1).mp4",
        "price": 247928,
        "finishedHandle": "emerald-lab-grown-diamond-three-stone-ring-1-01-ct-platinum-rg1696"
      },
      {
        "title": "Emerald Three-Stone",
        "reference": "design-rg1692",
        "style": "three-stone",
        "shape": "Emerald",
        "center": 1.14,
        "metal": "Platinum",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGW3EMTRA_20_2_ccdeb6d7-1d01-4c9d-897d-0955cfac8369.png?v=1795804023",
        "video": "https://lgdus.co/RGW3EMTRA/RGW3EMTRA%20(1).mp4",
        "price": 240344,
        "finishedHandle": "emerald-lab-grown-diamond-three-stone-ring-1-14-ct-platinum-rg1692"
      },
      {
        "title": "Oval Three-Stone",
        "reference": "design-rg1674",
        "style": "three-stone",
        "shape": "Oval",
        "center": 1.04,
        "metal": "Platinum",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGW3OVHM_20_1_402a078f-e10a-4afe-9ae1-7ba6920ba8b8.png?v=1795804023",
        "video": "https://lgdus.co/RGW3OVHM/RGW3OVHM%20(1).mp4",
        "price": 245898,
        "finishedHandle": "oval-lab-grown-diamond-three-stone-ring-1-04-ct-platinum-rg1674"
      },
      {
        "title": "Emerald Split Shank",
        "reference": "design-rg1478",
        "style": "split-shank",
        "shape": "Emerald",
        "center": 1.65,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGWSSEM_20_1_6e420430-51a5-4fa5-a145-02dd1852a9cd.jpg?v=1795804023",
        "video": "https://lgdus.co/RGWSSEM/RGWSSEM.mp4",
        "price": 242016,
        "finishedHandle": "emerald-lab-grown-diamond-split-shank-ring-1-65-ct-14k-white-gold-rg1478"
      },
      {
        "title": "Emerald Split Shank",
        "reference": "design-rg1453",
        "style": "split-shank",
        "shape": "Emerald",
        "center": 2.02,
        "metal": "Platinum",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGWSSEM_20_1_c557fef9-8288-49a3-a814-b815d52c4c45.jpg?v=1795804024",
        "video": "https://lgdus.co/RGWSSEM/RGWSSEM.mp4",
        "price": 348248,
        "finishedHandle": "emerald-lab-grown-diamond-split-shank-ring-2-02-ct-platinum-rg1453"
      },
      {
        "title": "Round Three-Stone",
        "reference": "design-rg1388",
        "style": "three-stone",
        "shape": "Round",
        "center": 2.02,
        "metal": "Platinum",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGWGBRHM_20_1_7556bcf5-d488-4bfc-a2cd-3a131258ac02.png?v=1795804025",
        "video": "https://im.lgdus.co/Jwl/RGWGBRHM/RGWGBRHM.mp4",
        "price": 238036,
        "finishedHandle": "round-lab-grown-diamond-three-stone-ring-2-02-ct-platinum-rg1388"
      },
      {
        "title": "Round Three-Stone",
        "reference": "design-rg1378",
        "style": "three-stone",
        "shape": "Round",
        "center": 1.14,
        "metal": "Platinum",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGBRPLTHM_20_2_19c2dc6d-a5f3-4ea1-a544-ce992a9fccaa.png?v=1795804025",
        "video": "https://im.lgdus.co/Jwl/RGBRPLTHM/RGBRPLTHM.mp4",
        "price": 206302,
        "finishedHandle": "round-lab-grown-diamond-three-stone-ring-1-14-ct-platinum-rg1378"
      },
      {
        "title": "Round Three-Stone",
        "reference": "design-rg1330",
        "style": "three-stone",
        "shape": "Round",
        "center": 0.72,
        "metal": "Platinum",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGBRPLTBR_20_1.png?v=1795804026",
        "video": "https://im.lgdus.co/Jwl/RGBRPLTBR/RGBRPLTBR.mp4",
        "price": 216752,
        "finishedHandle": "round-lab-grown-diamond-three-stone-ring-0-72-ct-platinum-rg1330"
      },
      {
        "title": "Round Three-Stone",
        "reference": "design-rg1339",
        "style": "three-stone",
        "shape": "Round",
        "center": 2.11,
        "metal": "Platinum",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGWGBRHM_20_1_1a0e86cd-5c99-43df-be0d-2b1a806c1ca0.png?v=1795804027",
        "video": "https://im.lgdus.co/Jwl/RGWGBRHM/RGWGBRHM.mp4",
        "price": 268994,
        "finishedHandle": "round-lab-grown-diamond-three-stone-ring-2-11-ct-platinum-rg1339"
      },
      {
        "title": "Emerald Hidden Halo",
        "reference": "design-rg1219",
        "style": "hidden-halo",
        "shape": "Emerald",
        "center": 1.01,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGWEMSS_20_1_ab85eb21-afdb-49fb-8865-aaf34015df18.png?v=1795804029",
        "video": "https://im.lgdus.co/Jwl/RGWEMSS/RGWEMSS.mp4",
        "price": 131354,
        "finishedHandle": "emerald-lab-grown-diamond-hidden-halo-ring-1-01-ct-14k-white-gold-rg1219"
      },
      {
        "title": "Round Three-Stone",
        "reference": "design-rg1115",
        "style": "three-stone",
        "shape": "Round",
        "center": 1.51,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGWGBRHM_20_1_673f401a-ca28-4745-ac6d-8cc84a5b0dfe.png?v=1795804028",
        "video": "https://im.lgdus.co/Jwl/RGWGBRHM/RGWGBRHM.mp4",
        "price": 154134,
        "finishedHandle": "round-lab-grown-diamond-three-stone-ring-1-51-ct-14k-white-gold-rg1115"
      },
      {
        "title": "Round Split Shank",
        "reference": "design-rg1041",
        "style": "split-shank",
        "shape": "Round",
        "center": 4.2,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG1877_20_1.png?v=1795804029",
        "video": "https://im.lgdus.co/Jwl/RG1877/RG1877.mp4",
        "price": 1064246,
        "finishedHandle": "round-lab-grown-diamond-split-shank-ring-4-2-ct-14k-white-gold-rg1041"
      },
      {
        "title": "Round Split Shank",
        "reference": "design-rg964",
        "style": "split-shank",
        "shape": "Round",
        "center": 2.07,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG1874_20_1.png?v=1795804029",
        "video": "https://im.lgdus.co/Jwl/RG1874/RG1874.mp4",
        "price": 287580,
        "finishedHandle": "round-lab-grown-diamond-split-shank-ring-2-07-ct-14k-white-gold-rg964"
      },
      {
        "title": "Oval Three-Stone",
        "reference": "design-rg909",
        "style": "three-stone",
        "shape": "Oval",
        "center": 1,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGW3OVHM_20_1_7af0f7f8-c615-4955-8421-4db36dd16d4e.png?v=1795804031",
        "video": "https://lgdus.co/RGW3OVHM/RGW3OVHM%20(1).mp4",
        "price": 159414,
        "finishedHandle": "oval-lab-grown-diamond-three-stone-ring-1-ct-14k-white-gold-rg909"
      },
      {
        "title": "Emerald Three-Stone",
        "reference": "design-rg1635",
        "style": "three-stone",
        "shape": "Emerald",
        "center": 1.62,
        "metal": "Platinum",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RGW3EMTRA_20_2_7726f7b0-bbdc-4659-bb38-5e508426e579.png?v=1795804031",
        "video": "https://lgdus.co/RGW3EMTRA/RGW3EMTRA%20(1).mp4",
        "price": 312016,
        "finishedHandle": "emerald-lab-grown-diamond-three-stone-ring-1-62-ct-platinum-rg1635"
      },
      {
        "title": "Round Hidden Halo",
        "reference": "design-rg3929",
        "style": "hidden-halo",
        "shape": "Round",
        "center": 2,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG3929_20_1.png?v=1795804032",
        "video": "https://im.lgdus.co/Jwl/RG3929/RG3929.mp4",
        "price": 188036,
        "finishedHandle": "round-lab-grown-diamond-hidden-halo-ring-2-ct-14k-yellow-gold-rg3929"
      },
      {
        "title": "Round Hidden Halo",
        "reference": "design-rg3931",
        "style": "hidden-halo",
        "shape": "Round",
        "center": 2.54,
        "metal": "18K Yellow Gold - Platinum",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG3931_20_1.png?v=1795804037",
        "video": "https://im.lgdus.co/Jwl/RG3931/RG3931.mp4",
        "price": 218376,
        "finishedHandle": "round-lab-grown-diamond-ring-2-54-ct-18k-yellow-gold-platinum-rg3931"
      },
      {
        "title": "Round Hidden Halo",
        "reference": "design-rg3927",
        "style": "hidden-halo",
        "shape": "Round",
        "center": 2,
        "metal": "18K Yellow Gold - Platinum",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG3927_20_1.png?v=1795804038",
        "video": "https://im.lgdus.co/Jwl/RG3927/RG3927.mp4",
        "price": 218036,
        "finishedHandle": "round-lab-grown-diamond-ring-2-ct-18k-yellow-gold-platinum-rg3927"
      },
      {
        "title": "Round Hidden Halo",
        "reference": "design-rg3955",
        "style": "hidden-halo",
        "shape": "Round",
        "center": 3.36,
        "metal": "18K Yellow Gold - Platinum",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG3955_20_1.png?v=1795804039",
        "video": "https://im.lgdus.co/Jwl/RG3955/RG3955.mp4",
        "price": 297324,
        "finishedHandle": "round-lab-grown-diamond-ring-3-36-ct-18k-yellow-gold-platinum-rg3955"
      },
      {
        "title": "Emerald Solitaire",
        "reference": "design-rg8884",
        "style": "solitaire",
        "shape": "Emerald",
        "center": 2.21,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8884_20_1.png?v=1795804039",
        "video": "https://im.lgdus.co/Jwl/RG8884/RG8884.mp4",
        "price": 189734,
        "finishedHandle": "emerald-lab-grown-diamond-solitaire-ring-2-21-ct-14k-white-gold-rg8884"
      },
      {
        "title": "Round Solitaire",
        "reference": "design-rg8913",
        "style": "solitaire",
        "shape": "Round",
        "center": 2.6,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8913_20_1.png?v=1795804039",
        "video": "https://im.lgdus.co/Jwl/RG8913/RG8913.mp4",
        "price": 168376,
        "finishedHandle": "round-lab-grown-diamond-solitaire-ring-2-6-ct-14k-white-gold-rg8913"
      },
      {
        "title": "Radiant Hidden Halo",
        "reference": "design-rg8545",
        "style": "hidden-halo",
        "shape": "Radiant",
        "center": 3.22,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8545_20_1.png?v=1795804040",
        "video": "https://im.lgdus.co/Jwl/RG8545/RG8545.mp4",
        "price": 236224,
        "finishedHandle": "radiant-lab-grown-diamond-hidden-halo-ring-3-22-ct-14k-white-gold-rg8545"
      },
      {
        "title": "Princess Solitaire",
        "reference": "design-rg5360",
        "style": "solitaire",
        "shape": "Princess",
        "center": 2.5,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG5360_20_1.png?v=1795804040",
        "video": "https://im.lgdus.co/Jwl/RG5360/RG5360.mp4",
        "price": 196668,
        "finishedHandle": "princess-lab-grown-diamond-solitaire-ring-2-5-ct-14k-white-gold-rg5360"
      },
      {
        "title": "Round Solitaire",
        "reference": "design-rg5663",
        "style": "solitaire",
        "shape": "Round",
        "center": 2.04,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG5663_20_1.png?v=1795804041",
        "video": "https://im.lgdus.co/Jwl/RG5663/RG5663.mp4",
        "price": 210860,
        "finishedHandle": "round-lab-grown-diamond-solitaire-ring-2-04-ct-14k-white-gold-rg5663"
      },
      {
        "title": "Radiant Diamond-Shank Solitaire",
        "reference": "design-rg6645",
        "style": "diamond-shank",
        "shape": "Radiant",
        "center": 5.18,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG6645_20_1.png?v=1795803942",
        "video": "https://im.lgdus.co/Jwl/RG6645/RG6645.mp4",
        "price": 306680,
        "finishedHandle": "radiant-lab-grown-diamond-ring-5-18-ct-14k-white-gold-rg6645"
      },
      {
        "title": "Oval Hidden Halo",
        "reference": "design-rg6587",
        "style": "hidden-halo",
        "shape": "Oval",
        "center": 5.11,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG6587_20_1.png?v=1795804043",
        "video": "https://im.lgdus.co/Jwl/RG6587/RG6587.mp4",
        "price": 410228,
        "finishedHandle": "oval-lab-grown-diamond-hidden-halo-ring-5-11-ct-14k-yellow-gold-rg6587"
      },
      {
        "title": "Emerald Halo",
        "reference": "design-rg6836",
        "style": "halo",
        "shape": "Emerald",
        "center": 2.05,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG6836_20_1.png?v=1795804043",
        "video": "https://im.lgdus.co/Jwl/RG6836/RG6836.mp4",
        "price": 283526,
        "finishedHandle": "emerald-lab-grown-diamond-halo-ring-2-05-ct-14k-white-gold-rg6836"
      },
      {
        "title": "Pear Solitaire",
        "reference": "design-rg6913",
        "style": "solitaire",
        "shape": "Pear",
        "center": 2.02,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG6913_20_1.png?v=1795804043",
        "video": "https://im.lgdus.co/Jwl/RG6913/RG6913.mp4",
        "price": 224954,
        "finishedHandle": "pear-lab-grown-diamond-solitaire-ring-2-02-ct-14k-white-gold-rg6913"
      },
      {
        "title": "Princess Solitaire",
        "reference": "design-rg7720",
        "style": "solitaire",
        "shape": "Princess",
        "center": 3.11,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7720_20_1.png?v=1795804044",
        "video": "https://im.lgdus.co/Jwl/RG7720/RG7720.mp4",
        "price": 267828,
        "finishedHandle": "princess-lab-grown-diamond-solitaire-ring-3-11-ct-14k-white-gold-rg7720"
      },
      {
        "title": "Princess Solitaire",
        "reference": "design-rg6986",
        "style": "solitaire",
        "shape": "Princess",
        "center": 2.04,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG6986_20_1.png?v=1795804045",
        "video": "https://im.lgdus.co/Jwl/RG6986/RG6986.mp4",
        "price": 197378,
        "finishedHandle": "princess-lab-grown-diamond-solitaire-ring-2-04-ct-14k-white-gold-rg6986"
      },
      {
        "title": "Princess Solitaire",
        "reference": "design-rg6548",
        "style": "solitaire",
        "shape": "Princess",
        "center": 2.54,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG6548_20_1.png?v=1795804052",
        "video": "https://im.lgdus.co/Jwl/RG6548/RG6548.mp4",
        "price": 216668,
        "finishedHandle": "princess-lab-grown-diamond-solitaire-ring-2-54-ct-14k-white-gold-rg6548"
      },
      {
        "title": "Marquise Modified Split Shank",
        "reference": "design-rg6722",
        "style": "split-shank",
        "shape": "Marquise Modified",
        "center": 4.56,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG6722_20_1.png?v=1795804052",
        "video": "https://im.lgdus.co/Jwl/RG6722/RG6722.mp4",
        "price": 365774,
        "finishedHandle": "marquise-modified-lab-grown-diamond-ring-4-56-ct-14k-yellow-gold-rg6722"
      },
      {
        "title": "Oval Hidden Halo",
        "reference": "design-rg6715",
        "style": "hidden-halo",
        "shape": "Oval",
        "center": 3.04,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG6715_20_1.png?v=1795804053",
        "video": "https://im.lgdus.co/Jwl/RG6715/RG6715.mp4",
        "price": 245304,
        "finishedHandle": "oval-lab-grown-diamond-hidden-halo-ring-3-04-ct-14k-white-gold-rg6715"
      },
      {
        "title": "Round Three-Stone",
        "reference": "design-rg7819",
        "style": "three-stone",
        "shape": "Round",
        "center": 2.1,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7819_20_1.png?v=1795804054",
        "video": "https://im.lgdus.co/Jwl/RG7819/RG7819.mp4",
        "price": 459178,
        "finishedHandle": "round-lab-grown-diamond-three-stone-ring-2-1-ct-14k-yellow-gold-rg7819"
      },
      {
        "title": "Oval Solitaire",
        "reference": "design-rg7190",
        "style": "solitaire",
        "shape": "Oval",
        "center": 4.21,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7190_20_1.png?v=1795804055",
        "video": "https://im.lgdus.co/Jwl/RG7190/RG7190.mp4",
        "price": 294752,
        "finishedHandle": "oval-lab-grown-diamond-solitaire-ring-4-21-ct-14k-white-gold-rg7190"
      },
      {
        "title": "Round Diamond-Shank Solitaire",
        "reference": "design-rg7550",
        "style": "diamond-shank",
        "shape": "Round",
        "center": 3.75,
        "metal": "14K Rose Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7550_20_1.png?v=1795804055",
        "video": "https://im.lgdus.co/Jwl/RG7550/RG7550.mp4",
        "price": 248382,
        "finishedHandle": "round-lab-grown-diamond-ring-3-75-ct-14k-rose-gold-rg7550"
      },
      {
        "title": "Round Solitaire",
        "reference": "design-rg7551",
        "style": "solitaire",
        "shape": "Round",
        "center": 1.53,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7551_20_1.png?v=1795804056",
        "video": "https://im.lgdus.co/Jwl/RG7551/RG7551.mp4",
        "price": 131232,
        "finishedHandle": "round-lab-grown-diamond-solitaire-ring-1-53-ct-14k-yellow-gold-rg7551"
      },
      {
        "title": "Radiant Solitaire",
        "reference": "design-rg8524",
        "style": "solitaire",
        "shape": "Radiant",
        "center": 2.08,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8524_20_1.png?v=1795804057",
        "video": "https://im.lgdus.co/Jwl/RG8524/RG8524.mp4",
        "price": 183150,
        "finishedHandle": "radiant-lab-grown-diamond-solitaire-ring-2-08-ct-14k-white-gold-rg8524"
      },
      {
        "title": "Radiant Solitaire",
        "reference": "design-rg7652",
        "style": "solitaire",
        "shape": "Radiant",
        "center": 2.05,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7652_20_1.png?v=1795804058",
        "video": "https://im.lgdus.co/Jwl/RG7652/RG7652.mp4",
        "price": 221000,
        "finishedHandle": "radiant-lab-grown-diamond-solitaire-ring-2-05-ct-14k-yellow-gold-rg7652"
      },
      {
        "title": "Princess Solitaire",
        "reference": "design-rg7715",
        "style": "solitaire",
        "shape": "Princess",
        "center": 2.04,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7715_20_1.png?v=1795804059",
        "video": "https://im.lgdus.co/Jwl/RG7715/RG7715.mp4",
        "price": 213668,
        "finishedHandle": "princess-lab-grown-diamond-solitaire-ring-2-04-ct-14k-white-gold-rg7715"
      },
      {
        "title": "Oval Solitaire",
        "reference": "design-rg7665",
        "style": "solitaire",
        "shape": "Oval",
        "center": 1.53,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7665_20_1_de9b80a5-b343-4202-aaa9-a408a4467631.png?v=1795804060",
        "video": "https://im.lgdus.co/Jwl/RG7665/RG7665.mp4",
        "price": 205800,
        "finishedHandle": "oval-lab-grown-diamond-solitaire-ring-1-53-ct-14k-white-gold-rg7665"
      },
      {
        "title": "Cushion Brilliant Solitaire",
        "reference": "design-rg7681",
        "style": "solitaire",
        "shape": "Cushion Brilliant",
        "center": 1.52,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7681_20_1.png?v=1795804060",
        "video": "https://im.lgdus.co/Jwl/RG7681/RG7681.mp4",
        "price": 200518,
        "finishedHandle": "cushion-brilliant-lab-grown-diamond-ring-1-52-ct-14k-yellow-gold-rg7681"
      },
      {
        "title": "Radiant Solitaire",
        "reference": "design-rg7643",
        "style": "solitaire",
        "shape": "Radiant",
        "center": 1.55,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7643_20_1_bb67f4d8-a169-4e58-aa6e-681ab85b211a.png?v=1795804061",
        "video": "https://im.lgdus.co/Jwl/RG7643/RG7643.mp4",
        "price": 198276,
        "finishedHandle": "radiant-lab-grown-diamond-solitaire-ring-1-55-ct-14k-white-gold-rg7643"
      },
      {
        "title": "Radiant Solitaire",
        "reference": "design-rg7646",
        "style": "solitaire",
        "shape": "Radiant",
        "center": 1.56,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7646_20_1_436889b0-3bd8-4547-a551-3ce110a107f6.png?v=1795804062",
        "video": "https://im.lgdus.co/Jwl/RG7646/RG7646.mp4",
        "price": 203792,
        "finishedHandle": "radiant-lab-grown-diamond-solitaire-ring-1-56-ct-14k-yellow-gold-rg7646"
      },
      {
        "title": "Emerald Solitaire",
        "reference": "design-rg7630",
        "style": "solitaire",
        "shape": "Emerald",
        "center": 1.5,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7630_20_1_dea5c4e1-1727-4597-b47c-5006622ee3ee.png?v=1795804070",
        "video": "https://im.lgdus.co/Jwl/RG7630/RG7630.mp4",
        "price": 201728,
        "finishedHandle": "emerald-lab-grown-diamond-solitaire-ring-1-5-ct-14k-white-gold-rg7630"
      },
      {
        "title": "Round Solitaire",
        "reference": "design-rg8910",
        "style": "solitaire",
        "shape": "Round",
        "center": 1.71,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8910_20_1.png?v=1795804072",
        "video": "https://im.lgdus.co/Jwl/RG8910/RG8910.mp4",
        "price": 155214,
        "finishedHandle": "round-lab-grown-diamond-solitaire-ring-1-71-ct-14k-white-gold-rg8910"
      },
      {
        "title": "Oval Solitaire",
        "reference": "design-rg7672",
        "style": "solitaire",
        "shape": "Oval",
        "center": 2.12,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7672_20_1.png?v=1795804073",
        "video": "https://im.lgdus.co/Jwl/RG7672/RG7672.mp4",
        "price": 246322,
        "finishedHandle": "oval-lab-grown-diamond-solitaire-ring-2-12-ct-14k-yellow-gold-rg7672"
      },
      {
        "title": "Marquise Solitaire",
        "reference": "design-rg7689",
        "style": "solitaire",
        "shape": "Marquise",
        "center": 1.56,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7689_20_1.png?v=1795804074",
        "video": "https://im.lgdus.co/Jwl/RG7689/RG7689.mp4",
        "price": 204066,
        "finishedHandle": "marquise-lab-grown-diamond-solitaire-ring-1-56-ct-14k-white-gold-rg7689"
      },
      {
        "title": "Oval Solitaire",
        "reference": "design-rg7837",
        "style": "solitaire",
        "shape": "Oval",
        "center": 3.52,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7837_20_1_4f0e7521-671b-48e9-a07f-2bae3c27319b.png?v=1795804074",
        "video": "https://im.lgdus.co/Jwl/RG7837/RG7837.mp4",
        "price": 280176,
        "finishedHandle": "oval-lab-grown-diamond-solitaire-ring-3-52-ct-14k-white-gold-rg7837"
      },
      {
        "title": "Emerald Solitaire",
        "reference": "design-rg7632",
        "style": "solitaire",
        "shape": "Emerald",
        "center": 1.53,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7632_20_1_af6b7c40-75c3-4be5-87f9-59a8a9643edb.png?v=1795804075",
        "video": "https://im.lgdus.co/Jwl/RG7632/RG7632.mp4",
        "price": 201728,
        "finishedHandle": "emerald-lab-grown-diamond-solitaire-ring-1-53-ct-14k-yellow-gold-rg7632"
      },
      {
        "title": "Round Diamond-Shank Solitaire",
        "reference": "design-rg7844",
        "style": "diamond-shank",
        "shape": "Round",
        "center": 2.5,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7844_20_1.png?v=1795804076",
        "video": "https://im.lgdus.co/Jwl/RG7844/RG7844.mp4",
        "price": 242518,
        "finishedHandle": "round-lab-grown-diamond-ring-2-5-ct-14k-white-gold-rg7844"
      },
      {
        "title": "Round Diamond-Shank Solitaire",
        "reference": "design-rg7842",
        "style": "diamond-shank",
        "shape": "Round",
        "center": 1.51,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG7842_20_1.png?v=1795804077",
        "video": "https://im.lgdus.co/Jwl/RG7842/RG7842.mp4",
        "price": 190026,
        "finishedHandle": "round-lab-grown-diamond-ring-1-51-ct-14k-yellow-gold-rg7842"
      },
      {
        "title": "Round Solitaire",
        "reference": "design-rg8365",
        "style": "solitaire",
        "shape": "Round",
        "center": 1.53,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8365_20_1_26c8accb-f194-42ca-86a1-d91739ca9a63.png?v=1795804078",
        "video": "https://im.lgdus.co/Jwl/RG8365/RG8365.mp4",
        "price": 171232,
        "finishedHandle": "round-lab-grown-diamond-solitaire-ring-1-53-ct-14k-yellow-gold-rg8365"
      },
      {
        "title": "Radiant Solitaire",
        "reference": "design-rg8412",
        "style": "solitaire",
        "shape": "Radiant",
        "center": 4.2,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8412_20_1.png?v=1795804079",
        "video": "https://im.lgdus.co/Jwl/RG8412/RG8412.mp4",
        "price": 256256,
        "finishedHandle": "radiant-lab-grown-diamond-solitaire-ring-4-2-ct-14k-white-gold-rg8412"
      },
      {
        "title": "Radiant Solitaire",
        "reference": "design-rg8501",
        "style": "solitaire",
        "shape": "Radiant",
        "center": 4.87,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8501_20_1.png?v=1795804080",
        "video": "https://im.lgdus.co/Jwl/RG8501/RG8501.mp4",
        "price": 298570,
        "finishedHandle": "radiant-lab-grown-diamond-solitaire-ring-4-87-ct-14k-white-gold-rg8501"
      },
      {
        "title": "Emerald Solitaire",
        "reference": "design-rg8885",
        "style": "solitaire",
        "shape": "Emerald",
        "center": 2.57,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8885_20_1.png?v=1795804080",
        "video": "https://im.lgdus.co/Jwl/RG8885/RG8885.mp4",
        "price": 194334,
        "finishedHandle": "emerald-lab-grown-diamond-solitaire-ring-2-57-ct-14k-white-gold-rg8885"
      },
      {
        "title": "Radiant Solitaire",
        "reference": "design-rg8530",
        "style": "solitaire",
        "shape": "Radiant",
        "center": 3.53,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8530_20_1.png?v=1795804086",
        "video": "https://im.lgdus.co/Jwl/RG8530/RG8530.mp4",
        "price": 234386,
        "finishedHandle": "radiant-lab-grown-diamond-solitaire-ring-3-53-ct-14k-white-gold-rg8530"
      },
      {
        "title": "Emerald Solitaire",
        "reference": "design-rg8889",
        "style": "solitaire",
        "shape": "Emerald",
        "center": 3.51,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8889_20_1_c4683966-b354-4705-b67f-c22f0d75d836.png?v=1795804087",
        "video": "https://im.lgdus.co/Jwl/RG8889/RG8889.mp4",
        "price": 259106,
        "finishedHandle": "emerald-lab-grown-diamond-solitaire-ring-3-51-ct-14k-white-gold-rg8889"
      },
      {
        "title": "Radiant Hidden Halo",
        "reference": "design-rg8447",
        "style": "hidden-halo",
        "shape": "Radiant",
        "center": 4.05,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8447_20_1.png?v=1795804088",
        "video": "https://im.lgdus.co/Jwl/RG8447/RG8447.mp4",
        "price": 258622,
        "finishedHandle": "radiant-lab-grown-diamond-hidden-halo-ring-4-05-ct-14k-white-gold-rg8447"
      },
      {
        "title": "Round Hidden Halo",
        "reference": "design-rg8450",
        "style": "hidden-halo",
        "shape": "Round",
        "center": 1.13,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8450_20_1.png?v=1795804089",
        "video": "https://im.lgdus.co/Jwl/RG8450/RG8450.mp4",
        "price": 141784,
        "finishedHandle": "round-lab-grown-diamond-hidden-halo-ring-1-13-ct-14k-white-gold-rg8450"
      },
      {
        "title": "Round Hidden Halo",
        "reference": "design-rg8455",
        "style": "hidden-halo",
        "shape": "Round",
        "center": 2.28,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8455_20_1.png?v=1795804089",
        "video": "https://im.lgdus.co/Jwl/RG8455/RG8455.mp4",
        "price": 213056,
        "finishedHandle": "round-lab-grown-diamond-hidden-halo-ring-2-28-ct-14k-white-gold-rg8455"
      },
      {
        "title": "Oval Hidden Halo",
        "reference": "design-rg9067",
        "style": "hidden-halo",
        "shape": "Oval",
        "center": 2.12,
        "metal": "14K Yellow Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG9067_20_1.png?v=1795804090",
        "video": "https://im.lgdus.co/Jwl/RG9067/RG9067.mp4",
        "price": 218300,
        "finishedHandle": "oval-lab-grown-diamond-hidden-halo-ring-2-12-ct-14k-yellow-gold-rg9067"
      },
      {
        "title": "Emerald Hidden Halo",
        "reference": "design-rg8437",
        "style": "hidden-halo",
        "shape": "Emerald",
        "center": 4.55,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8437_20_1.png?v=1795804090",
        "video": "https://im.lgdus.co/Jwl/RG8437/RG8437.mp4",
        "price": 298558,
        "finishedHandle": "emerald-lab-grown-diamond-hidden-halo-ring-4-55-ct-14k-white-gold-rg8437"
      },
      {
        "title": "Emerald Hidden Halo",
        "reference": "design-rg8431",
        "style": "hidden-halo",
        "shape": "Emerald",
        "center": 3.18,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8431_20_1.png?v=1795804091",
        "video": "https://im.lgdus.co/Jwl/RG8431/RG8431.mp4",
        "price": 253580,
        "finishedHandle": "emerald-lab-grown-diamond-hidden-halo-ring-3-18-ct-14k-white-gold-rg8431"
      },
      {
        "title": "Marquise Diamond-Shank Solitaire",
        "reference": "design-rg8465",
        "style": "diamond-shank",
        "shape": "Marquise",
        "center": 2,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8465_20_1.png?v=1795804092",
        "video": "https://im.lgdus.co/Jwl/RG8465/RG8465.mp4",
        "price": 183688,
        "finishedHandle": "marquise-lab-grown-diamond-ring-2-ct-14k-white-gold-rg8465"
      },
      {
        "title": "Marquise Diamond-Shank Solitaire",
        "reference": "design-rg8470",
        "style": "diamond-shank",
        "shape": "Marquise",
        "center": 3.02,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8470_20_1.png?v=1795804092",
        "video": "https://im.lgdus.co/Jwl/RG8470/RG8470.mp4",
        "price": 235886,
        "finishedHandle": "marquise-lab-grown-diamond-ring-3-02-ct-14k-white-gold-rg8470"
      },
      {
        "title": "Emerald Hidden Halo",
        "reference": "design-rg8428",
        "style": "hidden-halo",
        "shape": "Emerald",
        "center": 2.7,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8428_20_1.png?v=1795804093",
        "video": "https://im.lgdus.co/Jwl/RG8428/RG8428.mp4",
        "price": 230142,
        "finishedHandle": "emerald-lab-grown-diamond-hidden-halo-ring-2-7-ct-14k-white-gold-rg8428"
      },
      {
        "title": "Round Solitaire",
        "reference": "design-rg8912",
        "style": "solitaire",
        "shape": "Round",
        "center": 2.24,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8912_20_1.png?v=1795804094",
        "video": "https://im.lgdus.co/Jwl/RG8912/RG8912.mp4",
        "price": 177408,
        "finishedHandle": "round-lab-grown-diamond-solitaire-ring-2-24-ct-14k-white-gold-rg8912"
      },
      {
        "title": "Emerald Solitaire",
        "reference": "design-rg8894",
        "style": "solitaire",
        "shape": "Emerald",
        "center": 4.53,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8894_20_1.png?v=1795804095",
        "video": "https://im.lgdus.co/Jwl/RG8894/RG8894.mp4",
        "price": 298558,
        "finishedHandle": "emerald-lab-grown-diamond-solitaire-ring-4-53-ct-14k-white-gold-rg8894"
      },
      {
        "title": "Round Solitaire",
        "reference": "design-rg8915",
        "style": "solitaire",
        "shape": "Round",
        "center": 3.61,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8915_20_1_25eb3748-09e3-44c9-8233-c51c93b7423f.png?v=1795804095",
        "video": "https://im.lgdus.co/Jwl/RG8915/RG8915.mp4",
        "price": 242602,
        "finishedHandle": "round-lab-grown-diamond-solitaire-ring-3-61-ct-14k-white-gold-rg8915"
      },
      {
        "title": "Antique Marquise Diamond-Shank Solitaire",
        "reference": "design-rg8948",
        "style": "diamond-shank",
        "shape": "Antique Marquise",
        "center": 2.74,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8948_20_1.png?v=1795804103",
        "video": "https://im.lgdus.co/Jwl/RG8948/RG8948.mp4",
        "price": 203178,
        "finishedHandle": "antique-marquise-lab-grown-diamond-ring-2-74-ct-14k-white-gold-rg8948"
      },
      {
        "title": "Round Solitaire",
        "reference": "design-rg8926",
        "style": "solitaire",
        "shape": "Round",
        "center": 1.3,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8926_20_1.png?v=1795804105",
        "video": "https://im.lgdus.co/Jwl/RG8926/RG8926.mp4",
        "price": 132398,
        "finishedHandle": "round-lab-grown-diamond-solitaire-ring-1-3-ct-14k-white-gold-rg8926"
      },
      {
        "title": "Antique Marquise Solitaire",
        "reference": "design-rg8986",
        "style": "solitaire",
        "shape": "Antique Marquise",
        "center": 2.37,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8986_20_1.png?v=1795804105",
        "video": "https://im.lgdus.co/Jwl/RG8986/RG8986.mp4",
        "price": 157636,
        "finishedHandle": "antique-marquise-lab-grown-diamond-ring-2-37-ct-14k-white-gold-rg8986"
      },
      {
        "title": "Round Hidden Halo",
        "reference": "design-rg8898",
        "style": "hidden-halo",
        "shape": "Round",
        "center": 2.02,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8898_20_1.png?v=1795804106",
        "video": "https://im.lgdus.co/Jwl/RG8898/RG8898.mp4",
        "price": 146724,
        "finishedHandle": "round-lab-grown-diamond-hidden-halo-ring-2-02-ct-14k-white-gold-rg8898"
      },
      {
        "title": "Round Solitaire",
        "reference": "design-rg8932",
        "style": "solitaire",
        "shape": "Round",
        "center": 4.06,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8932_20_1.png?v=1795804107",
        "video": "https://im.lgdus.co/Jwl/RG8932/RG8932.mp4",
        "price": 225964,
        "finishedHandle": "round-lab-grown-diamond-solitaire-ring-4-06-ct-14k-white-gold-rg8932"
      },
      {
        "title": "Round Hidden Halo",
        "reference": "design-rg8897",
        "style": "hidden-halo",
        "shape": "Round",
        "center": 1.56,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8897_20_1.png?v=1795804107",
        "video": "https://im.lgdus.co/Jwl/RG8897/RG8897.mp4",
        "price": 149400,
        "finishedHandle": "round-lab-grown-diamond-hidden-halo-ring-1-56-ct-14k-white-gold-rg8897"
      },
      {
        "title": "Round Hidden Halo",
        "reference": "design-rg8901",
        "style": "hidden-halo",
        "shape": "Round",
        "center": 2.56,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8901_20_1.png?v=1795804108",
        "video": "https://im.lgdus.co/Jwl/RG8901/RG8901.mp4",
        "price": 175488,
        "finishedHandle": "round-lab-grown-diamond-hidden-halo-ring-2-56-ct-14k-white-gold-rg8901"
      },
      {
        "title": "Round Hidden Halo",
        "reference": "design-rg8919",
        "style": "hidden-halo",
        "shape": "Round",
        "center": 1.27,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8919_20_1.png?v=1795804109",
        "video": "https://im.lgdus.co/Jwl/RG8919/RG8919.mp4",
        "price": 149898,
        "finishedHandle": "round-lab-grown-diamond-hidden-halo-ring-1-27-ct-14k-white-gold-rg8919"
      },
      {
        "title": "Antique Marquise Solitaire",
        "reference": "design-rg8944",
        "style": "solitaire",
        "shape": "Antique Marquise",
        "center": 1.75,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8944_20_1.png?v=1795804110",
        "video": "https://im.lgdus.co/Jwl/RG8944/RG8944.mp4",
        "price": 173842,
        "finishedHandle": "antique-marquise-lab-grown-diamond-ring-1-75-ct-14k-white-gold-rg8944"
      },
      {
        "title": "Marquise Diamond-Shank Solitaire",
        "reference": "design-rg8956",
        "style": "diamond-shank",
        "shape": "Marquise",
        "center": 2.05,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8956_20_1.png?v=1795804111",
        "video": "https://im.lgdus.co/Jwl/RG8956/RG8956.mp4",
        "price": 172138,
        "finishedHandle": "marquise-lab-grown-diamond-ring-2-05-ct-14k-white-gold-rg8956"
      },
      {
        "title": "Emerald Solitaire",
        "reference": "design-rg8888",
        "style": "solitaire",
        "shape": "Emerald",
        "center": 3.06,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8888_20_1.png?v=1795804112",
        "video": "https://im.lgdus.co/Jwl/RG8888/RG8888.mp4",
        "price": 245924,
        "finishedHandle": "emerald-lab-grown-diamond-solitaire-ring-3-06-ct-14k-white-gold-rg8888"
      },
      {
        "title": "Radiant Hidden Halo",
        "reference": "design-rg8548",
        "style": "hidden-halo",
        "shape": "Radiant",
        "center": 3.74,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8548_20_1.png?v=1795804112",
        "video": "https://im.lgdus.co/Jwl/RG8548/RG8548.mp4",
        "price": 255934,
        "finishedHandle": "radiant-lab-grown-diamond-hidden-halo-ring-3-74-ct-14k-white-gold-rg8548"
      },
      {
        "title": "Round Hidden Halo",
        "reference": "design-rg8923",
        "style": "hidden-halo",
        "shape": "Round",
        "center": 2.4,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8923_20_1.png?v=1795804118",
        "video": "https://im.lgdus.co/Jwl/RG8923/RG8923.mp4",
        "price": 193248,
        "finishedHandle": "round-lab-grown-diamond-hidden-halo-ring-2-4-ct-14k-white-gold-rg8923"
      },
      {
        "title": "Round Solitaire",
        "reference": "design-rg8930",
        "style": "solitaire",
        "shape": "Round",
        "center": 3.21,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8930_20_1.png?v=1795804118",
        "video": "https://im.lgdus.co/Jwl/RG8930/RG8930.mp4",
        "price": 191960,
        "finishedHandle": "round-lab-grown-diamond-solitaire-ring-3-21-ct-14k-white-gold-rg8930"
      },
      {
        "title": "Round Diamond-Shank Solitaire",
        "reference": "design-rg8922",
        "style": "diamond-shank",
        "shape": "Round",
        "center": 2.38,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8922_20_1.png?v=1795804119",
        "video": "https://im.lgdus.co/Jwl/RG8922/RG8922.mp4",
        "price": 196740,
        "finishedHandle": "round-lab-grown-diamond-ring-2-38-ct-14k-white-gold-rg8922"
      },
      {
        "title": "Round Hidden Halo",
        "reference": "design-rg8921",
        "style": "hidden-halo",
        "shape": "Round",
        "center": 1.78,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8921_20_1.png?v=1795804121",
        "video": "https://im.lgdus.co/Jwl/RG8921/RG8921.mp4",
        "price": 159732,
        "finishedHandle": "round-lab-grown-diamond-hidden-halo-ring-1-78-ct-14k-white-gold-rg8921"
      },
      {
        "title": "Round Hidden Halo",
        "reference": "design-rg8903",
        "style": "hidden-halo",
        "shape": "Round",
        "center": 2.97,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8903_20_1.png?v=1795804123",
        "video": "https://im.lgdus.co/Jwl/RG8903/RG8903.mp4",
        "price": 199884,
        "finishedHandle": "round-lab-grown-diamond-hidden-halo-ring-2-97-ct-14k-white-gold-rg8903"
      },
      {
        "title": "Round Diamond-Shank Solitaire",
        "reference": "design-rg8920",
        "style": "diamond-shank",
        "shape": "Round",
        "center": 1.27,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8920_20_1.png?v=1795804123",
        "video": "https://im.lgdus.co/Jwl/RG8920/RG8920.mp4",
        "price": 156122,
        "finishedHandle": "round-lab-grown-diamond-ring-1-27-ct-14k-white-gold-rg8920"
      },
      {
        "title": "Marquise Diamond-Shank Solitaire",
        "reference": "design-rg9017",
        "style": "diamond-shank",
        "shape": "Marquise",
        "center": 2.06,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG9017_20_1.png?v=1795804124",
        "video": "https://im.lgdus.co/Jwl/RG9017/RG9017.mp4",
        "price": 185092,
        "finishedHandle": "marquise-lab-grown-diamond-ring-2-06-ct-14k-white-gold-rg9017"
      },
      {
        "title": "Marquise Diamond-Shank Solitaire",
        "reference": "design-rg9022",
        "style": "diamond-shank",
        "shape": "Marquise",
        "center": 3.13,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG9022_20_1.png?v=1795804125",
        "video": "https://im.lgdus.co/Jwl/RG9022/RG9022.mp4",
        "price": 211180,
        "finishedHandle": "marquise-lab-grown-diamond-ring-3-13-ct-14k-white-gold-rg9022"
      },
      {
        "title": "Marquise Diamond-Shank Solitaire",
        "reference": "design-rg8955",
        "style": "diamond-shank",
        "shape": "Marquise",
        "center": 1.53,
        "metal": "14K White Gold",
        "image": "https://cdn.shopify.com/s/files/1/1727/2565/files/RG8955_20_1.png?v=1795804125",
        "video": "https://im.lgdus.co/Jwl/RG8955/RG8955.mp4",
        "price": 165660,
        "finishedHandle": "marquise-lab-grown-diamond-ring-1-53-ct-14k-white-gold-rg8955"
      }
    ];

    const designsPerPage = 12;
    function supplierDesignCards(diamond) {
      const weight = Number(diamond?.spec?.carat || diamond?.carat || /^\s*(\d+(?:\.\d+)?)\s*ct\b/i.exec(diamond?.title || '')?.[1]);
      const bucket = Math.round(weight);
      const matches = supplierDesigns.filter(design => (diamond ? design.shape === diamond.shape && Math.round(design.center) === bucket : (!state.filters.shape || design.shape === state.filters.shape)) && (!state.filters.design || design.reference === state.filters.design) && (!state.filters.style || design.style === state.filters.style) && (!state.filters.metal || metalOf(design.metal) === state.filters.metal));
      const label = "Made-to-order ring designs";
      state.totalPages = Math.max(1, Math.ceil(matches.length / designsPerPage));
      state.page = Math.max(1, Math.min(state.page, state.totalPages));
      if (!matches.length) return '';
      const pageStart = (state.page - 1) * designsPerPage;
      const pageMatches = matches.slice(pageStart, pageStart + designsPerPage);
      return `<section aria-label="${label}"><h3>${label}</h3><p class="quiet">${diamond ? `Designs for ${esc(diamond.shape.toLowerCase())} diamonds around ${bucket} ct.` : `Choose a design to see matching diamonds.`}</p><div class="products">${pageMatches.map(design => {
        const sourcingQuote = !diamond && !shapes.includes(design.shape);
        const quote = new URL(diamond || sourcingQuote ? cfg.appointment : route('pages/ring-builder'), window.location.origin);
        if (diamond || sourcingQuote) {
          quote.searchParams.set('interest', 'ring');
          quote.searchParams.set('quote_design', design.title + ' · ' + design.metal + ' · ' + design.center.toFixed(2) + ' ct reference');
          const stone = diamond ? [diamond.title || stoneTitle(diamond), diamond.handle].filter(Boolean).join(' · ') : 'Help sourcing a matching ' + design.shape.toLowerCase() + ' diamond';
          quote.searchParams.set('quote_diamond', stone);
        } else {
          const center = Math.round(design.center);
          for (const [key, value] of Object.entries({ start: 'diamond', shape: design.shape, style: design.style, design: design.reference, min_carat: center - 0.5, max_carat: center + 0.49 })) quote.searchParams.set(key, value);
        }
        const video = safeURL(design.video);
        const watch = video ? `<p><a class="link" href="${esc(video)}" target="_blank" rel="noopener">Watch design video</a></p>` : '';
        const finishedRing = !diamond && design.finishedHandle ? `<p><a class="link" href="${esc(route('products/' + design.finishedHandle))}">View finished ring</a></p>` : '';
        const note = design.genericPhoto ? 'Style reference photo' : `Shown with a ${design.center.toFixed(2)} ct center`;
        const diamondPrice = Number(diamond?.price);
        const separateTotal = Number.isFinite(design.price) && cfg.currency === 'USD' && Number.isFinite(diamondPrice) && diamondPrice > 0
          ? `<p class="quiet">With your diamond ${esc(money(design.price + diamondPrice, 'USD'))}</p>`
          : '';
        return `<article class="product">${image(design.image, design.title)}<h3>${esc(design.title)}</h3><p class="quiet">${esc(design.metal)} · ${esc(note)}</p><div class="price">${Number.isFinite(design.price) ? `${esc(money(design.price, 'USD'))} estimated setting` : 'Setting priced by quote'}</div>${separateTotal}${watch}<a class="secondary" href="${esc(quote.href)}">${diamond || sourcingQuote ? "Request a quote" : "Choose a matching diamond"}</a>${finishedRing}</article>`;
      }).join('')}</div></section>`;
    }
    function settingResults() {
      state.rows = [];
      main.querySelector('[data-count]').textContent = '';
      main.querySelector('[data-results]').innerHTML = supplierDesignCards(state.diamond) || empty(true);
      const pager = main.querySelector('[data-pager]');
      pager.innerHTML = state.totalPages > 1 ? `${button('previous', 'previous', 'secondary', state.page === 1 ? 'disabled' : '')} <span>${state.page} / ${state.totalPages}</span> ${button('next', 'next', 'secondary', state.page === state.totalPages ? 'disabled' : '')}` : '';
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
    const searchCache = new Map();
    let searchController = null;
    const searchMemoryKey = 'lmDiamondSearchV1';
    function recallSearch(key) {
      if (searchCache.has(key)) return searchCache.get(key);
      try {
        const bag = JSON.parse(sessionStorage.getItem(searchMemoryKey) || '{}');
        const hit = bag[key];
        if (hit && Date.now() - Number(hit.at) < 10 * 60 * 1000 && hit.data) {
          searchCache.set(key, hit.data);
          return hit.data;
        }
      } catch (_) {}
      return null;
    }
    function rememberSearch(key, data) {
      searchCache.set(key, data);
      try {
        const bag = JSON.parse(sessionStorage.getItem(searchMemoryKey) || '{}');
        bag[key] = { at: Date.now(), data };
        const fresh = Object.entries(bag).filter(([, value]) => Date.now() - Number(value.at) < 10 * 60 * 1000).slice(-8);
        sessionStorage.setItem(searchMemoryKey, JSON.stringify(Object.fromEntries(fresh)));
      } catch (_) {}
    }
    function diamondQuery() {
      const params = new URLSearchParams({ kind: state.filters.origin, page: String(state.page), per_page: '12', sort: state.filters.sort, shape: state.setting?.shape || state.filters.shape });
      for (const [key, value] of Object.entries(state.filters)) if (value !== '' && !['origin', 'shape', 'sort', 'metal', 'style'].includes(key)) params.set(key === 'color' ? 'colors' : key === 'clarity' ? 'clarities' : key === 'cut' ? 'cuts' : key, value);
      return params;
    }
    function paintDiamonds(response, result) {
      if (!result?.isConnected) return;
      state.rows = response.stones || [];
      state.totalPages = Math.max(1, response.total_pages || 1);
      const count = main.querySelector('[data-count]');
      const pager = main.querySelector('[data-pager]');
      if (count) count.textContent = counted('results', response.total || 0);
      result.innerHTML = state.rows.length ? `<div class="products">${state.rows.map((s, i) => `<article class="product"><div class="card-media" ${safeURL(s.video_urls?.[0]) ? `data-video="${esc(safeURL(s.video_urls[0]))}"` : ''}>${image(s.image_urls?.[0], stoneTitle(s))}</div><h3>${esc(stoneTitle(s))}</h3><div class="quiet">${esc([t(s.kind === 'natural' ? 'natural' : 'lab'), s.color, s.clarity, s.cut ? t('cut_value', { cut: s.cut }) : '', s.lab].filter(Boolean).join(' · '))}</div>${faceUpText(s.measurements) ? `<div class="quiet">${esc(faceUpText(s.measurements))}</div>` : ''}<div class="price">${money(Math.round(s.retail_usd * 100), 'USD')}</div>${cardActions(i)}</article>`).join('')}</div>` : empty();
      returnToCard();
      if (pager) pager.innerHTML = state.totalPages > 1 ? `${button('previous', 'previous', 'secondary', state.page <= 1 ? 'disabled' : '')}<span class="quiet">${esc(t('page', { page: state.page, pages: state.totalPages }))}</span>${button('next', 'next', 'secondary', state.page >= state.totalPages ? 'disabled' : '')}` : '';
    }
    function searchFailed(result, timedOut) {
      const count = main.querySelector('[data-count]');
      if (count) count.textContent = '';
      if (result?.isConnected) result.innerHTML = `<p>${esc(t(timedOut ? 'load_timeout' : 'load_failed'))}</p>${button('retry', 'retry', 'secondary')} <a class="link" href="${esc(cfg.contact)}">${esc(t('help'))}</a>`;
    }
    async function search() {
      clearTimeout(searchTimer);
      const generation = ++state.generation;
      if (searchController) searchController.abort();
      const controller = new AbortController();
      searchController = controller;
      const result = main.querySelector('[data-results]');
      if (!result) return;
      if (!cfg.apiBase) { result.innerHTML = `<p>${esc(t('search_unavailable'))}</p>`; return; }
      const key = diamondQuery().toString();
      const cached = recallSearch(key);
      if (cached) paintDiamonds(cached, result);
      else {
        result.innerHTML = `<p>${esc(t('searching'))}</p>`;
        const count = main.querySelector('[data-count]');
        if (count) count.textContent = t('loading');
        const pager = main.querySelector('[data-pager]');
        if (pager) pager.innerHTML = '';
      }
      try {
        const response = await request(cfg.apiBase + '?' + key, { headers: apiHeaders(), signal: controller.signal, timeout: 12000 });
        if (generation !== state.generation || state.screen !== 'catalog' || state.kind !== 'diamond') return;
        rememberSearch(key, response);
        paintDiamonds(response, result);
      } catch (error) {
        if (generation !== state.generation || state.screen !== 'catalog' || state.kind !== 'diamond') return;
        if (error?.name === 'AbortError') return;
        searchFailed(result, error?.name === 'TimeoutError');
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
        track('product_viewed', { product_kind: state.kind });
        if (quick) choose(); else go('detail');
      } catch (error) { if (generation === state.generation) notice(error.message || t('load_failed'), true); }
    }
    function relatedShapes(setting) {
      const style = styleOf(setting);
      if (state.diamond || !['solitaire', 'hidden-halo'].includes(style)) return '';
      const alternatives = new Map();
      for (const candidate of knownSettings.values()) {
        if (candidate.shape !== setting.shape && styleOf(candidate) === style && !alternatives.has(candidate.shape)) {
          alternatives.set(candidate.shape, candidate);
        }
      }
      if (!alternatives.size) return '';
      const links = Array.from(alternatives, ([shape, candidate]) =>
        `<a class="link" href="${esc(candidate.url)}">${esc(shape)}</a>`
      ).join(' · ');
      return `<p class="quiet">${esc(t('similar_shapes'))} ${links}</p>`;
    }
    function detail() {
      const p = state.detail;
      if (!p) return go('catalog');
      const isSetting = state.kind === 'setting';
      const photos = p.images?.length ? p.images : [p.image];
      const s = p.spec || {};
      const facts = [['shape', p.shape], ...(!isSetting ? [['origin', t(p.origin === 'natural' ? 'natural' : 'lab')], ['color', s.color], ['clarity', s.clarity], ['cut', s.cut], ['polish', s.polish], ['symmetry', s.symmetry], ['fluorescence', s.fluorescence], ['measurements', s.measurements], ['table', s.table_pct != null ? s.table_pct + '%' : null], ['depth', s.depth_pct != null ? s.depth_pct + '%' : null], ['certificate', [s.lab, s.cert_number].filter(Boolean).join(' ')]] : [])].filter(([, value]) => value != null && value !== '');
      const videos = [...new Set([...(p.videos || []), ...(s.video_urls || [])].filter(safeURL))];
      main.innerHTML = `${button('back_results', 'catalog', 'link')}<div class="detail"><div><div class="media" data-media>${image(photos[state.photo], p.title, '', true)}</div>${photos.length > 1 ? `<div class="media-thumbs">${photos.map((src, i) => `<button type="button" data-action="photo-${i}" aria-label="${esc(t('photo', { number: i + 1 }))}" aria-pressed="${i === state.photo}">${image(src)}</button>`).join('')}</div>` : ''}${videos.map((src, i) => `<button type="button" class="link" data-action="video-${i}">${esc(t('video'))}</button>`).join('')}${safeURL(s.cert_url) ? `<p><a class="link" href="${esc(safeURL(s.cert_url))}" target="_blank" rel="noopener">${esc(t('report'))}</a></p>` : ''}</div><div><div class="eyebrow">${esc(t(isSetting ? 'setting' : 'diamond'))}</div><h2>${esc(p.title)}</h2><p class="total">${isSetting ? settingPriceHtml(p) : esc(money(p.price))}</p><p class="quiet">${esc(t(isSetting ? 'setting_only' : 'diamond_only'))}</p>${button(isSetting ? 'select_setting' : 'select_diamond', 'select')}${isSetting ? relatedShapes(p) : ''}<p class="quiet">${esc(t(!isSetting && !state.setting && !settingCount(p.shape) ? 'no_setting_shape' : 'fits_check'))}</p><p class="detail-help"><a class="link" href="${esc(cfg.contact)}">${esc(t(isSetting ? 'ask_setting' : 'ask_stone'))}</a><a class="link" href="${esc(consultationLink())}">${esc(t('book_viewing'))}</a></p><div class="facts">${facts.map(([key, value]) => `<div class="row"><span class="fact-label">${esc(t(key))}</span><span>${esc(value)}</span></div>`).join('')}</div><a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(t('open_product'))}</a></div></div>`;
      state.detailVideos = videos;
    }
    function bandSummary() {
      return chosenBands().map(b => `<div class="sum-item" data-band-summary="${b.slot}"><div class="sum-title"><span class="eyebrow">${esc(bandLabel(b.slot))}</span><div>${button('change', 'edit-band-' + b.slot, 'link')} ${button('remove', 'remove-band-' + b.slot, 'link')}</div></div><div class="sum-product">${image(b.product.image, '', 'thumb')}<div>${esc(b.product.title)}<p class="quiet">${esc(bandOptionText(b))}</p>${b.variant ? money(b.variant.price) : esc(t('band_options_required'))}</div></div></div>`).join('');
    }
    function bandPicker() {
      if (!(cfg.bands || []).length) return '';
      const p = state.band;
      if (state.bandsCollapsed) return `<section class="rule band-upsell band-upsell--collapsed" aria-label="${esc(t('band_heading'))}"><div><span class="eyebrow">${esc(t('band_optional'))}</span><h2>${esc(t('band_heading'))}</h2><p class="quiet">${esc(t(hasBands() ? 'band_kept' : 'band_skipped'))}</p></div>${button(hasBands() ? 'band_edit_selection' : 'band_browse', 'reopen-bands', 'secondary')}</section>`;
      return `<section class="rule band-upsell" aria-label="${esc(t('band_heading'))}"><div class="heading"><div><span class="eyebrow">${esc(t('band_optional'))}</span><h2>${esc(t('band_heading'))}</h2></div>${!hasBands() ? button('band_skip', 'finish-bands', 'link') : ''}</div><p class="quiet">${esc(t('band_pair_note'))}</p><div class="band-slots">${state.bandSelections.map((b, slot) => `<button type="button" class="secondary" data-action="edit-band-${slot}" aria-pressed="${state.bandSlot === slot}"><strong>${esc(bandLabel(slot))}</strong><span>${esc(b.product?.title || t(slot ? 'add_second_band' : 'choose_band'))}</span></button>`).join('')}</div><div class="heading"><h3>${esc(bandLabel(state.bandSlot))}</h3>${p ? button('remove', 'remove-band', 'link') : ''}</div>${bandCategories()}${button(state.showAllBands ? 'band_show_featured' : 'band_view_all', 'toggle-all-bands', 'link')}${state.showAllBands ? bandFilters() : ''}${bandCards()}<label>${esc(t('band'))}<select data-band-product><option value="">${esc(t('no_band'))}</option>${bandOptions()}</select></label>${p ? `<div class="sum-product">${image(p.image, p.title, 'thumb')}<a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(t('open_product'))}</a></div><div class="fields">${p.options.map((o,i) => o.name === 'Title' ? '' : `<label>${esc(o.name)}<select data-band-option="${i}"><option value="">${esc(t('choose_option'))}</option>${o.values.map(v => `<option value="${esc(v)}" ${state.bandOptions[i] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`).join('')}</div><p class="${bandVariant() ? 'quiet' : 'error'}">${bandVariant() ? money(bandVariant().price) : esc(t('band_options_required'))}</p>` : ''}<div class="band-next">${button(hasBands() ? 'band_continue' : 'band_skip', 'finish-bands', hasBands() ? 'primary' : 'secondary')}</div></section>`;
    }
    const bandStylePatterns = { eternity: /eternity/, half: /half.eternity/, three_quarter: /three.quarter/, stone: /(?:five|seven).stone/, satin: /satin|brushed|matte|silk/, hammered: /hammered/, milgrain: /milgrain/, carved: /carved|chevron|crosshatch|diagonal|vine|scroll/, groove: /groove|channel|stripe/ };
    const bandMetals = b => [...new Set((String(b.metalText || b.title).toLowerCase().match(/white|yellow|rose|platinum/g) || []))];
    const categoryBands = () => cfg.bands.filter(b => (b.category || 'diamond') === state.bandCategory);
    function bandFilters() {
      const rows = categoryBands();
      const metals = [...new Set(rows.flatMap(bandMetals))];
      const styles = Object.entries(bandStylePatterns).filter(([, pattern]) => rows.some(b => pattern.test(b.title.toLowerCase())));
      return `<div class="fields band-filters"><label>${esc(t('metal'))}<select data-band-filter="metal"><option value="">${esc(t('all_metals'))}</option>${metals.map(m => `<option value="${esc(m)}" ${state.bandMetal === m ? 'selected' : ''}>${esc(metalName(m))}</option>`).join('')}</select></label><label>${esc(t('band_style'))}<select data-band-filter="style"><option value="">${esc(t('band_all_styles'))}</option>${styles.map(([key]) => `<option value="${key}" ${state.bandStyle === key ? 'selected' : ''}>${esc(t('band_style_' + key))}</option>`).join('')}</select></label></div>`;
    }
    function bandCategories() {
      if (!cfg.bands.some(b => b.category === 'mens')) return '';
      return `<div class="band-categories">${['diamond', 'mens'].map(category => button('band_' + category, 'band-category-' + category, 'secondary', `aria-pressed="${state.bandCategory === category}"`)).join('')}</div>`;
    }
    function bandCards() {
      const ring = metalOf(pickedVariant()?.options.join(' ') || state.setting?.title);
      const ranked = categoryBands().filter(b => !state.showAllBands || ((!state.bandMetal || bandMetals(b).includes(state.bandMetal)) && (!state.bandStyle || bandStylePatterns[state.bandStyle]?.test(b.title.toLowerCase())))).sort((a, b) => Number(metalOf(b.title) === ring && !!ring) - Number(metalOf(a.title) === ring && !!ring));
      const featured = ranked.filter(b => b.image).slice(0, state.showAllBands ? ranked.length : 3);
      if (!state.showAllBands && state.band && !featured.some(b => b.handle === state.band.handle)) {
        const selected = ranked.find(b => b.handle === state.band.handle);
        if (selected?.image) featured.splice(2, 1, selected);
      }
      return `${state.showAllBands ? `<p class="quiet" data-band-count>${esc(t('band_results', { count: featured.length }))}</p>` : ''}<div class="band-cards ${state.showAllBands ? 'band-cards--all' : ''}">${featured.map(b => {
        const selected = state.band?.handle === b.handle;
        return `<button type="button" class="band-card" data-action="choose-band" data-band-handle="${esc(b.handle)}" aria-pressed="${selected}">${image(b.image, b.title)}<span class="band-card-title">${esc(b.title)}</span><span>${esc(b.price_varies ? t('price_from', { price: money(b.price) }) : money(b.price))}</span><span class="band-card-cta">${esc(t(selected ? 'band_selected' : 'band_select'))}</span></button>`;
      }).join('')}</div>`;
    }
    async function chooseBand(handle) {
      if (!handle) { state.band = null; state.bandOptions = []; state.group = ''; render(); return; }
      state.busy = true; lockControls(); notice(t('loading_piece'));
      try { await selectBand(handle); state.group = ''; track('band_selected'); notice(''); }
      catch (error) { notice(error.message, true); }
      finally { state.busy = false; render(); }
      main.querySelector('[data-band-option]')?.focus({ preventScroll: true });
    }
    function bandOptions() {
      const ring = metalOf(pickedVariant()?.options.join(' ') || state.setting?.title);
      const option = b => `<option value="${esc(b.handle)}" ${state.band?.handle === b.handle ? 'selected' : ''}>${esc(b.title)}${b.price ? ' · ' + esc(b.price_varies ? t('price_from', { price: money(b.price) }) : money(b.price)) : ''}</option>`;
      const diamondBands = cfg.bands.filter(b => b.category !== 'mens');
      const mensBands = cfg.bands.filter(b => b.category === 'mens');
      const mensGroup = mensBands.length ? `<optgroup label="${esc(t('band_mens'))}">${mensBands.map(option).join('')}</optgroup>` : '';
      const matching = diamondBands.filter(b => ring && metalOf(b.title) === ring);
      if (!matching.length) return diamondBands.map(option).join('') + mensGroup;
      const others = diamondBands.filter(b => !matching.includes(b));
      return `<optgroup label="${esc(t('band_match', { metal: metalName(ring).toLowerCase() }))}">${matching.map(option).join('')}</optgroup>${others.length ? `<optgroup label="${esc(t('band_other'))}">${others.map(option).join('')}</optgroup>` : ''}${mensGroup}`;
    }
    async function selectBand(handle, options = []) {
      if (!knownBands.has(handle)) throw new Error(t('unavailable'));
      const p = await product(handle);
      if (!p.band) throw new Error(t('unavailable'));
      state.band = p;
      state.bandCategory = cfg.bands.find(b => b.handle === handle)?.category || 'diamond';
      state.bandOptions = options;
      if (options.length) return;
      const ringMetal = pickedVariant()?.options.find(value => metalOf(value));
      p.options.forEach((o, i) => {
        const wanted = /size/i.test(o.name) ? (state.bandCategory === 'mens' || state.bandSlot > 0 ? '' : state.size) : /metal/i.test(o.name) ? ringMetal : '';
        if (o.values.length === 1) state.bandOptions[i] = o.values[0];
        if (wanted && o.values.includes(wanted)) state.bandOptions[i] = wanted;
      });
    }
    function review() {
      if (!both()) return go('catalog');
      const p = state.setting, si = sizeIndex(p), available = p.variants.filter(v => v.available);
      const sizes = si >= 0 ? [...new Set(p.variants.map(v => String(v.options[si])))] : Array.from({ length: 10 }, (_, i) => String(4 + i * .5));
      const sizeOptions = `<option value="" ${state.size ? '' : 'selected'}>${esc(t('choose_size'))}</option>${sizes.map(s => `<option value="${esc(s)}" ${state.size === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}<option value="unsure" ${state.size === 'unsure' ? 'selected' : ''}>${esc(t('not_sure'))}</option>`;
      const optionFields = p.options.map((o, i) => {
        if (i === si || o.name === 'Title') return '';
        const multi = o.values.length > 1;
        const current = state.options[i] || '';
        const placeholder = multi ? `<option value="" ${current ? '' : 'selected'}>${esc(t('choose_metal'))}</option>` : '';
        return `<label>${esc(o.name)}<select data-option="${i}" class="${multi ? (current ? 'is-set' : 'is-empty') : 'is-set'}">${placeholder}${o.values.map(v => `<option value="${esc(v)}" ${current === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>${multi && !current ? `<span class="${state.choicePrompt ? 'error' : 'quiet'}" data-metal-hint>${esc(t('metal_required'))}</span>` : ''}</label>`;
      }).join('');
      main.innerHTML = `<div class="heading"><h2>${esc(t('make_yours'))}</h2>${button('back', 'back-step', 'link')}</div><div class="review-images">${['setting', 'diamond'].map(k => `<figure><div data-review-media="${k}">${image(state[k].image, state[k].title)}</div><figcaption>${esc(k === 'setting' && chosenDetails(state.setting) ? state.setting.title.replace(/\s+in\s+.+$/i, ' in ' + chosenDetails(state.setting)) : state[k].title)}${k === 'setting' && (state.setting.videos || []).some(safeURL) ? ` ${button('watch_setting', 'review-video', 'link')}` : ''}</figcaption></figure>`).join('')}</div><div class="fields"><div><label>${esc(t('size'))}<select data-field="size" class="${state.size ? 'is-set' : 'is-empty'}">${sizeOptions}</select></label><p class="${state.choicePrompt && !state.size ? 'error' : 'quiet'}" data-size-hint role="status" ${state.size ? 'hidden' : ''}>${esc(t('size_required'))}</p><a class="link" href="${esc(cfg.sizeGuide)}" target="_blank" rel="noopener">${esc(t('size_guide'))}</a></div>${optionFields}</div>${state.size && optionsReady() && !pickedVariant() ? `<p class="error">${esc(t('size_unavailable'))}</p>` : ''}${scaleView()}<p class="detail-help">${button('share_ring', 'share', 'link')}<a class="link" href="${esc(cfg.contact)}">${esc(t('ask_ring'))}</a><a class="link" href="${esc(consultationLink())}">${esc(t('book_viewing'))}</a></p><p class="quiet">${esc(t('fits_check'))}</p><div class="fields rule"><label>${esc(t('engraving'))}<input data-field="engraving" maxlength="20" value="${esc(state.engraving)}"><span class="quiet">${esc(t('engraving_hint'))}</span></label><label>${esc(t('engraving_font'))}<select data-field="font"><option value="block" ${state.font === 'block' ? 'selected' : ''}>${esc(t('block'))}</option><option value="script" ${state.font === 'script' ? 'selected' : ''}>${esc(t('script'))}</option></select></label></div><div class="inscription ${state.font === 'script' ? 'script' : ''}" data-inscription aria-label="${esc(t('engraving_preview'))}" ${state.engraving ? '' : 'hidden'}>${esc(state.engraving)}</div><label class="rule">${esc(t('date'))}<input data-field="date" type="date" value="${esc(state.date)}"><span class="quiet">${esc(t('date_hint'))}</span></label><div class="callout"><strong>${esc(t('made_order'))}</strong><br>${esc(t('production_note'))}</div><p class="quiet fulfillment">${esc(t('fulfillment'))} <a class="link" href="${esc(route('pages/shipping-returns'))}">${esc(t('shipping_returns'))}</a></p><div class="review-purchase" data-review-purchase></div>${bandPicker()}`;
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
      const chosen = state.size && state.size !== 'unsure';
      const size = chosen ? Number(state.size) : 6, finger = 11.63 + 0.8128 * size, view = Math.max(26, length + 8);
      return `<figure class="scale" data-scale-view><svg viewBox="${-view / 2} ${-view / 2} ${view} ${view}" role="img" aria-label="${esc(t('scale_label'))}"><rect class="finger" x="${-finger / 2}" y="${-view / 2 - 2}" width="${finger}" height="${view + 4}"/><g class="stone">${shapeOutline(state.diamond.shape, width, length)}</g></svg><figcaption>${esc(t(chosen ? 'scale_caption' : 'scale_example', { length: length.toFixed(2), width: width.toFixed(2), size: chosen ? state.size : 6, finger: finger.toFixed(1) }))}</figcaption></figure>`;
    }
    function ringLink() {
      const url = new URL(location.pathname, location.origin);
      url.searchParams.set('setting', state.setting.handle);
      url.searchParams.set('diamond', state.diamond.handle);
      url.searchParams.set('step', 'review');
      url.hash = 'build=' + encodeURIComponent(JSON.stringify({
        v: 1, setting: state.setting.handle, diamond: state.diamond.handle,
        size: state.size, options: state.options, engraving: state.engraving,
        font: state.font, date: state.date,
        bands: state.bandSelections.map(b => ({ handle: b.product?.handle || '', options: b.options }))
      }));
      return url;
    }
    function sharedBuild(params) {
      if (!location.hash.startsWith('#build=') || location.hash.length > 6000) return null;
      try {
        const value = JSON.parse(decodeURIComponent(location.hash.slice(7)));
        const text = (v, max) => typeof v === 'string' && v.length <= max;
        const options = v => Array.isArray(v) && v.length <= 3 && v.every(o => o == null || text(o, 100));
        if (!value || value.v !== 1 || !handlePattern.test(value.setting || '') || !handlePattern.test(value.diamond || '') || value.setting !== params.get('setting') || value.diamond !== params.get('diamond')) return null;
        if (!text(value.size, 20) || !options(value.options) || !text(value.engraving, 20) || !['block', 'script'].includes(value.font) || !text(value.date, 10) || (value.date && !/^\d{4}-\d{2}-\d{2}$/.test(value.date))) return null;
        if (!Array.isArray(value.bands) || value.bands.length > 2 || !value.bands.every(b => b && text(b.handle, 100) && (!b.handle || handlePattern.test(b.handle)) && options(b.options))) return null;
        return { setting: value.setting, diamond: value.diamond, size: value.size, options: value.options, engraving: value.engraving, font: value.font, date: value.date, bands: value.bands.map(b => ({ handle: b.handle, options: b.options })) };
      } catch (_) { return null; }
    }
    function fillRingEmail(form) {
      const variant = pickedVariant();
      const values = {
        link: ringLink().href,
        setting: state.setting.title,
        diamond: state.diamond.title,
        size: state.size === 'unsure' ? t('not_sure') : state.size,
        options: [...state.setting.options.map((o, i) => /size/i.test(o.name) || o.name === 'Title' || !variant ? '' : o.name + ': ' + variant.options[i]), ...chosenBands().map(b => bandLabel(b.slot) + ': ' + b.product.title + ' · ' + bandOptionText(b) + ' · ' + (b.variant ? money(b.variant.price) : t('band_options_required'))), state.engraving.trim() ? t('engraving') + ': ' + state.engraving.trim() : ''].filter(Boolean).join(' · '),
        subtotal: money(subtotal())
      };
      form.querySelectorAll('[data-ring-email-field]').forEach(input => { input.value = values[input.dataset.ringEmailField] || ''; });
    }
    async function share() {
      const url = ringLink();
      try {
        if (navigator.share) await navigator.share({ title: t('your_ring'), text: [state.setting.title, state.diamond.title].join(' · '), url: url.href });
        else { await navigator.clipboard.writeText(url.href); notice(t('link_copied')); }
        track('build_shared');
      } catch (error) { if (error?.name !== 'AbortError') notice(t('share_failed', { url: url.href }), true); }
    }
    // After the ring email posts, Shopify reloads this page with contact_posted=true.
    // The builder draws the review after load, so the #RingEmailForm jump lands at
    // the top; confirm at the top instead, then drop the flag so a refresh or a
    // shared link does not say "Sent" again. A failed send goes back to the form.
    function afterRingEmail() {
      const mail = root.querySelector('[data-ring-email]');
      const sent = mail && !mail.hidden && mail.querySelector('[data-ring-email-sent]');
      const failed = mail && !mail.hidden && mail.querySelector('[data-ring-email-error]');
      const u = new URL(window.location.href);
      if (sent && sentBox) {
        const items = ['setting', 'diamond'].filter(k => state[k]).map(k => `<li><span class="eyebrow">${esc(t(k))}</span>${esc(state[k].title)}</li>`).join('');
        sentBox.innerHTML = `<h2>${esc(t('email_sent_title'))}</h2><p>${esc(t('email_sent'))}</p>${items ? `<ul>${items}</ul>` : ''}<p class="detail-help"><a class="link" href="${esc(consultationLink())}">${esc(t('book_viewing'))} →</a>${button('keep_personalizing', 'keep-personalizing', 'link')}</p>`;
        sentBox.hidden = false;
        reveal(sentBox);
        sentBox.focus({ preventScroll: true });
      } else if (failed) {
        reveal(mail);
        mail.querySelector('input[type="email"]')?.focus({ preventScroll: true });
      }
      if (u.searchParams.has('contact_posted') || u.hash === '#RingEmailForm') {
        u.searchParams.delete('contact_posted');
        if (u.hash === '#RingEmailForm') u.hash = '';
        history.replaceState(null, '', u.pathname + u.search + u.hash);
      }
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
      if (sentBox && state.screen !== 'review') sentBox.hidden = true;
    }
    function reveal(target) {
      if (!target) return;
      const offset = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
      const top = target.getBoundingClientRect().top;
      if (top < offset || top > window.innerHeight * 0.75) window.scrollTo({ top: Math.max(0, top + window.scrollY - offset - 16), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    function scrollStepTop() {
      const offset = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
      const top = root.getBoundingClientRect().top + window.scrollY - offset - 8;
      window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    }
    function go(screen) {
      const previous = state.screen;
      const moved = ready && (screen !== previous || navPush);
      navPush = false;
      const back = screen === 'catalog' && state.returnIndex != null;
      state.generation++;
      state.screen = screen;
      historyMode = moved ? 'push' : 'replace';
      render();
      historyMode = 'replace';
      if (!back && (moved || !ready)) scrollStepTop();
      if (!moved) return;
      if (screen === 'review' && both()) track('build_review_reached');
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
    function completeGroup(lines, variant, stone) {
      return lines.length === 2 + chosenBands().length && chosenBands().every(b => b.variant && lines.some(i => Number(i.variant_id || i.id) === Number(b.variant.id) && i.quantity === 1 && Number(i.properties?._lm_band_slot || 0) === b.slot)) && lines.some(i => Number(i.variant_id || i.id) === Number(variant.id) && i.quantity === 1) && lines.some(i => Number(i.variant_id || i.id) === Number(stone.variant) && i.quantity === 1);
    }
    async function removeGroup(lines) {
      if (!lines.length) return;
      const updates = Object.fromEntries(lines.map(item => [item.key, 0]));
      await request(route('cart/update.js'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ updates }) });
    }
    async function addRing() {
      if (state.busy || !both() || !state.size || !optionsReady() || !pickedVariant() || !bandsValid()) return;
      const oldTotal = subtotal(), settingHandle = state.setting.handle, diamondHandle = state.diamond.handle;
      state.busy = true;
      notice(t('adding'));
      summary();
      lockControls();
      let addAttempted = false, selectedVariant;
      try {
        const [freshSetting, freshDiamond, freshBands] = await Promise.all([product(settingHandle), diamond(diamondHandle), Promise.all(chosenBands().map(async b => ({ slot: b.slot, product: await product(b.product.handle) })))]);
        for (const fresh of freshBands) {
          if (!fresh.product.band || !knownBands.has(fresh.product.handle)) throw new Error(t('unavailable'));
          state.bandSelections[fresh.slot].product = fresh.product;
        }
        if (!bandsValid()) throw new Error(t('band_options_required'));
        setSetting(freshSetting, true);
        if (freshSetting.shape !== freshDiamond.shape) throw new Error(t('wrong_shape'));
        state.diamond = freshDiamond;
        selectedVariant = pickedVariant();
        const sizeAt = sizeIndex(state.setting);
        if (!state.size || !selectedVariant || (sizeAt >= 0 && state.size !== 'unsure' && String(selectedVariant.options[sizeAt]) !== String(state.size))) throw new Error(t('size_required'));
        if (subtotal() !== oldTotal) throw new Error(t('price_changed'));
        if (!state.group) state.group = 'lmny-' + (globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2));
        persist();
        const current = await cart(), existing = groupLines(current);
        if (completeGroup(existing, selectedVariant, state.diamond)) { if (state.editGroup && state.editGroup !== state.group) await removeGroup(groupLines(current, state.editGroup)); window.location.assign(cfg.cartUrl); return; }
        if (existing.length) await removeGroup(existing);
        const properties = { _lm_ring_id: state.group, _lm_setting_handle: settingHandle, _lm_diamond_handle: diamondHandle, Ring: state.setting.title, Diamond: state.diamond.title, 'Ring size': state.size === 'unsure' ? t('not_sure') : state.size };

        if (state.size === 'unsure') properties['Size check'] = t('not_sure');
        state.setting.options.forEach((o, i) => { if (!/size/i.test(o.name) && o.name !== 'Title') properties[o.name] = selectedVariant.options[i]; });
        if (state.engraving.trim()) { properties.Engraving = state.engraving.trim().slice(0, 20); properties['Engraving font'] = t(state.font === 'script' ? 'script' : 'block'); }
        if (state.date) properties['Requested date'] = state.date;
        const items = [{ id: selectedVariant.id, quantity: 1, properties }, { id: state.diamond.variant, quantity: 1, properties: { _lm_ring_id: state.group, _lm_setting_handle: settingHandle, _lm_diamond_handle: diamondHandle, 'Set in': state.setting.title, 'Ring size': properties['Ring size'] } }];
        chosenBands().forEach(b => items.push({ id: b.variant.id, quantity: 1, properties: { _lm_ring_id: state.group, _lm_band_handle: b.product.handle, _lm_band_slot: String(b.slot), _lm_setting_handle: settingHandle, _lm_diamond_handle: diamondHandle, 'Paired with': state.setting.title } }));
        addAttempted = true;
        await request(route('cart/add.js'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items }) });
        const verified = groupLines(await cart());
        if (!completeGroup(verified, selectedVariant, state.diamond)) { await removeGroup(verified); throw new Error(t('cart_failed')); }
        if (state.editGroup && state.editGroup !== state.group) await removeGroup(groupLines(await cart(), state.editGroup));
        state.editGroup = ''; persist();
        await track('build_added_to_cart');
        notice(t('added'));
        window.location.assign(cfg.cartUrl);
      } catch (error) {
        if (addAttempted) {
          try {
            const lines = groupLines(await cart());
            if (selectedVariant && completeGroup(lines, selectedVariant, state.diamond)) {
              if (state.editGroup && state.editGroup !== state.group) await removeGroup(groupLines(await cart(), state.editGroup));
              await track('build_added_to_cart');
              window.location.assign(cfg.cartUrl);
              return;
            }
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
        track(state.kind + '_selected');
        if (both()) go('review'); else { state.kind = state.kind === 'setting' ? 'diamond' : 'setting'; state.page = 1; state.returnIndex = null; navPush = true; go('catalog'); }
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
      if (action.startsWith('band-category-')) { state.bandCategory = action.slice(14); state.bandMetal = ''; state.bandStyle = ''; render(); return; }
      if (action === 'reopen-bands') { state.bandsCollapsed = false; render(); const target = main.querySelector('.band-slots button'); reveal(main.querySelector('.band-upsell')); target?.focus({ preventScroll: true }); return; }
      if (action === 'finish-bands') {
        const incomplete = chosenBands().find(b => !b.variant);
        if (incomplete) {
          state.bandSlot = incomplete.slot;
          state.bandCategory = cfg.bands.find(b => b.handle === incomplete.product.handle)?.category || 'diamond';
          state.bandMetal = ''; state.bandStyle = ''; render(); notice(t('band_options_required'), true);
          const option = main.querySelector('[data-band-option]'); reveal(option); option?.focus({ preventScroll: true }); return;
        }
        state.bandsCollapsed = true; render();
        const size = main.querySelector('[data-field="size"]'); reveal(size?.closest('label')); size?.focus({ preventScroll: true }); return;
      }
      if (action === 'toggle-all-bands') { state.showAllBands = !state.showAllBands; render(); return; }
      if (action.startsWith('edit-band-')) { state.bandsCollapsed = false; state.bandSlot = Number(action.slice(10)) === 1 ? 1 : 0; state.bandCategory = state.band ? cfg.bands.find(b => b.handle === state.band.handle)?.category || 'diamond' : state.bandSlot && cfg.bands.some(b => b.category === 'mens') ? 'mens' : 'diamond'; state.bandMetal = ''; state.bandStyle = ''; if (state.screen !== 'review' && both()) go('review'); else render(); reveal(main.querySelector('.band-upsell')); return; }
      if (action.startsWith('remove-band-')) { const slot = Number(action.slice(12)) === 1 ? 1 : 0; state.bandSelections[slot] = { product: null, options: [] }; state.group = ''; render(); return; }
      if (action === 'choose-band') { await chooseBand(el.dataset.bandHandle); return; }
      if (action === 'remove-band') { state.band = null; state.bandOptions = []; state.group = ''; render(); }
      else if (action.startsWith('start-') || action.startsWith('change-')) {
        const starting = state.screen === 'start' && action.startsWith('start-');
        state.kind = action.split('-')[1]; state.page = 1; state.returnIndex = null;
        if (starting) state.entry = state.kind;
        if (state.kind === 'setting') state.filters.shape = state.diamond ? state.diamond.shape : '';
        if (state.kind === 'diamond' && state.setting) state.filters.shape = state.setting.shape;
        go('catalog');
        if (starting) track('builder_path_selected', { product_kind: state.kind });
      } else if (action.startsWith('details-')) openDetails(Number(action.slice(8)));
      else if (action.startsWith('quick-')) openDetails(Number(action.slice(6)), true);
      else if (action === 'select') choose();
      else if (action === 'more-filters') { state.moreFilters = el.getAttribute('aria-expanded') !== 'true'; el.setAttribute('aria-expanded', String(state.moreFilters)); main.querySelector('[data-more-filters]').hidden = !state.moreFilters; paintDiamondFilters(); }
      else if (action === 'pick-grades') {
        readDiamondFilters();
        const on = state.filters.color === gradePick.color && state.filters.clarity === gradePick.clarity;
        state.filters.color = on ? '' : gradePick.color; state.filters.clarity = on ? '' : gradePick.clarity;
        paintDiamondFilters(); state.page = 1; search(); persist();
      }
      else if (action.startsWith('carat-')) {
        readDiamondFilters();
        const [low, high] = caratChips[Number(action.slice(6))];
        const on = state.filters.min_carat === low && state.filters.max_carat === high;
        state.filters.min_carat = on ? '' : low; state.filters.max_carat = on ? '' : high;
        paintDiamondFilters(); state.page = 1; search(); persist();
      } else if (action.startsWith('clear-')) { state[action.slice(6)] = null; state.group = ''; go('catalog'); }
      else if (action === 'review') go('review');
      else if (action === 'keep-personalizing') { const size = main.querySelector('[data-field="size"]'); reveal(size?.closest('label')); size?.focus({ preventScroll: true }); }
      else if (action === 'back-step') {
        if (state.screen === 'detail') {
          state.returnIndex = state.detailIndex;
          go('catalog');
        } else if (state.screen === 'review' || (state.screen === 'catalog' && ((state.entry === 'setting' && state.kind === 'diamond' && state.setting) || (state.entry === 'diamond' && state.kind === 'setting' && state.diamond)))) {
          state.kind = state.entry === 'setting' ? 'setting' : 'diamond';
          state.page = 1;
          state.returnIndex = null;
          navPush = true;
          go('catalog');
        } else if (state.screen === 'catalog' && !state.setting && !state.diamond) {
          let outside = false;
          try {
            const ref = new URL(document.referrer);
            outside = ref.origin === location.origin && !ref.pathname.includes('/pages/ring-builder');
          } catch (_) {}
          if (outside && history.length > 1) { history.back(); return; }
          go('start');
        } else go('start');
      }
      else if (action === 'catalog' || action === 'start') {
        if (action === 'start' && state.screen === 'catalog' && !state.setting && !state.diamond) {
          let outside = false;
          try {
            const ref = new URL(document.referrer);
            outside = ref.origin === location.origin && !ref.pathname.includes('/pages/ring-builder');
          } catch (_) {}
          if (outside && history.length > 1) { history.back(); return; }
        }
        state.returnIndex = action === 'catalog' && state.screen === 'detail' ? state.detailIndex : null;
        go(action);
      }
      else if (action === 'reset') resetSearch();
      else if (action === 'retry') search();
      else if (action === 'next' || action === 'previous') { state.page += action === 'next' ? 1 : -1; reveal(main.querySelector('.toolbar')); if (state.kind === 'setting') settingResults(); else search(); persist(); }
      else if (action === 'dock-summary') reveal(aside);
      else if (action === 'share') share();
      else if (action === 'review-video') {
        const src = (state.setting.videos || []).map(safeURL).find(Boolean);
        if (src) main.querySelector('[data-review-media="setting"]').innerHTML = `<video controls playsinline autoplay muted preload="metadata" src="${esc(src)}"></video>`;
      }
      else if (action === 'dock-add' || action === 'review-add' || action === 'add') {
        const field = main.querySelector('[data-field="size"]');
        state.choicePrompt = true;
        if (!state.size && field) {
          const hint = main.querySelector('[data-size-hint]');
          if (hint) { hint.hidden = false; hint.className = 'error'; }
          notice(t('size_required'), true); reveal(field); field.focus({ preventScroll: true });
        }
        else if (!optionsReady()) { notice(t('metal_required'), true); const option = main.querySelector('[data-option].is-empty, [data-option]'); reveal(option); option?.focus({ preventScroll: true }); }
        else if (!pickedVariant()) { notice(t('size_unavailable'), true); const option = main.querySelector('[data-option]') || field; reveal(option); option?.focus({ preventScroll: true }); }
        else if (!bandsValid()) {
          const incomplete = chosenBands().find(b => !b.variant);
          state.bandSlot = incomplete.slot; state.bandsCollapsed = false; render();
          notice(t('band_options_required'), true);
          const option = main.querySelector('[data-band-option]'); reveal(option); option?.focus({ preventScroll: true });
        }
        else addRing();
      }
      else if (action.startsWith('photo-')) { state.photo = Number(action.slice(6)); detail(); }
      else if (action.startsWith('video-')) {
        const src = safeURL(state.detailVideos[Number(action.slice(6))]);
        if (src) main.querySelector('[data-media]').innerHTML = `<video controls playsinline preload="metadata" src="${esc(src)}"></video>`;
      }
      else if (action === 'restart') {
        main.dataset.initialStart = 'false';
        state.setting = null; state.diamond = null; state.bandSelections = [{ product: null, options: [] }, { product: null, options: [] }]; state.bandSlot = 0; state.bandsCollapsed = false; state.bandCategory = 'diamond'; state.showAllBands = false; state.bandMetal = ''; state.bandStyle = ''; state.entry = ''; state.size = ''; state.choicePrompt = false; state.options = []; state.engraving = ''; state.font = 'block'; state.date = ''; state.group = ''; state.editGroup = ''; state.filters.style = ''; state.page = 1; go('start');
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
      if (el.hasAttribute('data-band-filter')) { state[el.dataset.bandFilter === 'metal' ? 'bandMetal' : 'bandStyle'] = el.value; render(); main.querySelector('[data-band-filter="' + el.dataset.bandFilter + '"]')?.focus({ preventScroll: true }); return; }
      if (el.hasAttribute('data-band-product')) {
        await chooseBand(el.value);
        return;
      }
      if (el.hasAttribute('data-band-option')) { state.bandOptions[Number(el.dataset.bandOption)] = el.value; state.group = ''; render(); return; }
      if (el.closest('#DiamondFilterForm')) { readDiamondFilters(); paintDiamondFilters(); persist(); queueSearch(el.type === 'number' ? 700 : 250); return; }
      if (el.dataset.filter) {
        state.filters[el.dataset.filter] = el.value;
        if (state.kind === 'setting') {
          state.page = 1;
          if (el.dataset.filter === 'shape' || el.dataset.filter === 'style') {
            state.filters.metal = '';
            if (el.dataset.filter === 'shape') state.filters.style = '';
            state.filters.design = '';
            catalogShell();
            main.querySelector('[data-filter="' + el.dataset.filter + '"]')?.focus();
          }
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
      const hasSharedBuild = location.hash.startsWith('#build=');
      const shared = hasSharedBuild ? sharedBuild(params) : null;
      if (hasSharedBuild) stored = shared || {};
      const linked = params.has('setting') || params.has('diamond') || params.has('start');
      const settingHandle = linked ? params.get('setting') : stored.setting;
      const diamondHandle = linked ? params.get('diamond') : stored.diamond;
      const requestedShape = params.get('shape');
      const edit = hasSharedBuild ? '' : params.get('edit_group') || (!linked ? stored.editGroup : '');
      if (/^lmny-[a-z0-9-]+$/i.test(edit || '')) state.editGroup = edit;
      const sameSelection = (!params.has('setting') || params.get('setting') === stored.setting) && (!params.has('diamond') || params.get('diamond') === stored.diamond);
      const freshPath = (params.get('start') === 'setting' || params.get('start') === 'diamond') && !params.get('setting') && !params.get('diamond');
      const begin = params.get('start');
      if (begin === 'setting' || begin === 'diamond') state.entry = begin;
      else if (!freshPath && (stored.entry === 'setting' || stored.entry === 'diamond')) state.entry = stored.entry;
      if (sameSelection && !freshPath) {
        state.size = typeof stored.size === 'string' ? stored.size : '';
        state.options = Array.isArray(stored.options) ? stored.options : [];
        state.engraving = typeof stored.engraving === 'string' ? stored.engraving.slice(0, 20) : '';
        state.date = /^\d{4}-\d{2}-\d{2}$/.test(stored.date || '') ? stored.date : '';
        state.font = stored.font === 'script' ? 'script' : 'block';
        state.group = /^lmny-[a-z0-9-]+$/i.test(stored.group || '') ? stored.group : '';
        if (stored.filters && String(stored.filters.shape || '').split(',').every(shapeKnown)) state.filters = { ...state.filters, style: '', ...stored.filters };
      }
      for (const key of urlFilters) if (params.has(key)) state.filters[key] = params.get(key) || '';
      if (requestedShape && shapeKnown(requestedShape)) state.filters.shape = requestedShape;
      if (!settingHandle && !diamondHandle) {
        main.dataset.initialStart = 'true';
        root.dataset.diamondImage = main.querySelector('[data-action="start-diamond"] img')?.src || '';
        if (begin === 'diamond' || begin === 'setting') {
          state.kind = begin; state.entry = begin; state.page = 1;
          if (begin === 'setting' && !requestedShape) state.filters.shape = '';
          go('catalog');
        }
        ready = true;
        track('builder_opened');
        if (begin === 'diamond' || begin === 'setting') track('builder_path_selected', { product_kind: begin });
        return;
      }
      root.dataset.diamondImage = main.querySelector('[data-action="start-diamond"] img')?.src || '';
      notice(t('restoring'));
      state.busy = true; lockControls();
      let editLine = null, editBands = [];
      if (state.editGroup) {
        try {
          const lines = groupLines(await cart(), state.editGroup);
          editBands = lines.filter(line => line.properties?._lm_band_handle === line.handle).slice(0, 2);
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
      let failed = hasSharedBuild && !shared;
      if (settingHandle && state.editGroup) { try { const p = await product(settingHandle); if (editLine) state.options = p.variants.find(v => Number(v.id) === Number(editLine.variant_id || editLine.id))?.options?.slice() || []; setSetting(p, sameSelection || !!editLine); if (shared && (state.size !== shared.size || JSON.stringify(state.options) !== JSON.stringify(shared.options))) failed = true; } catch (_) { failed = true; state.setting = null; } }
      if (diamondHandle) { try { state.diamond = await diamond(diamondHandle); } catch (_) { failed = true; state.diamond = null; } }
      if (shared && both() && state.setting.shape !== state.diamond.shape) { state.diamond = null; failed = true; }
      const savedBands = Array.isArray(stored.bands) ? stored.bands.slice(0, 2) : stored.band ? [{ handle: stored.band, options: stored.bandOptions }] : [];
      const restoreBands = editBands.length ? editBands.map((line, index) => ({ handle: line.handle, slot: Number(line.properties?._lm_band_slot ?? index) === 1 ? 1 : 0, line })) : !state.editGroup && sameSelection ? savedBands.map((b, slot) => ({ ...b, slot })) : [];
      for (const saved of restoreBands.filter(b => b.handle)) {
        state.bandSlot = saved.slot;
        try {
          await selectBand(saved.handle, Array.isArray(saved.options) ? saved.options : []);
          if (saved.line) state.bandOptions = state.band.variants.find(v => Number(v.id) === Number(saved.line.variant_id || saved.line.id))?.options.slice() || [];
        } catch (_) { failed = true; state.band = null; state.bandOptions = []; state.group = ''; }
      }
      state.bandSlot = stored.bandSlot === 1 ? 1 : 0;
      state.bandCategory = cfg.bands.find(b => b.handle === state.band?.handle)?.category || 'diamond';
      state.busy = false;
      const step = params.get('step');
      if (state.setting && step !== 'diamond') state.filters.shape = state.setting.shape;
      if (state.diamond) state.filters.shape = state.diamond.shape;
      if (step === 'setting' && state.setting) { state.kind = 'setting'; go('catalog'); }
      else if (step === 'diamond') { state.kind = 'diamond'; go('catalog'); }
      else if (both()) go('review');
      else { state.kind = state.setting ? 'diamond' : state.diamond ? 'setting' : 'diamond'; go('catalog'); }
      notice(failed ? t('restore_failed') : '', failed);
      ready = true;
      afterRingEmail();
      track('builder_opened');
      if (both()) track('build_review_reached');
    }
    window.addEventListener('hashchange', () => { if (location.hash.startsWith('#build=')) location.reload(); });
    window.addEventListener('popstate', () => { location.reload(); });
    restore();
  }
  initialize();
  document.addEventListener('shopify:section:load', initialize);
})();

