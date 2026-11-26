(function () {
  function boot() {
    document.querySelectorAll('[data-holiday-carousel]').forEach(function (root) {
      if (root.dataset.holidayReady === 'true') return;
      root.dataset.holidayReady = 'true';
      init(root);
    });
  }

  function init(root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll('[data-holiday-slide]'));
    if (slides.length < 2) return;

    var dots = Array.prototype.slice.call(root.querySelectorAll('[data-holiday-dot]'));
    var prev = root.querySelector('[data-holiday-prev]');
    var next = root.querySelector('[data-holiday-next]');
    var pauseBtn = root.querySelector('[data-holiday-pause]');
    var pauseLabel = root.querySelector('[data-holiday-pause-label]');
    var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var narrow = window.matchMedia('(max-width: 749px)');
    var index = Math.max(0, slides.findIndex(function (slide) { return slide.classList.contains('is-active'); }));
    var token = 0;
    var timer = 0;
    var hovering = false;
    var focused = false;
    var manualPause = false;
    var interval = parseInt(root.getAttribute('data-interval'), 10);
    if (!interval || interval < 2000) interval = 6000;
    var autoplay = root.getAttribute('data-autoplay') === 'true' && !motion.matches;

    function desiredSrc(img) {
      if (!img) return '';
      if (narrow.matches && img.getAttribute('data-src-mobile')) return img.getAttribute('data-src-mobile');
      return img.getAttribute('data-src') || '';
    }

    function load(slide) {
      return new Promise(function (resolve) {
        var img = slide.querySelector('img');
        if (!img || img.getAttribute('data-managed') === 'picture') {
          resolve();
          return;
        }
        var src = desiredSrc(img);
        if (!src || img.getAttribute('src') === src) {
          resolve();
          return;
        }
        var done = function () { resolve(); };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        img.setAttribute('src', src);
        if (img.complete) done();
      });
    }

    function paint(i) {
      slides.forEach(function (slide, n) {
        var on = n === i;
        slide.classList.toggle('is-active', on);
        slide.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (on) slide.removeAttribute('inert');
        else slide.setAttribute('inert', '');
      });
      dots.forEach(function (dot, n) {
        var on = n === i;
        dot.classList.toggle('is-active', on);
        if (on) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    }

    function go(n) {
      var nextIndex = (n + slides.length) % slides.length;
      if (nextIndex === index) return;
      var my = ++token;
      load(slides[nextIndex]).then(function () {
        if (my !== token) return;
        index = nextIndex;
        paint(index);
        load(slides[(index + 1) % slides.length]);
      });
    }

    function stop() {
      if (timer) window.clearInterval(timer);
      timer = 0;
    }

    function start() {
      stop();
      if (!autoplay || manualPause || hovering || focused || motion.matches || document.hidden) return;
      timer = window.setInterval(function () { go(index + 1); }, interval);
    }

    function setPaused(paused) {
      manualPause = paused;
      root.classList.toggle('is-paused', paused || motion.matches);
      if (pauseBtn) pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
      if (pauseLabel) pauseLabel.textContent = paused ? 'Play slides' : 'Pause slides';
      if (paused) stop();
      else start();
    }

    if (prev) prev.addEventListener('click', function () { go(index - 1); start(); });
    if (next) next.addEventListener('click', function () { go(index + 1); start(); });
    dots.forEach(function (dot, n) {
      dot.addEventListener('click', function () { go(n); start(); });
    });
    if (pauseBtn) {
      pauseBtn.addEventListener('click', function () {
        setPaused(pauseBtn.getAttribute('aria-pressed') !== 'true');
      });
    }

    root.addEventListener('mouseenter', function () { hovering = true; stop(); });
    root.addEventListener('mouseleave', function () { hovering = false; start(); });
    root.addEventListener('focusin', function () { focused = true; stop(); });
    root.addEventListener('focusout', function (event) {
      if (!root.contains(event.relatedTarget)) {
        focused = false;
        start();
      }
    });
    root.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        go(index + 1);
        start();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        go(index - 1);
        start();
      }
    });

    var pointer = null;
    root.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.target.closest('a, button')) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      if (typeof root.setPointerCapture === 'function') {
        try { root.setPointerCapture(event.pointerId); } catch (err) { /* already released */ }
      }
    });
    root.addEventListener('pointerup', function (event) {
      if (!pointer || pointer.id !== event.pointerId) return;
      var dx = event.clientX - pointer.x;
      var dy = event.clientY - pointer.y;
      pointer = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      go(dx < 0 ? index + 1 : index - 1);
      start();
    });
    root.addEventListener('pointercancel', function () { pointer = null; });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else start();
    });

    if (typeof narrow.addEventListener === 'function') {
      narrow.addEventListener('change', function () {
        load(slides[index]);
        load(slides[(index + 1) % slides.length]);
      });
    }

    if (typeof motion.addEventListener === 'function') {
      motion.addEventListener('change', function () {
        autoplay = root.getAttribute('data-autoplay') === 'true' && !motion.matches;
        if (motion.matches) {
          stop();
          root.classList.add('is-paused');
        } else {
          root.classList.toggle('is-paused', manualPause);
          start();
        }
      });
    }

    if (motion.matches) root.classList.add('is-paused');
    load(slides[(index + 1) % slides.length]);
    start();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
