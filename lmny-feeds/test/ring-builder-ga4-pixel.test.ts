import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it, expect } from 'vitest';

const source = readFileSync(new URL('../../docs/analytics/lmny-ring-builder-ga4-pixel.js', import.meta.url), 'utf8');
function sandbox(allowed: boolean) {
  const handlers = new Map<string, (event: any) => void>();
  const scripts: any[] = [];
  let changeConsent: (event: any) => void;
  const window: any = {};
  vm.runInNewContext(source, {
    window, init: { customerPrivacy: { analyticsProcessingAllowed: allowed } },
    api: { customerPrivacy: { subscribe: (_: string, fn: any) => { changeConsent = fn; } } },
    analytics: { subscribe: (name: string, fn: any) => handlers.set(name, fn) },
    document: { createElement: () => ({}), head: { appendChild: (script: any) => scripts.push(script) } }
  });
  return {
    handlers, scripts,
    calls: () => Array.from(window.dataLayer || [], (args: any) => Array.from(args)) as any[],
    consent: (value: boolean) => changeConsent!({ customerPrivacy: { analyticsProcessingAllowed: value } })
  };
}
describe('ring-builder GA4 custom pixel', () => {
  it('forwards all eight custom events to the verified destination without standard events', () => {
    const s = sandbox(true);
    expect(s.handlers.size).toBe(8);
    for (const [name, send] of s.handlers) send({ id: name, customData: { screen: 'review', origin: 'lab', band_count: 2, device_type: 'mobile', product_kind: 'diamond' } });
    const events = s.calls().filter(c => c[0] === 'event');
    expect(events).toHaveLength(8);
    expect(events.map(c => c[1])).toEqual([...s.handlers.keys()]);
    expect(events.every(c => c[2].send_to === 'G-CTWW9B42MX')).toBe(true);
    expect(s.scripts).toHaveLength(1);
    expect(s.calls().find(c => c[0] === 'config')[2].send_page_view).toBe(false);
    expect(s.handlers.has('page_viewed')).toBe(false);
    expect(s.handlers.has('checkout_completed')).toBe(false);
  });
  it('does not load Google or replay events while denied, and honors later revocation', () => {
    const s = sandbox(false), send = s.handlers.get('lmny_build_shared')!;
    send({ id: 'denied' });
    expect(s.scripts).toHaveLength(0); expect(s.calls()).toEqual([]);
    s.consent(true); expect(s.calls()).toEqual([]);
    send({ id: 'allowed' });
    s.consent(false); send({ id: 'revoked' });
    expect(s.calls().filter(c => c[0] === 'event')).toHaveLength(1);
    expect(s.calls().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
  });
  it('deduplicates Shopify events and strips personalization, URLs and unexpected values', () => {
    const s = sandbox(true), send = s.handlers.get('lmny_build_shared')!;
    const event = { id: 'same', context: { document: { location: { href: 'https://example.com/?email=PRIVATE#build=PRIVATE' } } }, customData: { engraving: 'PRIVATE', email: 'PRIVATE', screen: 'PRIVATE', origin: 'PRIVATE', band_count: 99, device_type: 'PRIVATE', product_kind: 'PRIVATE' } };
    send(event); send(event);
    expect(s.calls().filter(c => c[0] === 'event')).toHaveLength(1);
    expect(JSON.stringify(s.calls())).not.toContain('PRIVATE');
    expect(s.calls().find(c => c[0] === 'event')[2]).toEqual({ send_to: 'G-CTWW9B42MX', page_location: 'https://www.lauramilman.com/pages/ring-builder', page_referrer: '' });
  });
});
