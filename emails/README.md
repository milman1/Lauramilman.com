# Branded emails — Laura Milman New York

Paste-ready HTML/Liquid. Shopify Messaging (Marketing → Automations) cannot
replace locked system blocks, so recovery and order mail go in
**Settings → Notifications → Edit code**. Welcome is a Custom Liquid card
inside Messaging, or the full document in Klaviyo.

The storefront already captures the address (popup, homepage newsletter, and
email-signup banner). These files brand the mail that follows.

## Where to paste

| File | Paste here | Editor |
|------|------------|--------|
| `welcome.messaging-block.html` | Marketing → Automations → Welcome new subscribers → **Custom Liquid** | Inner card only. Messaging keeps its own shell. |
| `welcome.html` | Klaviyo (optional) if you want a clean full-document welcome | Full HTML. Do not paste into Messaging. |
| `abandoned-checkout.html` | **Settings → Notifications → Abandoned checkout → Edit code** | Full document replacement |
| `abandoned-cart.html` | Same Abandoned checkout template if there is no separate cart notification, or Abandoned cart → Edit code if it exists | Full document replacement |
| `order-confirmation.html` | Settings → Notifications → Order confirmation → Edit code | Full document replacement |
| `shipping-confirmation.html` | Settings → Notifications → Shipping confirmation | Full document replacement |
| `customer-account-welcome.html` | Settings → Notifications → Customer account welcome | Full document replacement |
| `customer-account-invite.html` | Settings → Notifications → Customer account invite | Full document replacement |

Turn **off** the Shopify Messaging abandoned-cart / abandoned-checkout automations after the Notifications templates are live, or customers get two emails.

Hold requests still land in **Admin → Inbox**.

## 1. Welcome on subscribe

Messaging will not accept `welcome.html` as a replacement. Use the inner card:

1. Confirm discount `LMNYWELCOME` exists (see `SHOPIFY_SETUP.md` §6).
2. **Marketing → Automations → Welcome new subscribers**.
3. From: Laura Milman New York `<hello@lauramilman.com>`.
4. Subject: `Your inner-circle welcome — 10% off jewelry`.
5. Add a **Custom Liquid** section and paste `emails/welcome.messaging-block.html`.
6. Leave Shopify’s unsubscribe footer in the automation shell.
7. Send a test, then keep the automation **on**.

The popup and newsletter already tag `newsletter,welcome10`. The on-page success message still shows the code if mail is delayed.

Optional: paste `emails/welcome.html` into Klaviyo for a full-document send. That is not required if the Custom Liquid card is enough.

## 2. Abandoned checkout and cart

These belong in **Settings → Notifications**, the same raw HTML editor as order confirmation — not Messaging.

1. **Settings → Notifications → Customer notifications → Abandoned checkout**.
2. **Edit code**. Replace the HTML body with `emails/abandoned-checkout.html`.
3. Preview a real abandoned checkout. Confirm the first name and **Return to checkout** (`{{ url }}`) render.
4. Save. Leave the notification **enabled**.
5. In **Marketing → Automations**, pause or turn off “You left items in your cart” / abandoned checkout so they do not double-send.

If Admin also lists a separate Abandoned cart notification, paste `emails/abandoned-cart.html` there. Otherwise use the checkout template only (`abandoned-checkout.html`).

## 3. Order, shipping, and account emails

1. **Settings → Notifications → Customer notifications**.
2. Open the template → **Edit code**.
3. Replace the HTML body with the matching file.
4. **Preview** with a recent order, then save. The order id is `{{ name }}` (for example `#1001`). Do not use `order.name`.
5. Verify the sender is `hello@lauramilman.com`.

Do this for order confirmation, shipping confirmation, customer account welcome, and customer account invite.

Update **Settings → Policies → Refund policy** so it matches the 14-day jewelry / watches-exchange-only copy on `/pages/shipping-returns`.

## 4. Store details

Every Notifications template prints `shop.address.*`. Set **Settings → General → Store address**. Empty fields fall back to “New York, NY · By appointment”.

## 5. What not to change

- Do not paste full HTML documents into Shopify Messaging automations.
- Do not add `LMNYWELCOME` to order, shipping, or abandoned recovery mail.
- `welcome.html` keeps `{{ unsubscribe_url }}` for Klaviyo / raw marketing editors. The Messaging block does not, because the automation shell already unsubscribes.

## Preview

Open `emails/preview/index.html` in a browser to see sample-data renders. Do not paste preview files into Shopify.
