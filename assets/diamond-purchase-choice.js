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
      function selectMode() {
        var ring = choice && choice.querySelector('input:checked').value === 'ring';
        if (build) build.hidden = !ring;
        buy.hidden = !!ring;
        if (settings) settings.hidden = !ring;
        if (dockBuild) dockBuild.hidden = !ring;
        if (dockBuy) dockBuy.hidden = !!ring;
      }
      if (choice) {
        choice.hidden = false;
        choice.addEventListener('change', selectMode);
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
