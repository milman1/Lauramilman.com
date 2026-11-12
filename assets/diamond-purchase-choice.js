(function () {
  function initialize() {
    document.querySelectorAll('[data-diamond-purchase]').forEach(function (root) {
      if (root.dataset.purchaseReady) return;
      root.dataset.purchaseReady = 'true';
      var choice = root.querySelector('[data-diamond-choice]');
      var build = root.querySelector('[data-diamond-build]');
      var buy = root.querySelector('[data-diamond-buy]');
      var settings = root.querySelector('[data-diamond-settings]');
      var dock = root.querySelector('[data-diamond-dock]');
      var dockBuild = root.querySelector('[data-diamond-dock-build]');
      var dockBuy = root.querySelector('[data-diamond-dock-buy]');
      var add = buy.querySelector('.atc-btn');
      var viewSent = false;
      function mode() {
        return choice && choice.querySelector('input:checked')?.value === 'ring' ? 'build_ring' : 'diamond_only';
      }
      function track(name, extra) {
        var shopify = window.Shopify;
        if (!root.isConnected || shopify?.customerPrivacy?.analyticsProcessingAllowed?.() !== true || typeof window.LMNYGa4?.track !== 'function') return Promise.resolve(false);
        var handle = root.dataset.diamondHandle;
        if (!/^(lg|nd)-[a-z0-9-]{1,96}$/.test(handle || '')) return Promise.resolve(false);
        var data = Object.assign({ screen: 'diamond_product', product_kind: 'diamond', product_handle: handle, origin: root.dataset.diamondOrigin, purchase_mode: mode(), device_type: window.matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop' }, extra);
        try { return window.LMNYGa4.track(name, data).then(function (result) { return result !== false; }, function () { return false; }); }
        catch (_) { return Promise.resolve(false); }
      }
      function trackView() {
        if (viewSent || window.Shopify?.customerPrivacy?.analyticsProcessingAllowed?.() !== true) return;
        viewSent = true;
        track('diamond_purchase_viewed').then(function (sent) { if (!sent) viewSent = false; });
      }
      document.addEventListener('visitorConsentCollected', trackView);
      if (window.Shopify?.customerPrivacy) trackView();
      else if (window.Shopify?.loadFeatures) {
        try { window.Shopify.loadFeatures([{ name: 'consent-tracking-api', version: '0.2' }], trackView); } catch (_) {}
      }
      root.addEventListener('click', function (event) {
        var link = event.target.closest('a');
        if (!link || event.defaultPrevented || event.button !== 0) return;
        var entry = link.matches('[data-diamond-dock-build]') ? 'sticky_cta' : link.matches('[data-diamond-build] a') ? 'main_cta' : link.matches('.dsp__link') ? 'setting_card' : link.matches('.dsp__all') ? 'all_settings' : '';
        if (!entry) return;
        track('ring_builder_started', { purchase_mode: 'build_ring', entry_point: entry });
        if (entry === 'setting_card') track('setting_selected', { purchase_mode: 'build_ring', entry_point: entry, product_kind: 'setting' });
      });
      add?.form?.addEventListener('lm:product-added-to-cart', function (event) {
        track('diamond_added_to_cart', { purchase_mode: 'diamond_only', entry_point: event.detail?.checkout === true ? 'buy_now' : 'add_to_cart' });
      });
      function selectMode() {
        var ring = choice && choice.querySelector('input:checked')?.value === 'ring';
        if (build) build.hidden = !ring;
        buy.hidden = !!ring;
        if (settings) settings.hidden = !ring;
        if (dockBuild) dockBuild.hidden = !ring;
        if (dockBuy) dockBuy.hidden = !!ring;
      }
      if (choice) {
        choice.hidden = false;
        choice.addEventListener('change', function () { selectMode(); track('purchase_mode_selected'); });
        root.classList.add('dpdp--choice-ready');
      }
      selectMode();
      if (!dock) return;
      dockBuy.addEventListener('click', function () {
        if (add && !add.disabled) add.form.requestSubmit(add);
      });
      if (add) {
        var syncBuy = function () {
          dockBuy.disabled = add.disabled;
          dockBuy.textContent = add.textContent;
        };
        syncBuy();
        new MutationObserver(syncBuy).observe(add, { attributes: true, attributeFilter: ['disabled'], childList: true, subtree: true, characterData: true });
      }
      if (!('IntersectionObserver' in window)) return;
      var pastActions = false;
      var onPage = true;
      var mobile = window.matchMedia('(max-width: 600px)');
      function showDock() {
        var show = mobile.matches && pastActions && onPage;
        dock.hidden = !show;
        document.body.classList.toggle('has-diamond-dock', show);
      }
      new IntersectionObserver(function (entries) {
        pastActions = !entries[0].isIntersecting && entries[0].boundingClientRect.top < 0;
        showDock();
      }).observe(root.querySelector('[data-diamond-actions]'));
      new IntersectionObserver(function (entries) {
        onPage = entries[0].isIntersecting;
        showDock();
      }).observe(root);
      mobile.addEventListener('change', showDock);
    });
  }
  initialize();
  document.addEventListener('shopify:section:load', initialize);
})();
