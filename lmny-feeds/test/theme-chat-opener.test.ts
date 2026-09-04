import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function themeJs(): string {
  return readFileSync(new URL('../../assets/theme.js', import.meta.url), 'utf8');
}

function chatIife(): string {
  const src = themeJs();
  const start = src.indexOf('/* === Shopify Inbox from PDP buttons');
  const end = src.indexOf('/* === Newsletter Form');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

type Host = {
  show: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  open: boolean;
  shadowRoot: ShadowRoot | null;
};

function installDom(hostOpen = true) {
  const show = vi.fn(function (this: Host) {
    this.open = true;
  });
  const close = vi.fn(function (this: Host) {
    this.open = false;
  });
  const composer = {
    nodeType: 1,
    tagName: 'TEXTAREA',
    disabled: false,
    isContentEditable: false,
    value: '',
    textContent: '',
    getAttribute: (name: string) => (name === 'aria-hidden' ? null : name === 'role' ? null : null),
    dispatchEvent: vi.fn(),
  };
  const host: Host & Record<string, unknown> = {
    show,
    close,
    open: hostOpen,
    tagName: 'SHOPIFY-CHAT',
    shadowRoot: {
      querySelector: (sel: string) => (sel.includes('textarea') ? composer : null),
      querySelectorAll: (sel: string) => (sel.includes('textarea') || sel === '*' ? [composer] : []),
    } as unknown as ShadowRoot,
    querySelector: () => null,
    querySelectorAll: () => [],
    hasAttribute: (name: string) => name === 'open' && hostOpen,
    getAttribute: () => (hostOpen ? 'true' : null),
    getBoundingClientRect: () => ({ left: 900, top: 200, width: 360, height: 480, right: 1260, bottom: 680 }),
  };

  const buttons: Element[] = [];
  const clickListeners: Array<(event: Event) => void> = [];

  const created: Record<string, { id?: string; innerHTML: string; hidden: boolean; style: Record<string, string>; children: unknown[]; appendChild: (n: unknown) => void; querySelector: () => null; setAttribute: () => void; textContent: string; className: string; href?: string; src?: string; alt?: string; target?: string; rel?: string }> = {};

  const document = {
    head: { appendChild: vi.fn() },
    body: { appendChild: vi.fn() },
    execCommand: vi.fn(() => false),
    createElement: (tag: string) => {
      const el: {
        tagName: string;
        innerHTML: string;
        hidden: boolean;
        style: Record<string, string>;
        children: unknown[];
        textContent: string;
        className: string;
        id: string;
        href?: string;
        src?: string;
        alt?: string;
        target?: string;
        rel?: string;
        appendChild: (n: unknown) => void;
        querySelector: () => null;
        setAttribute: (name: string, value: string) => void;
      } = {
        tagName: tag.toUpperCase(),
        innerHTML: '',
        hidden: false,
        style: {},
        children: [],
        textContent: '',
        className: '',
        id: '',
        appendChild(n: unknown) { this.children.push(n); },
        querySelector: () => null,
        setAttribute(name: string, value: string) {
          if (name === 'id') el.id = value;
        },
      };
      Object.defineProperty(el, 'id', {
        get() { return (el as { _id?: string })._id || ''; },
        set(v: string) {
          (el as { _id?: string })._id = v;
          if (v) created[v] = el;
        },
        configurable: true,
      });
      return el;
    },
    querySelector: (sel: string) => {
      if (sel === 'shopify-chat') return host;
      if (sel === 'inbox-online-store-chat') return null;
      return null;
    },
    querySelectorAll: (sel: string) => {
      if (sel === '.js-open-product-chat') return buttons;
      return [];
    },
    getElementById: (id: string) => created[id] || null,
    addEventListener: (type: string, fn: (event: Event) => void) => {
      if (type === 'click') clickListeners.push(fn);
    },
  };

  const customElements = {
    whenDefined: () => Promise.resolve(),
  };

  const windowObj: Record<string, unknown> = {
    location: { href: 'https://www.lauramilman.com/products/channel-set-diamond-stackable-eternity-band' },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    setInterval: vi.fn(),
    innerWidth: 1280,
    innerHeight: 800,
    customElements,
  };
  windowObj.window = windowObj;
  windowObj.document = document;

  class FakeTextArea {
    value = '';
  }
  class FakeInput {
    value = '';
  }
  class FakeInputEvent extends Event {
    data: string | undefined;
    constructor(type: string, init?: { bubbles?: boolean; data?: string }) {
      super(type, init);
      this.data = init?.data;
    }
  }

  const fn = new Function(
    'window',
    'document',
    'customElements',
    'HTMLTextAreaElement',
    'HTMLInputElement',
    'InputEvent',
    chatIife(),
  );
  fn(windowObj, document, customElements, FakeTextArea, FakeInput, FakeInputEvent);

  return { host, show, composer, windowObj, clickListeners, document };
}

describe('PDP Shopify chat opener', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls host.show even when the open attribute is already set', () => {
    const { show, windowObj } = installDom(true);
    (windowObj as { lmChat: { open: (p: object) => void } }).lmChat.open({
      productTitle: 'Channel Set Diamond Stackable Eternity Band',
      productUrl: 'https://www.lauramilman.com/products/channel-set-diamond-stackable-eternity-band',
      intent: 'ask',
    });
    expect(show).toHaveBeenCalled();
  });

  it('prefills the composer with the product on the page', () => {
    const { composer, windowObj } = installDom(false);
    (windowObj as { lmChat: { open: (p: object) => void } }).lmChat.open({
      productTitle: 'Channel Set Diamond Stackable Eternity Band',
      productUrl: 'https://www.lauramilman.com/products/channel-set-diamond-stackable-eternity-band',
      intent: 'ask',
    });
    vi.runAllTimers();
    expect(composer.value).toContain('Channel Set Diamond Stackable Eternity Band');
    expect(composer.value).toContain('channel-set-diamond-stackable-eternity-band');
    expect(composer.value).not.toContain('Jacob');

    (windowObj as { lmChat: { open: (p: object) => void } }).lmChat.open({
      productTitle: 'Channel Set Diamond Stackable Eternity Band',
      productUrl: 'https://www.lauramilman.com/products/channel-set-diamond-stackable-eternity-band',
      intent: 'message',
    });
    vi.runAllTimers();
    expect(composer.value).toContain("I'd like to message about Channel Set Diamond Stackable Eternity Band");
  });

  it('does not overwrite a message the customer already typed', () => {
    const { composer, windowObj } = installDom(false);
    composer.value = 'Can you hold this in a size 6?';
    (windowObj as { lmChat: { open: (p: object) => void } }).lmChat.open({
      productTitle: 'Channel Set Diamond Stackable Eternity Band',
      productUrl: 'https://www.lauramilman.com/products/channel-set-diamond-stackable-eternity-band',
      intent: 'ask',
    });
    vi.runAllTimers();
    expect(composer.value).toBe('Can you hold this in a size 6?');
  });

  it('pins this product on the chat panel when a pill is clicked', () => {
    const { windowObj, document } = installDom(true);
    (windowObj as { lmChat: { open: (p: object) => void } }).lmChat.open({
      productTitle: 'Jacob & Company Five Time Zone Watch (Diamond Bezel)',
      productUrl: 'https://www.lauramilman.com/products/jacob-company-five-time-zone-watch-diamond-bezel',
      productImage: 'https://cdn.shopify.com/watch.jpg',
      intent: 'offer',
    });
    const card = document.getElementById('lm-chat-piece') as { children: Array<{ textContent?: string; children?: Array<{ textContent?: string }> }> } | null;
    expect(card).toBeTruthy();
    const texts = (card?.children || [])
      .flatMap((child) => [child.textContent, ...(child.children || []).map((n) => n.textContent)])
      .join(' ');
    expect(texts).toContain('Make an offer');
    expect(texts).toContain('Jacob & Company Five Time Zone Watch (Diamond Bezel)');
  });

  it('does not treat a leftover open flag as success without show()', () => {
    const src = chatIife();
    expect(src).not.toMatch(/host\.open === true \|\| host\.hasAttribute\('open'\) return true/);
    expect(src).toContain('host.show()');
  });
});
