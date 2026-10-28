(function () {
  'use strict';
  const root = document.querySelector('.cart-page');
  if (!root) return;
  const cfg = JSON.parse(document.querySelector('[data-ring-cart-config]').textContent);
  const base = (cfg.root || '/').replace(/\/?$/, '/');
  let busy = false;
  async function update(key, quantity) {
    if (busy) return;
    busy = true;
    root.querySelectorAll('button').forEach(b => { b.disabled = true; });
    const error = root.querySelector('[data-cart-error]');
    if (error) error.hidden = true;
    const item = Array.from(root.querySelectorAll('[data-key]')).find(el => el.dataset.key === key);
    const group = item?.dataset.ringGroup;
    const updates = group ? Object.fromEntries(Array.from(root.querySelectorAll('[data-key]')).filter(el => el.dataset.ringGroup === group).map(el => [el.dataset.key, 0])) : null;
    try {
      const response = await fetch(base + (updates ? 'cart/update.js' : 'cart/change.js'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(updates ? { updates } : { id: key, quantity }) });
      const data = await response.json();
      if (!response.ok || data.status >= 400) throw new Error('cart');
      window.location.reload();
    } catch (_) {
      busy = false;
      root.querySelectorAll('button').forEach(b => { if (!b.hasAttribute('data-incomplete-ring')) b.disabled = false; });
      if (error) error.hidden = false;
    }
  }
  root.addEventListener('click', event => {
    const remove = event.target.closest('[data-remove-key]');
    if (remove) { update(remove.dataset.removeKey, 0); return; }
    const button = event.target.closest('[data-qty-change]');
    if (!button) return;
    const input = Array.from(root.querySelectorAll('[data-qty-input]')).find(el => el.dataset.qtyInput === button.dataset.qtyChange);
    if (!input) return;
    const next = Math.max(0, Number(input.value) + Number(button.dataset.delta));
    input.value = next;
    update(button.dataset.qtyChange, next);
  });
  root.addEventListener('change', event => {
    if (event.target.matches('[data-qty-input]')) update(event.target.dataset.qtyInput, Math.max(0, Math.floor(Number(event.target.value) || 0)));
  });
  root.querySelector('form')?.addEventListener('submit', event => { if (busy || root.querySelector('[data-incomplete-ring]')) event.preventDefault(); });
})();
