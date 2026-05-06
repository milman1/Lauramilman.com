'use strict';

/* === Cart Notification === */
function showCartNotification() {
  var note = document.getElementById('cart-notification');
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
      document.querySelectorAll('.cart-count').forEach(function (el) {
        el.textContent = cart.item_count;
        el.dataset.count = cart.item_count;
      });
    })
    .catch(function () {});
}

/* === Add to Cart (AJAX) === */
(function () {
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[data-product-form]');
    if (!form) return;
    e.preventDefault();

    var atcBtn = form.querySelector('.atc-btn');
    if (!atcBtn || atcBtn.disabled) return;

    var variantSelect = form.querySelector('[name="id"]');
    var quantityInput = form.querySelector('[name="quantity"]');
    var variantId = variantSelect ? variantSelect.value : null;
    var quantity = quantityInput ? parseInt(quantityInput.value, 10) : 1;

    if (!variantId) return;

    atcBtn.disabled = true;
    var originalText = atcBtn.textContent;
    atcBtn.textContent = '…';

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: parseInt(variantId, 10), quantity: quantity })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.status) {
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

/* === Variant Selector === */
(function () {
  var form = document.querySelector('form[data-product-form]');
  if (!form) return;

  var optionGroups = form.querySelectorAll('[data-option-group]');

  optionGroups.forEach(function (group) {
    var buttons = group.querySelectorAll('.product-option-btn');
    var hiddenInput = group.querySelector('input[type="hidden"]');

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        if (hiddenInput) hiddenInput.value = btn.dataset.value;
        updateVariant(form);
      });
    });
  });

  function updateVariant(f) {
    var variantSelect = f.querySelector('[name="id"]');
    if (!variantSelect) return;

    var selectedOptions = [];
    f.querySelectorAll('[data-option-group]').forEach(function (g) {
      var active = g.querySelector('.product-option-btn.active');
      if (active) selectedOptions.push(active.dataset.value);
    });

    var variantOptions = variantSelect.querySelectorAll('option');
    var matchedVariant = null;

    variantOptions.forEach(function (option) {
      if (!option.dataset.options) return;
      var opts = JSON.parse(option.dataset.options);
      var matches = selectedOptions.every(function (sel, i) { return opts[i] === sel; });
      if (matches) matchedVariant = option;
    });

    if (matchedVariant) {
      variantSelect.value = matchedVariant.value;
      var available = matchedVariant.dataset.available === 'true';
      var atcBtn = f.querySelector('.atc-btn');
      if (atcBtn) {
        atcBtn.disabled = !available;
        atcBtn.textContent = available ? 'Add to Cart' : 'Sold Out';
      }

      var price = matchedVariant.dataset.price;
      var comparePrice = matchedVariant.dataset.comparePrice;
      var priceEl = document.querySelector('.product-price');
      var compareEl = document.querySelector('.product-price--compare');

      if (priceEl && price) {
        priceEl.textContent = formatMoney(parseInt(price, 10));
      }
      if (compareEl) {
        if (comparePrice && parseInt(comparePrice, 10) > parseInt(price, 10)) {
          compareEl.textContent = formatMoney(parseInt(comparePrice, 10));
          compareEl.style.display = '';
        } else {
          compareEl.style.display = 'none';
        }
      }

      var newImage = matchedVariant.dataset.image;
      if (newImage) {
        var mainImg = document.querySelector('.product-gallery__main img');
        if (mainImg) {
          mainImg.style.opacity = '0';
          setTimeout(function () {
            mainImg.src = newImage;
            mainImg.style.opacity = '1';
          }, 200);
        }
      }
    }
  }
})();

function formatMoney(cents) {
  return '$' + (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

/* === Product Image Gallery === */
(function () {
  var gallery = document.querySelector('.product-gallery');
  if (!gallery) return;

  var mainImg = gallery.querySelector('.product-gallery__main img');
  var thumbs = gallery.querySelectorAll('.product-gallery__thumb');

  thumbs.forEach(function (thumb) {
    thumb.addEventListener('click', function () {
      thumbs.forEach(function (t) { t.classList.remove('active'); });
      thumb.classList.add('active');

      var src = thumb.dataset.src;
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

/* === Accordion Toggle === */
(function () {
  document.querySelectorAll('.accordion-trigger').forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      var item = trigger.closest('.accordion-item');
      if (!item) return;

      var isOpen = item.classList.contains('open');
      var siblings = item.parentElement ? item.parentElement.querySelectorAll('.accordion-item') : [];
      siblings.forEach(function (sib) { sib.classList.remove('open'); });

      if (!isOpen) item.classList.add('open');
    });
  });

  var firstAccordion = document.querySelector('.accordion-item[data-open]');
  if (firstAccordion) firstAccordion.classList.add('open');
})();

/* === Mobile Nav Toggle === */
(function () {
  var toggle = document.querySelector('.mobile-menu-toggle');
  var nav = document.querySelector('.mobile-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });

  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();

/* === Quantity Selector === */
(function () {
  document.querySelectorAll('.quantity-selector').forEach(function (selector) {
    var display = selector.querySelector('.qty-display');
    var minusBtn = selector.querySelector('.qty-btn[data-action="minus"]');
    var plusBtn = selector.querySelector('.qty-btn[data-action="plus"]');
    var hiddenInput = selector.closest('form') && selector.closest('form').querySelector('[name="quantity"]');

    var qty = parseInt(display ? display.textContent : '1', 10) || 1;

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

/* === Chat Widget === */
(function () {
  var trigger = document.getElementById('chat-trigger');
  var panel = document.getElementById('chat-panel');
  if (!trigger || !panel) return;

  var closeBtn = panel.querySelector('.chat-panel__close');
  var input = panel.querySelector('.chat-input');
  var sendBtn = panel.querySelector('.chat-send-btn');
  var body = panel.querySelector('.chat-panel__body');

  trigger.addEventListener('click', function () {
    var isOpen = panel.classList.toggle('open');
    panel.setAttribute('aria-hidden', !isOpen);
    trigger.setAttribute('aria-expanded', isOpen);
    if (isOpen && input) input.focus();
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
      trigger.setAttribute('aria-expanded', 'false');
    });
  }

  function sendMessage() {
    if (!input || !input.value.trim()) return;
    appendMessage(input.value.trim(), true);
    input.value = '';

    setTimeout(function () {
      appendMessage('Thank you for your message. A member of our team will be with you shortly.', false);
    }, 1000);
  }

  function appendMessage(text, isUser) {
    if (!body) return;
    var msg = document.createElement('div');
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

/* === Newsletter Form === */
(function () {
  document.querySelectorAll('[data-newsletter-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var emailInput = form.querySelector('[type="email"]');
      var successMsg = form.querySelector('[data-success]');
      if (!emailInput || !emailInput.value) return;

      var formData = new FormData(form);
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
