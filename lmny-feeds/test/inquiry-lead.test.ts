import { describe, expect, it, vi } from 'vitest';
import {
  buildCustomerNote,
  buildInquiryEmail,
  handleInquiry,
  normalizePhone,
  validateInquiry,
} from '../cloudflare-worker/inquiry-lead.js';

const ORIGIN = 'https://www.lauramilman.com';
const PIECE = {
  title: 'Oval Solitaire in 18K Yellow Gold',
  variant: '18K Yellow Gold / 6',
  sku: 'RG-18-6',
  price: '$4,800',
  url: 'https://www.lauramilman.com/products/oval-solitaire?variant=9',
};

function memoryKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function inquiryBody(overrides: Record<string, unknown> = {}) {
  return {
    first_name: 'Maya',
    last_name: 'Cohen',
    email: 'maya@example.com',
    phone: '(212) 555-0100',
    question: 'Is this size in stock?',
    marketing: false,
    piece: PIECE,
    company_website: '',
    ...overrides,
  };
}

function post(body: unknown, origin = ORIGIN) {
  return new Request('https://worker.example/inquiry', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' },
    body: JSON.stringify(body),
  });
}

function shopState() {
  return {
    customer: null as null | { id: string; note: string },
    creates: [] as Array<Record<string, unknown>>,
    updates: [] as Array<Record<string, unknown>>,
    tags: [] as string[][],
    consents: [] as unknown[],
    emails: [] as Array<{ body: Record<string, unknown>; key: string }>,
    phoneFails: false,
    resendFails: false,
  };
}

function fakeFetch(state: ReturnType<typeof shopState>) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const headers = new Headers(init?.headers);
    if (href.includes('/graphql.json')) {
      const query = String(body.query || '');
      if (query.includes('FindInquiryCustomer')) {
        return Response.json({ data: { customers: { nodes: state.customer ? [state.customer] : [] } } });
      }
      if (query.includes('CreateInquiryCustomer')) {
        const input = body.variables.input;
        state.creates.push(input);
        if (state.phoneFails && input.phone) {
          return Response.json({
            data: { customerCreate: { customer: null, userErrors: [{ field: ['phone'], message: 'Phone is invalid' }] } },
          });
        }
        state.customer = { id: 'gid://shopify/Customer/42', note: input.note };
        return Response.json({
          data: { customerCreate: { customer: { id: state.customer.id }, userErrors: [] } },
        });
      }
      if (query.includes('UpdateInquiryCustomer')) {
        state.updates.push(body.variables.input);
        if (state.customer) state.customer.note = body.variables.input.note;
        return Response.json({
          data: { customerUpdate: { customer: { id: state.customer?.id }, userErrors: [] } },
        });
      }
      if (query.includes('TagInquiryCustomer')) {
        state.tags.push(body.variables.tags);
        return Response.json({ data: { tagsAdd: { node: { id: body.variables.id }, userErrors: [] } } });
      }
      if (query.includes('InquiryEmailConsent')) {
        state.consents.push(body.variables.input);
        return Response.json({
          data: { customerEmailMarketingConsentUpdate: { customer: { id: 'gid://shopify/Customer/42' }, userErrors: [] } },
        });
      }
    }
    if (href === 'https://api.resend.com/emails') {
      state.emails.push({ body, key: headers.get('Idempotency-Key') || '' });
      if (state.resendFails) return new Response('no', { status: 500 });
      return Response.json({ id: 'email_test' });
    }
    throw new Error(`unexpected fetch ${href}`);
  });
}

function env(extra: Record<string, unknown> = {}) {
  return {
    FEED_CACHE: memoryKv(),
    SHOPIFY_ADMIN_TOKEN: 'test-token',
    SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
    RESEND_API_KEY: 're_test',
    ...extra,
  };
}

describe('inquiry validation', () => {
  it('keeps a phone Shopify can store and drops one it cannot', () => {
    expect(normalizePhone('(212) 555-0100')).toBe('+12125550100');
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
    expect(normalizePhone('call me')).toBe('');
  });

  it('requires names, email and a question, and only accepts a store link', () => {
    expect(validateInquiry(inquiryBody()).ok).toBe(true);
    expect(validateInquiry(inquiryBody({ first_name: '  ' }))).toMatchObject({ error: 'first_name_required' });
    expect(validateInquiry(inquiryBody({ email: 'not-an-email' }))).toMatchObject({ error: 'email_invalid' });
    expect(validateInquiry(inquiryBody({ question: '' }))).toMatchObject({ error: 'question_required' });
    expect(validateInquiry(inquiryBody({ marketing: 'yes' })).ok && (validateInquiry(inquiryBody({ marketing: 'yes' })) as { value: { marketing: boolean } }).value.marketing).toBe(false);
    expect(validateInquiry(inquiryBody({ piece: { ...PIECE, url: 'https://evil.example/products/x' } }))).toMatchObject({
      error: 'piece_url_invalid',
    });
    const general = validateInquiry(inquiryBody({ piece: undefined }));
    expect(general.ok && general.ok && (general as { value: { piece: null } }).value.piece).toBeNull();
  });

  it('appends a new inquiry without erasing an older note', () => {
    const inquiry = validateInquiry(inquiryBody());
    if (!inquiry.ok) throw new Error('expected ok');
    const note = buildCustomerNote(inquiry.value, 'Spoke on the phone in March.', '2026-11-19T04:30:00.000Z');
    expect(note.startsWith('Spoke on the phone in March.')).toBe(true);
    expect(note).toContain('Piece: Oval Solitaire in 18K Yellow Gold');
    expect(note).toContain('SKU: RG-18-6');
    expect(note).toContain('Email marketing: no');
    expect(note).toContain('Is this size in stock?');
  });

  it('quotes the piece in a plain confirmation and leaves marketing out of the letter', () => {
    const inquiry = validateInquiry(inquiryBody());
    if (!inquiry.ok) throw new Error('expected ok');
    const message = buildInquiryEmail(inquiry.value);
    expect(message.subject).toBe('Your question about the Oval Solitaire in 18K Yellow Gold');
    expect(message.from).toBe('Laura Milman New York <hello@lauramilman.com>');
    expect(message.replyTo).toBe('hello@lauramilman.com');
    expect(message.to).toEqual(['maya@example.com']);
    expect(message.bcc).toEqual(['hello@lauramilman.com']);
    expect(message.text).toContain('reply shortly in this thread');
    expect(message.text).toContain('https://www.lauramilman.com/products/oval-solitaire?variant=9');
    expect(message.text).toContain('Midtown, New York City');
    expect(message.html).toContain('Is this size in stock?');
    expect(message.html).not.toContain('Diamond District');
    expect(message.text).not.toContain('Diamond District');
    const nasty = validateInquiry(inquiryBody({ question: '<script>alert(1)</script>' }));
    if (!nasty.ok) throw new Error('expected ok');
    expect(buildInquiryEmail(nasty.value).html).toContain('&lt;script&gt;');
    const page = validateInquiry(inquiryBody({ piece: null }));
    if (!page.ok) throw new Error('expected ok');
    expect(buildInquiryEmail(page.value).subject).toBe('Your question for Laura Milman New York');
  });
});

describe('inquiry handler', () => {
  it('creates a customer without marketing consent and sends one confirmation', async () => {
    const state = shopState();
    const fetchImpl = fakeFetch(state);
    const res = await handleInquiry(post(inquiryBody()), env(), {}, fetchImpl);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, emailed: true, created: true });
    expect(state.creates).toHaveLength(1);
    expect(state.creates[0].tags).toEqual(['Inquiry', 'Website form']);
    expect(state.creates[0].emailMarketingConsent).toBeUndefined();
    expect(state.creates[0].phone).toBe('+12125550100');
    expect(state.creates[0].note).toContain('Variant: 18K Yellow Gold / 6');
    expect(state.consents).toHaveLength(0);
    expect(state.emails).toHaveLength(1);
    expect(state.emails[0].body.from).toBe('Laura Milman New York <hello@lauramilman.com>');
    expect(state.emails[0].body.reply_to).toBe('hello@lauramilman.com');
    expect(state.emails[0].body.bcc).toEqual(['hello@lauramilman.com']);
    expect(state.emails[0].body.subject).toBe('Your question about the Oval Solitaire in 18K Yellow Gold');
    expect(String(state.emails[0].body.text)).toContain('Is this size in stock?');
  });

  it('does not send a second letter for the same question', async () => {
    const state = shopState();
    const used = env();
    const fetchImpl = fakeFetch(state);
    await handleInquiry(post(inquiryBody()), used, {}, fetchImpl);
    await handleInquiry(post(inquiryBody()), used, {}, fetchImpl);
    expect(state.creates).toHaveLength(1);
    expect(state.emails).toHaveLength(1);
  });

  it('updates an existing customer, keeps marketing off, and still confirms', async () => {
    const state = shopState();
    state.customer = { id: 'gid://shopify/Customer/7', note: 'Existing note.' };
    const fetchImpl = fakeFetch(state);
    const res = await handleInquiry(post(inquiryBody()), env(), {}, fetchImpl);
    expect((await res.json()).created).toBe(false);
    expect(state.creates).toHaveLength(0);
    expect(state.updates[0].note).toContain('Existing note.');
    expect(state.updates[0].note).toContain('Website inquiry');
    expect(state.tags[0]).toEqual(['Inquiry', 'Website form']);
    expect(state.consents).toHaveLength(0);
    expect(state.updates[0].emailMarketingConsent).toBeUndefined();
  });

  it('subscribes only when the box was ticked', async () => {
    const state = shopState();
    const fetchImpl = fakeFetch(state);
    await handleInquiry(post(inquiryBody({ marketing: true })), env(), {}, fetchImpl);
    expect(state.creates[0].emailMarketingConsent).toMatchObject({ marketingState: 'SUBSCRIBED', marketingOptInLevel: 'SINGLE_OPT_IN' });
  });

  it('retries without a phone Shopify rejects', async () => {
    const state = shopState();
    state.phoneFails = true;
    const fetchImpl = fakeFetch(state);
    const res = await handleInquiry(post(inquiryBody()), env(), {}, fetchImpl);
    expect(res.status).toBe(200);
    expect(state.creates[1].phone).toBeUndefined();
    expect(state.creates[1].note).toContain('Phone: (212) 555-0100');
  });

  it('keeps the customer when the confirmation email fails', async () => {
    const state = shopState();
    state.resendFails = true;
    const fetchImpl = fakeFetch(state);
    const res = await handleInquiry(post(inquiryBody()), env(), {}, fetchImpl);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, emailed: false, created: true });
    expect(state.creates).toHaveLength(1);
  });

  it('saves the lead when Resend is not configured', async () => {
    const state = shopState();
    const fetchImpl = fakeFetch(state);
    const res = await handleInquiry(post(inquiryBody({ piece: null, question: 'Do you see clients on Saturday?' })), env({ RESEND_API_KEY: '' }), {}, fetchImpl);
    expect(await res.json()).toMatchObject({ ok: true, emailed: false });
    expect(state.emails).toHaveLength(0);
    expect(state.creates[0].note).toContain('Piece: general inquiry');
    expect(state.creates[0].note).toContain('Do you see clients on Saturday?');
  });

  it('ignores a honeypot and refuses a foreign origin', async () => {
    const state = shopState();
    const fetchImpl = fakeFetch(state);
    const bot = await handleInquiry(post(inquiryBody({ company_website: 'https://spam.example' })), env(), {}, fetchImpl);
    expect(bot.status).toBe(200);
    expect(fetchImpl).not.toHaveBeenCalled();
    const foreign = await handleInquiry(post(inquiryBody(), 'https://evil.example'), env(), {}, fetchImpl);
    expect(foreign.status).toBe(403);
  });

  it('stops answering after the visitor cap', async () => {
    const state = shopState();
    const used = env();
    const fetchImpl = fakeFetch(state);
    for (let i = 0; i < 8; i += 1) {
      const res = await handleInquiry(post(inquiryBody({ question: `Question ${i}` })), used, {}, fetchImpl);
      expect(res.status).toBe(200);
    }
    const blocked = await handleInquiry(post(inquiryBody({ question: 'Question 9' })), used, {}, fetchImpl);
    expect(blocked.status).toBe(429);
  });

  it('does not save a customer when the admin token is missing', async () => {
    const state = shopState();
    const fetchImpl = fakeFetch(state);
    const res = await handleInquiry(post(inquiryBody()), env({ SHOPIFY_ADMIN_TOKEN: '' }), {}, fetchImpl);
    expect(res.status).toBe(503);
    expect(state.creates).toHaveLength(0);
    expect(state.emails).toHaveLength(0);
  });
});
