# Branded emails — Laura Milman New York

Shopify **Basic** cannot edit abandoned checkout/cart in Settings →
Notifications (`abandoned_checkout` 404s). Messaging cannot replace locked
system blocks. So:

- Order / shipping / account → Notifications, full HTML (Edit code)
- Abandoned cart / checkout / welcome → Messaging **Custom Liquid** cards
- Keep the Active Messaging cart automation **on**. Pausing it stops recovery
  mail entirely on Basic. There is no second Notifications template to
  double-send with.

## Status

| Mail | Status |
|------|--------|
| Order confirmation | Live in Notifications |
| Shipping confirmation | Live in Notifications |
| Abandoned checkout Notifications slug | 404 on Basic — skip |
| Abandoned cart Messaging automation | Active — add Custom Liquid, do not Draft |
| Customer account welcome | Still to paste in Notifications |
| Customer account invite | Still to paste in Notifications |
| Welcome subscribers | Still to paste as Custom Liquid |

## Where to paste

| File | Paste here |
|------|------------|
| `welcome.messaging-block.html` | Marketing → Automations → Welcome new subscribers → **Custom Liquid** |
| `abandoned-cart.messaging-block.html` | Marketing → Automations → **You left items in your cart** → **Custom Liquid**. Keep **Active**. |
| `abandoned-checkout.messaging-block.html` | Marketing → Automations → Abandoned checkout → Custom Liquid, only if that automation exists separately |
| `customer-account-welcome.html` | Settings → Notifications → Customer account welcome → Edit code |
| `customer-account-invite.html` | Settings → Notifications → Customer account invite → Edit code |
| `order-confirmation.html` | Already saved |
| `shipping-confirmation.html` | Already saved |
| `welcome.html` | Optional Klaviyo full document. Not Messaging. |
| `abandoned-checkout.html` / `abandoned-cart.html` | Optional Klaviyo or a plan that exposes the Notifications slug |

## 1. Welcome on subscribe

1. Confirm `LMNYWELCOME` exists (`SHOPIFY_SETUP.md` §6).
2. **Marketing → Automations → Welcome new subscribers**.
3. From: Laura Milman New York `<hello@lauramilman.com>`.
4. Subject: `Your inner-circle welcome — 10% off jewelry`.
5. Add **Custom Liquid** and paste `emails/welcome.messaging-block.html`.
6. Leave Shopify’s unsubscribe footer. Send a test. Keep the automation on.

## 2. Abandoned cart (Basic)

The locked product block stays. Brand the copy around it:

1. Open **You left items in your cart** (currently Active).
2. Add **Custom Liquid** and paste `emails/abandoned-cart.messaging-block.html`.
3. Preview the first name and **View cart** URL.
4. Save. Leave the automation **Active**. Do not set it to Draft.

If a separate Abandoned checkout automation exists, paste
`abandoned-checkout.messaging-block.html` there the same way. If it does not,
the cart automation is the only recovery email.

## 3. Account emails

**Settings → Notifications → Edit code** for customer account welcome and
invite. Preview, then save. Sender: `hello@lauramilman.com`.

## 4. Store details

Notifications templates print `shop.address.*`. Set **Settings → General →
Store address**. Empty fields fall back to “New York, NY · By appointment”.

## Preview

Open `emails/preview/index.html` in a browser. Do not paste preview files into
Shopify.
