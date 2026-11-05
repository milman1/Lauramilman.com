// Shopify Admin > Settings > Customer events > Custom pixel.
// Require Analytics permission; mark data sale as not qualifying.
// This file is NOT a theme asset. Install once in the pixel sandbox.
(() => {
  const measurementId = 'G-CTWW9B42MX'; // Verified Google app destination, 2026-10-30.
  let privacy = init.customerPrivacy;
  let started = false;
  const seen = new Set();
  const pageLocation = 'https://www.lauramilman.com/pages/ring-builder';
  const gtag = function () { window.dataLayer.push(arguments); };
  function consent() {
    return {
      analytics_storage: privacy?.analyticsProcessingAllowed === true ? 'granted' : 'denied',
      ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'
    };
  }
  api.customerPrivacy.subscribe('visitorConsentCollected', event => {
    privacy = event.customerPrivacy;
    if (started) gtag('consent', 'update', consent());
  });
  function start() {
    if (started) return;
    started = true;
    window.dataLayer = window.dataLayer || [];
    gtag('consent', 'default', consent());
    gtag('js', new Date());
    gtag('config', measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: pageLocation,
      page_referrer: '',
      page_title: 'Build your ring'
    });
    const script = document.createElement('script');
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    script.async = true;
    document.head.appendChild(script);
  }
  const values = {
    screen: ['start', 'catalog', 'detail', 'review', 'diamond_product'],
    purchase_mode: ['build_ring', 'diamond_only'],
    entry_point: ['main_cta', 'sticky_cta', 'setting_card', 'all_settings', 'add_to_cart', 'buy_now'],
    origin: ['lab', 'natural'],
    device_type: ['mobile', 'desktop'],
    product_kind: ['setting', 'diamond', 'band']
  };
  function forward(name, event) {
    if (privacy?.analyticsProcessingAllowed !== true || (event.id && seen.has(event.id))) return;
    const data = event.customData || {};
    const productEvent = ['lmny_diamond_purchase_viewed', 'lmny_purchase_mode_selected', 'lmny_ring_builder_started', 'lmny_diamond_added_to_cart'].includes(name);
    if (productEvent && data.screen !== 'diamond_product') return;
    const params = { send_to: measurementId, page_location: pageLocation, page_referrer: '' };
    if (data.screen === 'diamond_product') {
      if (!/^(lg|nd)-[a-z0-9-]{1,96}$/.test(data.product_handle || '')) return;
      params.page_location = 'https://www.lauramilman.com/products/' + data.product_handle;
      params.page_title = 'Diamond details';
    }
    // Allowlisted values only: never forward the event context, URL, customer,
    // engraving, requested date, email, or complete build payload.
    Object.entries(values).forEach(([key, allowed]) => {
      if (allowed.includes(data[key])) params[key] = data[key];
    });
    if (Number.isInteger(data.band_count) && data.band_count >= 0 && data.band_count <= 2) params.band_count = data.band_count;
    start();
    gtag('event', name, params);
    if (event.id) {
      seen.add(event.id);
      if (seen.size > 200) seen.delete(seen.values().next().value);
    }
  }
  // Literal subscriptions let Shopify discover the events when saving the pixel.
  analytics.subscribe('lmny_builder_opened', event => forward('lmny_builder_opened', event));
  analytics.subscribe('lmny_product_viewed', event => forward('lmny_product_viewed', event));
  analytics.subscribe('lmny_setting_selected', event => forward('lmny_setting_selected', event));
  analytics.subscribe('lmny_diamond_selected', event => forward('lmny_diamond_selected', event));
  analytics.subscribe('lmny_build_saved', event => forward('lmny_build_saved', event));
  analytics.subscribe('lmny_build_shared', event => forward('lmny_build_shared', event));
  analytics.subscribe('lmny_band_selected', event => forward('lmny_band_selected', event));
  analytics.subscribe('lmny_build_added_to_cart', event => forward('lmny_build_added_to_cart', event));
  analytics.subscribe('lmny_diamond_purchase_viewed', event => forward('lmny_diamond_purchase_viewed', event));
  analytics.subscribe('lmny_purchase_mode_selected', event => forward('lmny_purchase_mode_selected', event));
  analytics.subscribe('lmny_ring_builder_started', event => forward('lmny_ring_builder_started', event));
  analytics.subscribe('lmny_diamond_added_to_cart', event => forward('lmny_diamond_added_to_cart', event));
  // Observe Shopify's page event, but emit only the custom landing event.
  // The Google app remains the sole owner of standard page_view events.
  analytics.subscribe('page_viewed', event => {
    if (privacy?.analyticsProcessingAllowed !== true || (event.id && seen.has(event.id))) return;
    let url;
    try { url = new URL(event.context?.document?.location?.href); } catch { return; }
    if (!['www.lauramilman.com', 'lauramilman.com'].includes(url.hostname) || url.protocol !== 'https:') return;
    const handle = url.searchParams.get('lmny_redirect');
    if (!/^(lg|nd)-[a-z0-9-]{1,96}$/.test(handle || '') || !/^\/collections\/[a-z0-9-]+$/.test(url.pathname)) return;
    let referrer = '';
    try {
      const ref = new URL(event.context?.document?.referrer);
      if (['https:', 'http:'].includes(ref.protocol)) referrer = ref.origin + '/';
    } catch { /* Direct or unavailable referral. */ }
    start();
    gtag('event', 'lmny_diamond_redirect_landing', {
      send_to: measurementId,
      page_location: 'https://www.lauramilman.com' + url.pathname,
      page_title: 'Diamond alternatives',
      page_referrer: referrer,
      original_diamond: handle,
      redirect_collection: url.pathname.slice('/collections/'.length),
      origin: handle.startsWith('nd-') ? 'natural' : handle.startsWith('lg-color-') ? 'colored_lab' : 'lab'
    });
    if (event.id) {
      seen.add(event.id);
      if (seen.size > 200) seen.delete(seen.values().next().value);
    }
  });
})();
