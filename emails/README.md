# Branded emails — Laura Milman New York

Paste-ready HTML/Liquid for Shopify Email automations and Shopify notification templates. Shopify sends these automatically once each template is installed and the matching automation is **on**.

The storefront already captures the address (popup, homepage newsletter, and email-signup banner). These files brand the mail that follows.

## What sends, and when

| File | Channel | Trigger (automatic) |
|------|---------|---------------------|
| `welcome.html` | Shopify Email · Code your own | Customer subscribes to email marketing (Inner Circle / popup / newsletter) |
| `abandoned-checkout.html` | Shopify Email · Code your own | Checkout started, not completed |
| `abandoned-cart.html` | Shopify Email · Code your own | Items left in cart |
| `order-confirmation.html` | Settings → Notifications | Order paid / placed |
| `shipping-confirmation.html` | Settings → Notifications | Fulfillment ships |
| `customer-account-welcome.html` | Settings → Notifications | Customer activates an account |
| `customer-account-invite.html` | Settings → Notifications | Customer is invited to activate |

Hold requests and private-viewing forms still land in **Admin → Inbox**. Do not send those as Shopify Email marketing unless the customer also opted in.

## 1. Welcome email on subscribe (do this first)

1. Confirm discount `LMNYWELCOME` exists (see `SHOPIFY_SETUP.md` §6).
2. Shopify Admin → **Marketing → Automations**.
3. Create or open **Welcome new subscribers** (sometimes labeled Customer welcome).
4. Set:
   - **From:** Laura Milman New York `<hello@lauramilman.com>` (use a sending address on your verified domain).
   - **Subject:** `Your inner-circle welcome — 10% off jewelry`
   - **Preview:** `Your code is LMNYWELCOME. Jewelry only, one use.`
5. Choose **Code your own** (or Custom Liquid) and paste `emails/welcome.html` in full.
6. Send a test to yourself, then **turn the automation on**.

The homepage popup and newsletter already tag the customer `newsletter,welcome10` and accept marketing. Shopify Email fires when marketing consent is recorded.

## 2. Abandoned checkout and cart

Same path: **Marketing → Automations**.

- Abandoned checkout → paste `emails/abandoned-checkout.html`. Subject: `You left something behind`.
- Abandoned cart → paste `emails/abandoned-cart.html`. Subject: `Your cart is still here`.

Leave Shopify’s delay defaults (often 1 hour for checkout, a few hours for cart). After pasting, **preview** a real abandoned checkout/cart and confirm the first name and the button URL render before you turn the automation on. Shopify Email sometimes exposes `first_name` instead of `customer.first_name`, and `abandoned_checkout_url` / `cart_url` instead of the object URLs — the templates accept both.

## 3. Order, shipping, and account emails

Shopify already sends these. Replacing the body brands them.

1. **Settings → Notifications → Customer notifications**.
2. Open the template → **Edit code**.
3. Replace the HTML body with the matching file. Keep Shopify’s subject line, or use the subject noted in the file’s HTML comment.
4. **Preview** with a recent order, then save. The order id is `{{ name }}` (for example `#1001`). Do not use `order.name`.

Do this for:

- Order confirmation
- Shipping confirmation
- Customer account welcome
- Customer account invite

Update **Settings → Policies → Refund policy** so it matches the 14-day jewelry / watches-exchange-only copy on `/pages/shipping-returns`.

## 4. Store details (required for the footer)

Every template prints `shop.address.*`. Set a real postal address under **Settings → General → Store address**. If the fields are empty, the emails fall back to “New York, NY · By appointment”.

## 5. What not to change

- Marketing templates must keep `{{ unsubscribe_url }}` and `{{ open_tracking }}` / `{{ open_tracking_block }}`. Shopify rejects custom-coded emails without them.
- Do not add `LMNYWELCOME` to order or shipping mail. Those are receipts, not offers.
- Newsletter signup is marketing. Order and shipping mail is transactional (no unsubscribe link).

## Preview

Open `emails/preview/index.html` in a browser to see sample-data renders of each template. Do not paste preview files into Shopify.
