'use strict';

/* Shopify Inbox bridge. Product CTAs (Ask / Direct message / Make an offer)
   open the Online store chat embed and prefill the composer when possible. */
(function () {
  var OPEN_WAIT_MS = 4000;
  var POLL_MS = 80;

  var TOGGLE_SELECTORS = [
    '.chat-toggle',
    '.chat-app > button',
    'button[aria-controls="chat-ui"]',
    'button.chat-app--close-button',
    'button[aria-label*="Chat" i]',
    'button[aria-label*="chat" i]',
    'button'
  ];

  var COMPOSER_SELECTORS = [
    'textarea',
    'textarea[name="message"]',
    '[contenteditable="true"]',
    'input[type="text"]'
  ];

  function chatHost() {
    return document.getElementById('ShopifyChat')
      || document.querySelector('inbox-online-store-chat')
      || document.querySelector('shopify-chat');
  }

  function queryDeep(root, selectors) {
    if (!root) return null;
    var i;
    for (i = 0; i < selectors.length; i++) {
      try {
        var match = root.querySelector(selectors[i]);
        if (match) return match;
      } catch (e) {}
    }
    var nodes = root.querySelectorAll('*');
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i].shadowRoot) {
        var nested = queryDeep(nodes[i].shadowRoot, selectors);
        if (nested) return nested;
      }
    }
    return null;
  }

  function hostRoot(host) {
    return (host && host.shadowRoot) || host;
  }

  function isOpen(host) {
    if (!host) return false;
    var flag = host.getAttribute('is-open');
    if (flag === 'true') return true;
    if (flag === 'false') return false;
    return host.getAttribute('aria-expanded') === 'true';
  }

  function clickToggle(host) {
    var root = hostRoot(host);
    var btn = queryDeep(root, TOGGLE_SELECTORS);
    if (btn) {
      btn.click();
      return true;
    }
    if (typeof host.click === 'function') {
      host.click();
      return true;
    }
    return false;
  }

  function setNativeValue(el, value) {
    var proto = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillComposer(host, text) {
    var field = queryDeep(hostRoot(host), COMPOSER_SELECTORS);
    if (!field) return false;
    field.focus();
    if (field.isContentEditable) {
      field.textContent = text;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      setNativeValue(field, text);
    }
    return true;
  }

  function compose(opts) {
    opts = opts || {};
    var title = (opts.productTitle || '').trim();
    var url = (opts.productUrl || '').trim();
    var price = (opts.productPrice || '').trim();
    var intent = opts.intent || 'ask';
    if (!title && !url) return '';
    if (intent === 'offer') {
      return "I'd like to make an offer on " + title
        + (price ? ' (listed at ' + price + ')' : '')
        + '.'
        + (url ? '\n' + url : '');
    }
    if (intent === 'message') {
      return "I'd like to message you about " + title + '.'
        + (url ? '\n' + url : '');
    }
    return "I'm asking about " + title + '.'
      + (url ? '\n' + url : '');
  }

  function waitFor(test, done) {
    var started = Date.now();
    (function poll() {
      var value = test();
      if (value) {
        done(value);
        return;
      }
      if (Date.now() - started >= OPEN_WAIT_MS) {
        done(null);
        return;
      }
      setTimeout(poll, POLL_MS);
    })();
  }

  function openInbox(opts) {
    opts = opts || {};
    var message = compose(opts);

    waitFor(chatHost, function (host) {
      if (!host) {
        if (message) {
          window.location.href = 'mailto:hello@lauramilman.com?subject='
            + encodeURIComponent(opts.intent === 'offer' ? 'Offer' : 'Inquiry')
            + '&body=' + encodeURIComponent(message);
        }
        return;
      }
      if (!isOpen(host)) clickToggle(host);
      if (!message) return;
      waitFor(function () {
        var live = chatHost();
        return live && fillComposer(live, message) ? live : null;
      }, function () {});
    });
  }

  window.lmChat = {
    open: openInbox,
    compose: compose
  };
})();
