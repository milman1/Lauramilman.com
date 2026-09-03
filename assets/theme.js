'use strict';

/* === Cart Notification === */
function showCartNotification() {
  var note = document.getElementById('cart-notification');
  if (!note) return;
  note.hidden = false;
  note.classList.add('active');
  note.classList.add('show');
  setTimeout(function () {
    note.classList.remove('active');
    note.classList.remove('show');
    setTimeout(function () { note.hidden = true; }, 300);
  }, 2500);
}

function addVariantToCart(variantId, quantity) {
  var qty = parseInt(quantity, 10);
  if (!qty || qty < 1) qty = 1;
  return fetch('/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ id: Number(variantId), quantity: qty })
  }).then(function (res) {
    return res.json().then(function (data) {
      if (!res.ok || data.status) {
        var err = new Error(data.description || data.message || 'Could not add to cart');
        err.payload = data;
        throw err;
      }
      return data;
    });
  });
}

window.lmAddToCart = function (variantId, opts) {
  opts = opts || {};
  return addVariantToCart(variantId, opts.quantity || 1).then(function (data) {
    showCartNotification();
    updateCartCount();
    if (opts.checkout) {
      window.location.href = '/checkout';
    }
    return data;
  });
};

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

    var clicked = e.submitter || document.activeElement;
    var atcBtn = (clicked && clicked.classList && clicked.classList.contains('atc-btn'))
      ? clicked
      : form.querySelector('.atc-btn');
    if (!atcBtn || atcBtn.disabled) return;

    var variantSelect = form.querySelector('[name="id"]');
    var quantityInput = form.querySelector('[name="quantity"]');
    var variantId = variantSelect ? variantSelect.value : null;
    var quantity = quantityInput ? parseInt(quantityInput.value, 10) : 1;
    var goCheckout = atcBtn.hasAttribute('data-buy-now');

    if (!variantId) return;

    atcBtn.disabled = true;
    var originalText = atcBtn.textContent;
    atcBtn.textContent = '…';

    addVariantToCart(variantId, quantity)
      .then(function () {
        if (goCheckout) {
          window.location.href = '/checkout';
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
        atcBtn.textContent = 'Error — try again';
        atcBtn.disabled = false;
        setTimeout(function () {
          atcBtn.textContent = originalText;
        }, 2500);
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

/* === Shopify Inbox from PDP buttons (Make an offer / Ask / Direct message) === */
(function () {
  var MAX_ATTEMPTS = 40;
  var RETRY_MS = 250;
  var FILL_ATTEMPTS = 20;
  var FILL_MS = 400;
  var opening = false;
  var pendingPayload = null;
  var fillTimer = null;

  function clickEl(el) {
    if (!el) return false;
    try {
      el.click();
      return true;
    } catch (err) {
      try {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return true;
      } catch (err2) {
        return false;
      }
    }
  }

  function inboxWidget() {
    return document.querySelector('inbox-online-store-chat') || document.getElementById('ShopifyChat');
  }

  function inboxIsOpen(widget) {
    if (!widget) return false;
    return widget.getAttribute('is-open') === 'true';
  }

  /* Current Inbox embed is <shopify-chat> from storefront/web-components/chat.js.
     Always call show() — a leftover open attribute is not a visible panel.
     When that host exists, do not click the launcher; that click toggles and can close chat. */
  function tryOpenShopifyChat() {
    var host = document.querySelector('shopify-chat');
    if (!host || typeof host.show !== 'function') return false;
    try {
      host.show();
      return true;
    } catch (err) {
      return false;
    }
  }

  function tryOpenLegacyInbox() {
    var widget = inboxWidget();
    if (widget) {
      if (inboxIsOpen(widget)) return true;
      var root = widget.shadowRoot;
      if (root) {
        var launcher = root.querySelector('[data-spec="toggle-button"]') ||
          root.querySelector('button.chat-toggle') ||
          root.querySelector('.chat-toggle') ||
          root.querySelector('.chat-app > button') ||
          root.querySelector('button');
        if (clickEl(launcher)) return true;
      }
      if (widget.tagName === 'IFRAME') {
        try {
          var chatDoc = widget.contentDocument;
          var chatBtn = chatDoc && (
            chatDoc.querySelector('button.chat-toggle') ||
            chatDoc.querySelector('.chat-toggle--bottom-right') ||
            chatDoc.querySelector('button')
          );
          if (clickEl(chatBtn)) return true;
        } catch (err) {}
      }
    }

    var iframe = document.getElementById('dummy-chat-button-iframe');
    if (iframe) {
      try {
        var frameDoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
        var bubble = frameDoc && (
          frameDoc.getElementById('dummy-chat-button') ||
          frameDoc.querySelector('button')
        );
        if (clickEl(bubble)) return true;
      } catch (err) {}
    }
    return false;
  }

  function tryOpenInbox() {
    if (document.querySelector('shopify-chat')) {
      return tryOpenShopifyChat();
    }
    return tryOpenLegacyInbox();
  }

  function composerMessage(payload) {
    payload = payload || {};
    var title = payload.productTitle || '';
    var url = payload.productUrl || '';
    var intent = payload.intent || 'ask';
    var piece = title ? title : 'this piece';
    var link = url ? ' (' + url + ')' : '';
    if (intent === 'offer') {
      return 'Hi — I would like to make an offer on ' + piece + link + '.';
    }
    if (intent === 'message') {
      return "Hi — I'd like to message about " + piece + link + '.';
    }
    if (title) {
      return "Hi — I'm looking at " + title + link + '.';
    }
    return '';
  }

  function isComposer(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.disabled || el.getAttribute('aria-hidden') === 'true') return false;
    var tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      var type = (el.getAttribute('type') || 'text').toLowerCase();
      return type === 'text' || type === 'search' || type === '';
    }
    if (el.isContentEditable) return true;
    return el.getAttribute('role') === 'textbox';
  }

  function walkComposers(root, found) {
    if (!root || found.el) return;
    var nodes;
    try {
      nodes = root.querySelectorAll('textarea, input, [contenteditable="true"], [role="textbox"]');
    } catch (err) {
      nodes = [];
    }
    for (var i = 0; i < nodes.length; i++) {
      if (isComposer(nodes[i])) {
        found.el = nodes[i];
        return;
      }
    }
    var all;
    try {
      all = root.querySelectorAll('*');
    } catch (err2) {
      all = [];
    }
    for (var j = 0; j < all.length; j++) {
      var node = all[j];
      if (node.shadowRoot) walkComposers(node.shadowRoot, found);
      if (found.el) return;
      if (node.tagName === 'IFRAME') {
        try {
          var doc = node.contentDocument || (node.contentWindow && node.contentWindow.document);
          if (doc) walkComposers(doc, found);
        } catch (err3) {}
      }
      if (found.el) return;
    }
  }

  function findComposer() {
    var found = { el: null };
    var host = document.querySelector('shopify-chat');
    if (host) {
      if (host.shadowRoot) walkComposers(host.shadowRoot, found);
      if (!found.el) walkComposers(host, found);
    }
    if (!found.el) {
      var legacy = inboxWidget();
      if (legacy && legacy.shadowRoot) walkComposers(legacy.shadowRoot, found);
      if (!found.el && legacy) walkComposers(legacy, found);
    }
    return found.el;
  }

  function setComposerValue(el, text) {
    if (el.isContentEditable || el.getAttribute('role') === 'textbox') {
      el.textContent = text;
      try { el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text })); } catch (err) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, text);
    else el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function composerCurrent(el) {
    if (!el) return '';
    return String(el.value || el.textContent || '').trim();
  }

  function fillComposer(payload) {
    var text = composerMessage(payload);
    if (!text) return false;
    var el = findComposer();
    if (!el) return false;
    var current = composerCurrent(el);
    if (current && current !== text) return true;
    setComposerValue(el, text);
    return true;
  }

  function scheduleFill(payload) {
    if (fillTimer) {
      window.clearTimeout(fillTimer);
      fillTimer = null;
    }
    var attempt = 0;
    function tick() {
      if (fillComposer(payload) || attempt >= FILL_ATTEMPTS) {
        fillTimer = null;
        return;
      }
      attempt += 1;
      fillTimer = window.setTimeout(tick, FILL_MS);
    }
    tick();
  }

  function openInbox(attempt) {
    if (tryOpenInbox()) {
      scheduleFill(pendingPayload);
      return true;
    }
    if ((attempt || 0) >= MAX_ATTEMPTS) return false;
    if (!attempt && window.customElements && customElements.whenDefined) {
      customElements.whenDefined('shopify-chat').then(function () {
        if (tryOpenInbox()) scheduleFill(pendingPayload);
      }).catch(function () {});
    }
    window.setTimeout(function () {
      openInbox((attempt || 0) + 1);
    }, RETRY_MS);
    return false;
  }

  function requestOpen(payload) {
    pendingPayload = payload || pendingPayload;
    if (opening) {
      scheduleFill(pendingPayload);
      tryOpenInbox();
      return;
    }
    opening = true;
    openInbox(0);
    window.setTimeout(function () {
      opening = false;
    }, 400);
  }

  function payloadFromButton(btn) {
    if (!btn) return {};
    return {
      productTitle: btn.getAttribute('data-product-title') || '',
      productUrl: btn.getAttribute('data-product-url') || window.location.href,
      productId: btn.getAttribute('data-product-id') || '',
      productHandle: btn.getAttribute('data-product-handle') || '',
      productImage: btn.getAttribute('data-product-image') || '',
      intent: btn.getAttribute('data-chat-intent') || 'ask'
    };
  }

  window.lmChat = {
    open: function (payload) {
      requestOpen(payload || {});
    }
  };

  document.addEventListener('click', function (event) {
    var btn = event.target && event.target.closest && event.target.closest('.js-open-product-chat');
    if (!btn) return;
    event.preventDefault();
    requestOpen(payloadFromButton(btn));
  });
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
