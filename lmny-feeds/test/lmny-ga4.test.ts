import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

const code = readFileSync(new URL('../../assets/lmny-ga4.js', import.meta.url), 'utf8');
function setup(granted = true, href = 'https://www.lauramilman.com/pages/ring-builder', storage = new Map<string, string>()) {
  const listeners: Record<string, Function[]> = {};
  const calls: any[][] = [];
  const pending: Function[] = [];
  const state = { granted, ready: true, complete: true };
  const win: any = { location: { href }, Shopify: { customerPrivacy: { analyticsProcessingAllowed: () => state.granted } } };
  win.gtag = (...args: any[]) => { calls.push(args); if (args[0] === 'get') { if (state.ready) args[3]('storefront-client'); else pending.push(args[3]); } else if (state.complete) args[2]?.event_callback?.(); };
  const doc = { referrer: '', addEventListener: (name: string, fn: Function) => (listeners[name] ||= []).push(fn) };
  const context = vm.createContext({ window: win, document: doc, URL, Date, setTimeout, clearTimeout, sessionStorage: { getItem: (k: string) => storage.get(k), setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) } });
  vm.runInContext(code, context);
  return { win, state, calls, pending, context, events: () => calls.filter(c => c[0] === 'event'), consent: (allow: boolean) => { state.granted = allow; listeners.visitorConsentCollected.forEach(fn => fn()); } };
}
afterEach(() => vi.useRealTimers());
describe('existing storefront GA4 transport', () => {
  it('hands a confirmed cart conversion to the next cart page exactly once', async () => {
    const storage = new Map<string, string>();
    const builder = setup(true, undefined, storage);
    expect(await builder.win.LMNYGa4.track('build_added_to_cart', { screen: 'review', band_count: 1 })).toBe(true);
    expect(builder.events()).toHaveLength(0);
    const cart = setup(true, 'https://www.lauramilman.com/cart', storage);
    expect(cart.events()).toHaveLength(1);
    expect(cart.events()[0][1]).toBe('lmny_build_added_to_cart');
    expect(cart.events()[0][2].band_count).toBe(1);
    cart.consent(true);
    expect(cart.events()).toHaveLength(1);
    expect(setup(true, 'https://www.lauramilman.com/cart', storage).events()).toHaveLength(0);
  });
  it('drops pending cart conversions after revocation, expiry or denied arrival', async () => {
    for (const mode of ['revoked', 'expired', 'denied']) {
      vi.useFakeTimers();
      const storage = new Map<string, string>();
      const builder = setup(true, undefined, storage);
      await builder.win.LMNYGa4.track('build_added_to_cart', {});
      if (mode === 'revoked') builder.consent(false);
      if (mode === 'expired') await vi.advanceTimersByTimeAsync(120001);
      const cart = setup(mode !== 'denied', 'https://www.lauramilman.com/cart', storage);
      cart.consent(true);
      expect(cart.events()).toHaveLength(0);
      vi.useRealTimers();
    }
  });
  it('uses the existing destination without creating tags, identities or standard events', async () => {
    const s = setup();
    expect(await s.win.LMNYGa4.track('diamond_selected', { screen: 'catalog', origin: 'lab', band_count: 0 })).toBe(true);
    expect(s.calls.map(c => c[0])).toEqual(['get', 'event']);
    expect(s.events()[0][1]).toBe('lmny_diamond_selected');
    expect(s.events()[0][2]).toMatchObject({ send_to: 'G-CTWW9B42MX', page_location: 'https://www.lauramilman.com/pages/ring-builder' });
    expect(s.events()[0][2]).not.toHaveProperty('client_id');
    expect(s.events()[0][2]).not.toHaveProperty('session_id');
    expect(await s.win.LMNYGa4.track('add_to_cart', {})).toBe(false);
    expect(s.events()).toHaveLength(1);
  });
  it('drops events under denial and does not replay them after grant', async () => {
    const s = setup(false);
    expect(await s.win.LMNYGa4.track('build_saved', {})).toBe(false);
    s.consent(true);
    expect(s.events()).toHaveLength(0);
    expect(await s.win.LMNYGa4.track('build_saved', {})).toBe(true);
    s.consent(false);
    expect(await s.win.LMNYGa4.track('build_shared', {})).toBe(false);
    expect(s.events()).toHaveLength(1);
  });
  it('cancels a pending callback across revoke then regrant', async () => {
    const s = setup(); s.state.ready = false;
    const result = s.win.LMNYGa4.track('build_saved', {});
    s.consent(false); s.consent(true);
    s.pending[0]('storefront-client');
    expect(await result).toBe(false);
    expect(s.events()).toHaveLength(0);
  });
  it('bounds a missing destination and ignores late callbacks', async () => {
    vi.useFakeTimers();
    const s = setup(); s.state.ready = false;
    const result = s.win.LMNYGa4.track('diamond_selected', {});
    await vi.advanceTimersByTimeAsync(10001);
    expect(await result).toBe(false);
    s.pending[0]('late');
    expect(s.events()).toHaveLength(0);
  });
  it('allows all builder actions and strips sensitive or arbitrary fields', async () => {
    const s = setup();
    for (const name of ['builder_opened','product_viewed','setting_selected','diamond_selected','build_saved','build_shared','band_selected']) {
      await s.win.LMNYGa4.track(name, { screen: 'review', band_count: 1, email: 'private@example.test', engraving: 'private', session_id: 'invented', page_location: 'https://bad.test/' });
    }
    expect(s.events()).toHaveLength(7);
    for (const c of s.events()) { expect(c[2]).not.toHaveProperty('email'); expect(c[2]).not.toHaveProperty('engraving'); expect(c[2]).not.toHaveProperty('session_id'); expect(c[2].page_location).toBe('https://www.lauramilman.com/pages/ring-builder'); }
  });
  it('validates product handles and keeps query strings out', async () => {
    const s = setup();
    expect(await s.win.LMNYGa4.track('diamond_purchase_viewed', { screen: 'review' })).toBe(false);
    expect(await s.win.LMNYGa4.track('diamond_purchase_viewed', { screen: 'diamond_product', product_handle: 'lg-1?email=x' })).toBe(false);
    expect(await s.win.LMNYGa4.track('diamond_purchase_viewed', { screen: 'diamond_product', product_handle: 'lg-917959' })).toBe(true);
    expect(s.events()[0][2].page_location).toBe('https://www.lauramilman.com/products/lg-917959');
  });
  it('preserves redirect tracking once per page after consent', async () => {
    const s = setup(false, 'https://www.lauramilman.com/collections/natural-diamonds?lmny_redirect=nd-352312&email=private');
    s.consent(true); await Promise.resolve();
    s.consent(true); await Promise.resolve();
    expect(s.events()).toHaveLength(1);
    expect(s.events()[0][1]).toBe('lmny_diamond_redirect_landing');
    expect(s.events()[0][2]).toMatchObject({ original_diamond: 'nd-352312', redirect_collection: 'natural-diamonds', origin: 'natural', page_location: 'https://www.lauramilman.com/collections/natural-diamonds' });
  });
  it('does not reinstall listeners or duplicate redirect sends', () => {
    const s = setup(true, 'https://www.lauramilman.com/collections/natural-diamonds?lmny_redirect=nd-352312');
    vm.runInContext(code, s.context);
    expect(s.events()).toHaveLength(1);
  });
});
