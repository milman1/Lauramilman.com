(function () {
  'use strict';

  // Mobile menu
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', open);
    });
  }

  // Quantity steppers
  document.querySelectorAll('[data-quantity]').forEach((wrap) => {
    const input = wrap.querySelector('input[type="number"]');
    wrap.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = btn.dataset.step === 'up' ? 1 : -1;
        const next = Math.max(1, (parseInt(input.value, 10) || 1) + step);
        input.value = next;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  });

  // Product media gallery
  document.querySelectorAll('[data-product-gallery]').forEach((gallery) => {
    const main = gallery.querySelector('[data-gallery-main] img');
    gallery.querySelectorAll('[data-gallery-thumb]').forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const src = thumb.dataset.src;
        const alt = thumb.dataset.alt || '';
        if (main && src) {
          main.src = src;
          main.alt = alt;
        }
        gallery.querySelectorAll('[data-gallery-thumb]').forEach((t) => t.classList.remove('is-active'));
        thumb.classList.add('is-active');
      });
    });
  });

  // Intersection fade-in
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('[data-animate]').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('[data-animate]').forEach((el) => el.classList.add('is-visible'));
  }
})();
