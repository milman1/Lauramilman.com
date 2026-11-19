/**
 * LMNY — product and contact-page inquiries.
 *
 * POST /inquiry
 *   Saves or updates a Shopify customer tagged "Inquiry" and "Website form",
 *   with the piece and the question in the customer note. Marketing consent
 *   stays off unless the shopper ticked the box.
 *   Then sends a confirmation from hello@lauramilman.com, BCC'd to that same
 *   address, so the thread lives in one inbox. A failed send does not undo
 *   the customer.
 *
 * Secrets (Cloudflare dashboard → lauramilman-com → Settings). Secrets
 * survive deploys; do not put them in wrangler.jsonc.
 *   SHOPIFY_ADMIN_TOKEN    Admin API token with read_customers, write_customers
 *   RESEND_API_KEY         Resend key for the lauramilman.com domain
 *   SHOPIFY_STORE_DOMAIN   the shop's myshopify host
 *
 * The sending domain must be verified in Resend before mail is delivered.
 * DNS for that lives on the send subdomain and the DKIM host, not on the
 * Google MX that receives hello@.
 */

import { allowedOrigins } from './engraving-render.js';

export const INQUIRY_ROUTE = '/inquiry';
export const INQUIRY_TAGS = ['Inquiry', 'Website form'];
export const STORE_EMAIL = 'hello@lauramilman.com';
export const FROM_ADDRESS = `Laura Milman New York <${STORE_EMAIL}>`;
export const NOTE_LIMIT = 5000;

const PUBLIC_ORIGINS = ['https://lauramilman.com', 'https://www.lauramilman.com'];
const PUBLIC_HOSTS = new Set(PUBLIC_ORIGINS.map((origin) => new URL(origin).host));
const API_VERSION = '2026-01';
const IP_CAP = 8;
const DAY_CAP = 400;

const FIND_CUSTOMER = `query FindInquiryCustomer($query: String!) {
  customers(first: 1, query: $query) {
    nodes { id note }
  }
}`;

const CREATE_CUSTOMER = `mutation CreateInquiryCustomer($input: CustomerInput!) {
  customerCreate(input: $input) {
    customer { id }
    userErrors { field message }
  }
}`;

const UPDATE_CUSTOMER = `mutation UpdateInquiryCustomer($input: CustomerInput!) {
  customerUpdate(input: $input) {
    customer { id }
    userErrors { field message }
  }
}`;

const ADD_TAGS = `mutation TagInquiryCustomer($id: ID!, $tags: [String!]!) {
  tagsAdd(id: $id, tags: $tags) {
    node { id }
    userErrors { field message }
  }
}`;

const SET_CONSENT = `mutation InquiryEmailConsent($input: CustomerEmailMarketingConsentUpdateInput!) {
  customerEmailMarketingConsentUpdate(input: $input) {
    customer { id }
    userErrors { field message }
  }
}`;

function oneLine(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function questionText(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 2000);
}

export function normalizePhone(raw) {
  const trimmed = oneLine(raw, 40);
  if (!trimmed) return '';
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return '';
}

function shopDomain(env) {
  return String((env && env.SHOPIFY_STORE_DOMAIN) || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}

function allowedPieceHosts(env) {
  const hosts = new Set(PUBLIC_HOSTS);
  const shop = shopDomain(env);
  if (shop) hosts.add(shop);
  return hosts;
}

function pieceUrl(raw, env) {
  if (typeof raw !== 'string' || !raw || raw.length > 500) return '';
  let url;
  try {
    url = new URL(raw);
  } catch {
    return '';
  }
  if (url.protocol !== 'https:' || !allowedPieceHosts(env).has(url.host)) return '';
  url.hash = '';
  return url.toString();
}

export function validateInquiry(body, env) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad_request' };
  const firstName = oneLine(body.first_name, 80);
  const lastName = oneLine(body.last_name, 80);
  const email = oneLine(body.email, 254).toLowerCase();
  const phone = oneLine(body.phone, 40);
  const question = questionText(body.question);
  if (!firstName) return { ok: false, error: 'first_name_required' };
  if (!lastName) return { ok: false, error: 'last_name_required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'email_invalid' };
  if (!question) return { ok: false, error: 'question_required' };
  if (phone && !/^[0-9+().\-\s]+$/.test(phone)) return { ok: false, error: 'phone_invalid' };

  let piece = null;
  if (body.piece != null) {
    if (typeof body.piece !== 'object' || Array.isArray(body.piece)) return { ok: false, error: 'piece_invalid' };
    const title = oneLine(body.piece.title, 180);
    if (!title) return { ok: false, error: 'piece_title_required' };
    const url = body.piece.url ? pieceUrl(body.piece.url, env) : '';
    if (body.piece.url && !url) return { ok: false, error: 'piece_url_invalid' };
    piece = {
      title,
      variant: oneLine(body.piece.variant, 180),
      sku: oneLine(body.piece.sku, 80),
      price: oneLine(body.piece.price, 40),
      url,
    };
  }

  return {
    ok: true,
    value: {
      firstName,
      lastName,
      email,
      phone,
      question,
      marketing: body.marketing === true,
      piece,
    },
  };
}

export function buildCustomerNote(inquiry, existingNote, nowIso) {
  const lines = [
    'Website inquiry',
    `When: ${nowIso}`,
    `Name: ${inquiry.firstName} ${inquiry.lastName}`,
    `Email: ${inquiry.email}`,
  ];
  if (inquiry.phone) lines.push(`Phone: ${inquiry.phone}`);
  lines.push(`Email marketing: ${inquiry.marketing ? 'yes' : 'no'}`);
  if (inquiry.piece) {
    lines.push(`Piece: ${inquiry.piece.title}`);
    if (inquiry.piece.variant) lines.push(`Variant: ${inquiry.piece.variant}`);
    if (inquiry.piece.sku) lines.push(`SKU: ${inquiry.piece.sku}`);
    if (inquiry.piece.price) lines.push(`Price: ${inquiry.piece.price}`);
    if (inquiry.piece.url) lines.push(`URL: ${inquiry.piece.url}`);
  } else {
    lines.push('Piece: general inquiry');
  }
  lines.push('Question:', inquiry.question);
  const block = lines.join('\n');
  const prior = String(existingNote || '').trim();
  if (!prior) return block.slice(0, NOTE_LIMIT);
  const combined = `${prior}\n\n---\n${block}`;
  if (combined.length <= NOTE_LIMIT) return combined;
  const marker = 'Earlier note shortened.\n';
  const room = NOTE_LIMIT - block.length - marker.length - 6;
  const tail = room > 0 ? prior.slice(-room) : '';
  return `${marker}${tail}\n\n---\n${block}`.slice(0, NOTE_LIMIT);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

export function buildInquiryEmail(inquiry) {
  const title = inquiry.piece ? inquiry.piece.title : '';
  const subject = title
    ? `Your question about the ${title}`.slice(0, 180)
    : 'Your question for Laura Milman New York';
  const pieceLines = [];
  if (inquiry.piece) {
    pieceLines.push(inquiry.piece.title);
    if (inquiry.piece.variant) pieceLines.push(`Variant: ${inquiry.piece.variant}`);
    if (inquiry.piece.sku) pieceLines.push(`SKU: ${inquiry.piece.sku}`);
    if (inquiry.piece.price) pieceLines.push(`Price: ${inquiry.piece.price}`);
    if (inquiry.piece.url) pieceLines.push(inquiry.piece.url);
  }
  const text = [
    `Hello ${inquiry.firstName},`,
    '',
    'Thank you for writing to Laura Milman New York. A member of our team will reply shortly in this thread.',
    '',
    'Your question:',
    inquiry.question,
    '',
    inquiry.piece ? 'About this piece:' : 'This note did not name a piece.',
    ...pieceLines,
    '',
    'Laura Milman New York',
    'Midtown, New York City',
    STORE_EMAIL,
  ].join('\n');

  const pieceHtml = inquiry.piece
    ? `<p style="margin:0 0 6px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#8A8070;">About this piece</p>
       <p style="margin:0;font-size:16px;line-height:1.5;">${escapeHtml(inquiry.piece.title)}</p>
       ${inquiry.piece.variant ? `<p style="margin:6px 0 0;font-size:14px;line-height:1.5;">${escapeHtml(inquiry.piece.variant)}</p>` : ''}
       ${inquiry.piece.sku ? `<p style="margin:6px 0 0;font-size:14px;line-height:1.5;">SKU ${escapeHtml(inquiry.piece.sku)}</p>` : ''}
       ${inquiry.piece.price ? `<p style="margin:6px 0 0;font-size:14px;line-height:1.5;">${escapeHtml(inquiry.piece.price)}</p>` : ''}
       ${inquiry.piece.url ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.5;"><a href="${escapeHtml(inquiry.piece.url)}" style="color:#4A1428;">${escapeHtml(inquiry.piece.url)}</a></p>` : ''}`
    : '<p style="margin:0;font-size:14px;line-height:1.5;">This note did not name a piece.</p>';

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#FAF6F0;color:#2C1810;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Georgia,'Times New Roman',serif;">
    <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#8A8070;">Laura Milman New York</p>
    <h1 style="margin:0 0 16px;font-weight:400;font-size:28px;line-height:1.2;">Thank you for writing.</h1>
    <p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;">Hello ${escapeHtml(inquiry.firstName)}, a member of our team will reply shortly in this thread.</p>
    <div style="margin:0 0 20px;padding:16px 18px;background:#ffffff;border:1px solid #DDD5C5;">
      <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#8A8070;">Your question</p>
      <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(inquiry.question)}</p>
    </div>
    <div style="margin:0 0 24px;padding:16px 18px;background:#ffffff;border:1px solid #DDD5C5;">
      ${pieceHtml}
    </div>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#8A8070;">Laura Milman New York<br>Midtown, New York City<br>${STORE_EMAIL}</p>
  </div>
</body>
</html>`;

  const to = inquiry.email;
  const bcc = to === STORE_EMAIL ? [] : [STORE_EMAIL];
  return { from: FROM_ADDRESS, to: [to], bcc, replyTo: STORE_EMAIL, subject, html, text };
}

export function inquiryCors(origin, env) {
  const allowed = new Set([...allowedOrigins(env), ...PUBLIC_ORIGINS]);
  const shop = shopDomain(env);
  if (shop) allowed.add(`https://${shop}`);
  const headers = { Vary: 'Origin' };
  if (origin && allowed.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Accept';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

function json(status, payload, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function shopHost(env) {
  return shopDomain(env);
}

async function shopify(env, query, variables, fetchImpl) {
  const res = await fetchImpl(`https://${shopHost(env)}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || (body.errors && body.errors.length)) {
    const message = (body.errors && body.errors[0] && body.errors[0].message) || `shopify_${res.status}`;
    throw new Error(message);
  }
  return body.data || {};
}

function userErrors(payload) {
  return (payload && payload.userErrors) || [];
}

function phoneProblem(errors) {
  return errors.some((error) => (error.field || []).includes('phone') || /phone/i.test(error.message || ''));
}

function emailTaken(errors) {
  return errors.some((error) => /taken/i.test(error.message || '') && (error.field || []).includes('email'));
}

async function findCustomer(email, env, fetchImpl) {
  const safe = email.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const data = await shopify(env, FIND_CUSTOMER, { query: `email:"${safe}"` }, fetchImpl);
  const nodes = data.customers && data.customers.nodes;
  return nodes && nodes[0] ? nodes[0] : null;
}

function consentInput(customerId) {
  return {
    customerId,
    emailMarketingConsent: {
      marketingState: 'SUBSCRIBED',
      marketingOptInLevel: 'SINGLE_OPT_IN',
      consentUpdatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Create or update the customer. Marketing consent is written only when the
 * shopper opted in. A phone Shopify will not store is kept in the note and
 * omitted from the phone field on a retry.
 */
export async function saveInquiryCustomer(inquiry, env, fetchImpl, nowIso) {
  const existing = await findCustomer(inquiry.email, env, fetchImpl);
  const note = buildCustomerNote(inquiry, existing && existing.note, nowIso);
  const phone = normalizePhone(inquiry.phone);

  if (!existing) {
    const input = {
      email: inquiry.email,
      firstName: inquiry.firstName,
      lastName: inquiry.lastName,
      note,
      tags: INQUIRY_TAGS,
    };
    if (phone) input.phone = phone;
    if (inquiry.marketing) input.emailMarketingConsent = consentInput(null).emailMarketingConsent;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const created = await shopify(env, CREATE_CUSTOMER, { input }, fetchImpl);
      const errors = userErrors(created.customerCreate);
      if (!errors.length && created.customerCreate.customer) {
        return { id: created.customerCreate.customer.id, created: true };
      }
      if (emailTaken(errors)) {
        return updateExisting(await findCustomer(inquiry.email, env, fetchImpl), inquiry, env, fetchImpl, nowIso, phone);
      }
      if (input.phone && phoneProblem(errors)) {
        delete input.phone;
        continue;
      }
      if (input.emailMarketingConsent && errors.some((error) => /consent|marketing/i.test(error.message || ''))) {
        delete input.emailMarketingConsent;
        continue;
      }
      throw new Error(errors.map((error) => error.message).join('; ') || 'customer_create_failed');
    }
    throw new Error('customer_create_failed');
  }

  return updateExisting(existing, inquiry, env, fetchImpl, nowIso, phone);
}

async function updateExisting(existing, inquiry, env, fetchImpl, nowIso, phone) {
  if (!existing) throw new Error('customer_missing');
  const note = buildCustomerNote(inquiry, existing.note, nowIso);
  const input = {
    id: existing.id,
    firstName: inquiry.firstName,
    lastName: inquiry.lastName,
    note,
  };
  if (phone) input.phone = phone;
  let updated = await shopify(env, UPDATE_CUSTOMER, { input }, fetchImpl);
  let errors = userErrors(updated.customerUpdate);
  if (phone && phoneProblem(errors)) {
    delete input.phone;
    updated = await shopify(env, UPDATE_CUSTOMER, { input }, fetchImpl);
    errors = userErrors(updated.customerUpdate);
  }
  if (errors.length) throw new Error(errors.map((error) => error.message).join('; '));
  const tagged = await shopify(env, ADD_TAGS, { id: existing.id, tags: INQUIRY_TAGS }, fetchImpl);
  const tagErrors = userErrors(tagged.tagsAdd);
  if (tagErrors.length) throw new Error(tagErrors.map((error) => error.message).join('; '));
  if (inquiry.marketing) {
    try {
      const consent = await shopify(env, SET_CONSENT, { input: consentInput(existing.id) }, fetchImpl);
      const consentErrors = userErrors(consent.customerEmailMarketingConsentUpdate);
      if (consentErrors.length) console.error('inquiry consent failed');
    } catch (err) {
      console.error('inquiry consent failed', err && err.message);
    }
  }
  return { id: existing.id, created: false };
}

async function sendConfirmation(inquiry, env, fetchImpl, idempotencyKey) {
  const message = buildInquiryEmail(inquiry);
  const payload = {
    from: message.from,
    to: message.to,
    reply_to: message.replyTo,
    subject: message.subject,
    html: message.html,
    text: message.text,
  };
  if (message.bcc.length) payload.bcc = message.bcc;
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`resend_${res.status}`);
}

async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function positiveInt(value) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function bump(kv, key, ttl) {
  const next = positiveInt(await kv.get(key)) + 1;
  await kv.put(key, String(next), { expirationTtl: ttl });
  return next;
}

export async function handleInquiry(request, env, ctx, fetchImpl = fetch) {
  void ctx;
  const origin = request.headers.get('Origin') || '';
  const cors = inquiryCors(origin, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, cors);
  if (!cors['Access-Control-Allow-Origin']) return json(403, { error: 'origin_not_allowed' }, cors);

  const claimed = Number(request.headers.get('Content-Length') || 0);
  if (claimed > 20000) return json(413, { error: 'too_large' }, cors);

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'bad_request' }, cors);
  }

  const kv = env.FEED_CACHE;
  const now = new Date();
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const hour = now.toISOString().slice(0, 13);
  const day = now.toISOString().slice(0, 10);
  if (kv) {
    if (positiveInt(await kv.get(`inquiry:ip:${ip}:${hour}`)) >= IP_CAP) {
      return json(429, { error: 'rate_limited' }, cors);
    }
    if (positiveInt(await kv.get(`inquiry:day:${day}`)) >= DAY_CAP) {
      return json(429, { error: 'rate_limited' }, cors);
    }
  }

  const trap = body && typeof body.company_website === 'string' ? body.company_website.trim() : '';
  if (trap) {
    if (kv) {
      await Promise.all([
        bump(kv, `inquiry:ip:${ip}:${hour}`, 2 * 3600),
        bump(kv, `inquiry:day:${day}`, 2 * 86400),
      ]);
    }
    return json(200, { ok: true }, cors);
  }

  const checked = validateInquiry(body, env);
  if (!checked.ok) return json(400, { error: checked.error }, cors);
  const inquiry = checked.value;
  if (kv) {
    await Promise.all([
      bump(kv, `inquiry:ip:${ip}:${hour}`, 2 * 3600),
      bump(kv, `inquiry:day:${day}`, 2 * 86400),
    ]);
  }

  if (!env.SHOPIFY_ADMIN_TOKEN || !shopDomain(env)) return json(503, { error: 'not_configured' }, cors);

  const hash = await digest([inquiry.email, inquiry.question, inquiry.piece ? inquiry.piece.title : '', inquiry.piece ? inquiry.piece.variant : ''].join('\n'));
  if (kv) {
    const done = await kv.get(`inquiry:done:${hash}`);
    if (done) {
      try {
        return json(200, JSON.parse(done), cors);
      } catch {
        return json(200, { ok: true }, cors);
      }
    }
    if (await kv.get(`inquiry:lock:${hash}`)) return json(200, { ok: true, duplicate: true }, cors);
    await kv.put(`inquiry:lock:${hash}`, '1', { expirationTtl: 60 });
  }

  let saved;
  try {
    saved = await saveInquiryCustomer(inquiry, env, fetchImpl, now.toISOString());
  } catch (err) {
    if (kv && kv.delete) await kv.delete(`inquiry:lock:${hash}`);
    console.error('inquiry customer save failed', err && err.message);
    return json(502, { error: 'customer_save_failed' }, cors);
  }

  let emailed = false;
  if (env.RESEND_API_KEY) {
    try {
      await sendConfirmation(inquiry, env, fetchImpl, hash);
      emailed = true;
    } catch (err) {
      console.error('inquiry confirmation failed', err && err.message);
    }
  }
  const result = { ok: true, emailed, created: saved.created };
  if (kv) await kv.put(`inquiry:done:${hash}`, JSON.stringify(result), { expirationTtl: 86400 });
  return json(200, result, cors);
}
