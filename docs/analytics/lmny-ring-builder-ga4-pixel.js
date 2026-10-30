// Shopify Admin > Settings > Customer events > Custom pixel.
// Require Analytics permission; mark data sale as not qualifying.
// This file is NOT a theme asset. Install once in the pixel sandbox.
(() => {
  const measurementId = 'G-CTWW9B42MX'; // Verified Google app destination, 2026-10-30.
  const eventNames = [
    'lmny_builder_opened', 'lmny_product_viewed', 'lmny_setting_selected',
    'lmny_diamond_selected', 'lmny_build_saved', 'lmny_build_shared',
    'lmny_band_selected', 'lmny_build_added_to_cart'
  ];
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
    screen: ['start', 'catalog', 'detail', 'review'],
    origin: ['lab', 'natural'],
    device_type: ['mobile', 'desktop'],
    product_kind: ['setting', 'diamond', 'band']
  };
  eventNames.forEach(name => analytics.subscribe(name, event => {
    if (privacy?.analyticsProcessingAllowed !== true || (event.id && seen.has(event.id))) return;
    const data = event.customData || {};
    const params = { send_to: measurementId, page_location: pageLocation, page_referrer: '' };
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
  }));
})();
