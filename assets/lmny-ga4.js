(function () {
  'use strict';
  if (window.LMNYGa4) return;
  const destination = 'G-CTWW9B42MX';
  const events = new Set(['builder_opened', 'product_viewed', 'setting_selected', 'diamond_selected', 'build_saved', 'build_shared', 'band_selected', 'build_added_to_cart', 'diamond_purchase_viewed', 'purchase_mode_selected', 'ring_builder_started', 'diamond_added_to_cart']);
  const values = {
    screen: ['start', 'catalog', 'detail', 'review', 'diamond_product'],
    purchase_mode: ['build_ring', 'diamond_only'],
    entry_point: ['main_cta', 'sticky_cta', 'setting_card', 'all_settings', 'add_to_cart', 'buy_now'],
    origin: ['lab', 'natural'], device_type: ['mobile', 'desktop'],
    product_kind: ['setting', 'diamond', 'band']
  };
  const allowed = () => window.Shopify?.customerPrivacy?.analyticsProcessingAllowed?.() === true;
  let generation = 0;
  document.addEventListener('visitorConsentCollected', () => { generation++; });
  // Use the existing Google app tag. Never initialize/configure another tag,
  // generate an identity, parse GA cookies, or emit standard ecommerce events.
  function send(name, params) {
    if (!allowed()) return Promise.resolve(false);
    const epoch = generation;
    return new Promise(resolve => {
      let attempts = 0;
      let finished = false;
      const timeout = setTimeout(() => finish(false), 2000);
      function finish(sent) { if (!finished) { finished = true; clearTimeout(timeout); resolve(sent); } }
      function attempt() {
        if (finished) return;
        if (!allowed() || generation !== epoch) return finish(false);
        if (typeof window.gtag !== 'function') {
          if (++attempts >= 20) return finish(false);
          setTimeout(attempt, 100); return;
        }
        try {
          // The get callback runs only once the existing destination is ready.
          // Recheck consent there so a delayed tag cannot replay revoked events.
          window.gtag('get', destination, 'client_id', clientId => {
            if (finished) return;
            if (!clientId || !allowed() || generation !== epoch) return finish(false);
            try {
              window.gtag('event', name, { ...params, send_to: destination,
                allow_google_signals: false, allow_ad_personalization_signals: false });
              finish(true);
            } catch (_) { finish(false); }
          });
        } catch (_) { finish(false); }
      }
      attempt();
    });
  }
  function track(name, data = {}) {
    if (!events.has(name) || !allowed()) return Promise.resolve(false);
    const productEvent = ['diamond_purchase_viewed', 'purchase_mode_selected', 'ring_builder_started', 'diamond_added_to_cart'].includes(name);
    if (productEvent && data.screen !== 'diamond_product') return Promise.resolve(false);
    const params = { page_location: 'https://www.lauramilman.com/pages/ring-builder', page_referrer: '', page_title: 'Build your ring' };
    if (data.screen === 'diamond_product') {
      if (!/^(lg|nd)-[a-z0-9-]{1,96}$/.test(data.product_handle || '')) return Promise.resolve(false);
      params.page_location = 'https://www.lauramilman.com/products/' + data.product_handle;
      params.page_title = 'Diamond details';
    }
    Object.entries(values).forEach(([key, choices]) => { if (choices.includes(data[key])) params[key] = data[key]; });
    if (Number.isInteger(data.band_count) && data.band_count >= 0 && data.band_count <= 2) params.band_count = data.band_count;
    return send('lmny_' + name, params);
  }
  window.LMNYGa4 = { track };
  let redirectSent = false;
  function redirect() {
    if (redirectSent || !allowed()) return;
    const url = new URL(window.location.href);
    const handle = url.searchParams.get('lmny_redirect');
    if (!['www.lauramilman.com', 'lauramilman.com'].includes(url.hostname) || url.protocol !== 'https:') return;
    if (!/^(lg|nd)-[a-z0-9-]{1,96}$/.test(handle || '') || !/^\/collections\/[a-z0-9-]+$/.test(url.pathname)) return;
    let referrer = '';
    try { const ref = new URL(document.referrer); if (['https:', 'http:'].includes(ref.protocol)) referrer = ref.origin + '/'; } catch (_) {}
    redirectSent = true;
    send('lmny_diamond_redirect_landing', {
      page_location: 'https://www.lauramilman.com' + url.pathname,
      page_title: 'Diamond alternatives', page_referrer: referrer,
      original_diamond: handle, redirect_collection: url.pathname.slice('/collections/'.length),
      origin: handle.startsWith('nd-') ? 'natural' : handle.startsWith('lg-color-') ? 'colored_lab' : 'lab'
    }).then(sent => { if (!sent) redirectSent = false; });
  }
  document.addEventListener('visitorConsentCollected', redirect);
  if (window.Shopify?.customerPrivacy) redirect();
  else if (window.Shopify?.loadFeatures) {
    try { window.Shopify.loadFeatures([{ name: 'consent-tracking-api', version: '0.2' }], redirect); } catch (_) {}
  }
})();
