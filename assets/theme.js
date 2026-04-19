/* ============================================================
   Laura Milman Theme — Main JavaScript
   ============================================================ */

'use strict';

/* === Navbar scroll effect === */
(function () {
  const header = document.querySelector('.site-header');
  if (!header) return;

  function onScroll() {
    header.classList.toggle('scrolled', window.scrollY > 60);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* === Mobile nav toggle === */
(function () {
  const toggle = document.querySelector('.mobile-menu-toggle');
  const nav = document.querySelector('.mobile-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', function () {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });

  // Close on link click
  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();

/* === Hero entrance animation === */
(function () {
  const heroContent = document.querySelectorAll(
    '.hero__content, .hero__editorial-left, .hero__image-wrap, .hero__editorial-right, .hero__big-type, .hero__center-box'
  );
  if (!heroContent.length) return;

  setTimeout(function () {
    heroContent.forEach(function (el) {
      el.classList.add('loaded');
    });
  }, 100);
})();

/* === Testimonials carousel === */
(function () {
  const section = document.querySelector('.testimonials');
  if (!section) return;

  const quotes = section.querySelectorAll('[data-quote]');
  const authors = section.querySelectorAll('[data-author]');
  const dots = section.querySelectorAll('.testimonials__dot');
  if (!quotes.length) return;

  let current = 0;
  let timer;

  function goTo(index) {
    quotes[current].style.opacity = '0';
    setTimeout(function () {
      quotes.forEach(function (q) { q.style.display = 'none'; });
      authors.forEach(function (a) { a.style.display = 'none'; });
      dots.forEach(function (d) { d.classList.remove('active'); });

      current = index;
      quotes[current].style.display = '';
      quotes[current].style.opacity = '0';
      authors[current].style.display = '';
      dots[current].classList.add('active');

      requestAnimationFrame(function () {
        quotes[current].style.transition = 'opacity 0.4s';
        quotes[current].style.opacity = '1';
      });
    }, 200);
  }

  // Hide all except first
  quotes.forEach(function (q, i) {
    if (i !== 0) q.style.display = 'none';
  });
  authors.forEach(function (a, i) {
    if (i !== 0) a.style.display = 'none';
  });
  if (dots[0]) dots[0].classList.add('active');

  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () {
      clearInterval(timer);
      goTo(i);
      startTimer();
    });
  });

  function startTimer() {
    timer = setInterval(function () {
      goTo((current + 1) % quotes.length);
    }, 5000);
  }
  startTimer();
})();

/* === Product gallery thumbnails === */
(function () {
  const gallery = document.querySelector('.product-gallery');
  if (!gallery) return;

  const mainImg = gallery.querySelector('.product-gallery__main img');
  const thumbs = gallery.querySelectorAll('.product-gallery__thumb');

  thumbs.forEach(function (thumb, i) {
    thumb.addEventListener('click', function () {
      thumbs.forEach(function (t) { t.classList.remove('active'); });
      thumb.classList.add('active');

      const src = thumb.dataset.src;
      if (mainImg && src) {
        mainImg.style.opacity = '0';
        mainImg.style.transition = 'opacity 0.25s';
        setTimeout(function () {
          mainImg.src = src;
          mainImg.style.opacity = '1';
        }, 200);
      }
    });
  });
})();

/* === Product options (size / metal / variant selection) === */
(function () {
  const form = document.querySelector('form[data-product-form]');
  if (!form) return;

  // Generic option button toggling
  const optionGroups = form.querySelectorAll('[data-option-group]');

  optionGroups.forEach(function (group) {
    const buttons = group.querySelectorAll('.product-option-btn');
    const hiddenInput = group.querySelector('input[type="hidden"]');

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        if (hiddenInput) hiddenInput.value = btn.dataset.value;
        updateVariant(form);
      });
    });
  });
})();

/* === Variant selection === */
function updateVariant(form) {
  if (!form) return;

  const variantSelect = form.querySelector('[name="id"]');
  if (!variantSelect) return;

  const selectedOptions = [];
  form.querySelectorAll('[data-option-group]').forEach(function (group) {
    const active = group.querySelector('.product-option-btn.active');
    if (active) selectedOptions.push(active.dataset.value);
  });

  const variantOptions = variantSelect.querySelectorAll('option');
  let matchedVariant = null;

  variantOptions.forEach(function (option) {
    if (!option.dataset.options) return;
    const opts = JSON.parse(option.dataset.options);
    const matches = selectedOptions.every(function (sel, i) { return opts[i] === sel; });
    if (matches) matchedVariant = option;
  });

  if (matchedVariant) {
    variantSelect.value = matchedVariant.value;
    const available = matchedVariant.dataset.available === 'true';
    const atcBtn = form.querySelector('.atc-btn');
    if (atcBtn) {
      atcBtn.disabled = !available;
      atcBtn.textContent = available ? 'Add to Cart' : 'Sold Out';
    }

    // Update price
    const price = matchedVariant.dataset.price;
    const comparePrice = matchedVariant.dataset.comparePrice;
    const priceEl = document.querySelector('.product-price');
    const compareEl = document.querySelector('.product-price--compare');
    const saveEl = document.querySelector('.product-price--save');

    if (priceEl && price) {
      priceEl.textContent = formatMoney(parseInt(price, 10));
    }
    if (compareEl && comparePrice && parseInt(comparePrice, 10) > parseInt(price, 10)) {
      compareEl.textContent = formatMoney(parseInt(comparePrice, 10));
      compareEl.style.display = '';
      if (saveEl) {
        const saved = parseInt(comparePrice, 10) - parseInt(price, 10);
        saveEl.textContent = 'Save ' + formatMoney(saved);
        saveEl.style.display = '';
      }
    } else {
      if (compareEl) compareEl.style.display = 'none';
      if (saveEl) saveEl.style.display = 'none';
    }
  }
}

function formatMoney(cents) {
  return '$' + (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

/* === Quantity selector === */
(function () {
  document.querySelectorAll('.quantity-selector').forEach(function (selector) {
    const display = selector.querySelector('.qty-display');
    const minusBtn = selector.querySelector('.qty-btn[data-action="minus"]');
    const plusBtn = selector.querySelector('.qty-btn[data-action="plus"]');
    const hiddenInput = selector.nextElementSibling && selector.nextElementSibling.name === 'quantity'
      ? selector.nextElementSibling
      : selector.closest('form') && selector.closest('form').querySelector('[name="quantity"]');

    let qty = parseInt(display ? display.textContent : '1', 10) || 1;

    function updateDisplay() {
      if (display) display.textContent = qty;
      if (hiddenInput) hiddenInput.value = qty;
      if (minusBtn) minusBtn.disabled = qty <= 1;
    }

    if (minusBtn) {
      minusBtn.addEventListener('click', function () {
        if (qty > 1) { qty--; updateDisplay(); }
      });
    }
    if (plusBtn) {
      plusBtn.addEventListener('click', function () {
        qty++;
        updateDisplay();
      });
    }

    updateDisplay();
  });
})();

/* === Add to Cart (Shopify AJAX API) === */
(function () {
  const form = document.querySelector('form[data-product-form]');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const atcBtn = form.querySelector('.atc-btn');
    if (!atcBtn || atcBtn.disabled) return;

    const variantSelect = form.querySelector('[name="id"]');
    const quantityInput = form.querySelector('[name="quantity"]');
    const variantId = variantSelect ? variantSelect.value : null;
    const quantity = quantityInput ? parseInt(quantityInput.value, 10) : 1;

    if (!variantId) return;

    atcBtn.disabled = true;
    const originalText = atcBtn.textContent;
    atcBtn.textContent = '...';

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: parseInt(variantId, 10), quantity: quantity })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.status) {
          // Error
          atcBtn.textContent = 'Error — try again';
          atcBtn.disabled = false;
          return;
        }
        atcBtn.classList.add('added');
        atcBtn.textContent = '✓ Added to Cart';
        showCartNotification();
        updateCartCount();

        setTimeout(function () {
          atcBtn.classList.remove('added');
          atcBtn.textContent = originalText;
          atcBtn.disabled = false;
        }, 2500);
      })
      .catch(function () {
        atcBtn.textContent = originalText;
        atcBtn.disabled = false;
      });
  });
})();

function showCartNotification() {
  const note = document.getElementById('cart-notification');
  if (!note) return;
  note.hidden = false;
  note.classList.add('show');
  setTimeout(function () {
    note.classList.remove('show');
    setTimeout(function () { note.hidden = true; }, 300);
  }, 2500);
}

function updateCartCount() {
  fetch('/cart.js', { headers: { 'Accept': 'application/json' } })
    .then(function (res) { return res.json(); })
    .then(function (cart) {
      const countEl = document.querySelector('.cart-count');
      if (countEl) {
        countEl.textContent = cart.item_count;
        countEl.dataset.count = cart.item_count;
      }
    })
    .catch(function () {});
}

/* === Accordion === */
(function () {
  document.querySelectorAll('.accordion-trigger').forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      const item = trigger.closest('.accordion-item');
      if (!item) return;

      const isOpen = item.classList.contains('open');

      // Close siblings (optional: comment out for independent accordions)
      const siblings = item.parentElement ? item.parentElement.querySelectorAll('.accordion-item') : [];
      siblings.forEach(function (sib) { sib.classList.remove('open'); });

      if (!isOpen) item.classList.add('open');
    });
  });

  // Open first accordion by default
  const firstAccordion = document.querySelector('.accordion-item[data-open]');
  if (firstAccordion) firstAccordion.classList.add('open');
})();

/* === Chat Widget === */
(function () {
  const trigger = document.querySelector('.chat-trigger');
  const panel = document.querySelector('.chat-panel');
  const closeBtn = panel && panel.querySelector('.chat-panel__close');
  const input = panel && panel.querySelector('.chat-input');
  const sendBtn = panel && panel.querySelector('.chat-send-btn');
  const body = panel && panel.querySelector('.chat-panel__body');

  if (!trigger || !panel) return;

  trigger.addEventListener('click', function () {
    panel.classList.toggle('open');
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      panel.classList.remove('open');
    });
  }

  function sendMessage() {
    if (!input || !input.value.trim()) return;

    appendMessage(input.value.trim(), true);
    input.value = '';

    setTimeout(function () {
      appendMessage("Thank you for your message. A member of our team will be with you shortly.", false);
    }, 1000);
  }

  function appendMessage(text, isUser) {
    if (!body) return;
    const msg = document.createElement('div');
    msg.className = 'chat-msg ' + (isUser ? 'chat-msg--user' : 'chat-msg--bot');
    msg.textContent = text;
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  if (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendMessage();
    });
  }
})();

/* === Newsletter form === */
(function () {
  const forms = document.querySelectorAll('[data-newsletter-form]');
  forms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const emailInput = form.querySelector('[type="email"]');
      const successMsg = form.querySelector('[data-success]');
      if (!emailInput || !emailInput.value) return;

      // Shopify newsletter forms use /contact#contact_form action
      const formData = new FormData(form);
      fetch(form.action, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }
      }).then(function () {
        if (successMsg) {
          successMsg.hidden = false;
          emailInput.style.display = 'none';
        }
      }).catch(function () {});
    });
  });
})();

/* === Initialise === */
updateCartCount();
