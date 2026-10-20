# Influencer program

Public page: https://www.lauramilman.com/pages/influencer-program
Theme template: `templates/page.creator-program.json`
Applications arrive at hello@lauramilman.com. The form also tags the customer `creator-applicant`.

The page states the offer. This file is how to run it. Do not put a supplier name, a cost, or a creator's payout details on the store.

## Offer

| | |
|---|---|
| Scope | Loose lab-grown diamonds, lab-grown diamond jewelry, and gold jewelry |
| Customer discount | 10% off, one use per customer, does not combine with any other discount |
| Collections | Lab-Grown Diamonds, Lab-Grown Diamond Jewelry, Gold Jewelry |
| Creator commission | 10% of what the customer paid for eligible pieces in those three collections, after the code, before tax and shipping |
| Payment | Once a month, after the 7-day return window. Balance carries until it reaches $50. A return is deducted. |
| Gift | One piece the creator chooses, from loose lab-grown diamonds, lab-grown diamond jewelry, or gold jewelry, kept by them |
| Not gifted | The sterling silver lab-grown hoops SKU `ERSLHPRD200P` |
| Post | If they take a piece: one feed post or Reel and two Stories in the 14 days after it arrives. Tag @laurasgemsnyc. Disclose the gift and the code. A code alone does not require a post. |

`LMNYWELCOME` is 10% off 28 collections and does not combine with other discounts. A creator code uses the same rule, so a customer can use one code, not both.

Gold jewelry on the code is the Gold Jewelry collection (`gold-jewelry`): the gold chains, rings, and bracelets in that collection. One active 14K chain extender, SKU `CH014-03`, sits in Chains and is not tagged `gold-jewelry`. Add Chains to that creator's code, or tag the extender `gold-jewelry`, if that extender should stay eligible.

There is no commission cap. A large loose lab-grown diamond pays 10% of the discounted price. Add a cap in the terms before promising one.

`/influencer` is not a redirect in this theme. Add it in Shopify admin → Online Store → Navigation → URL redirects: path `/influencer`, target `/pages/influencer-program`.

## When you accept someone

1. Reply from hello@lauramilman.com with their code, the posting rules, and how you will pay them.
2. Shopify admin → Discounts → Create discount → Amount off products.
   - Code: their name, letters and numbers only, uppercase, such as `JORDAN10`.
   - 10%.
   - Specific collections: Lab-Grown Diamonds, Lab-Grown Diamond Jewelry, and Gold Jewelry. Add Chains only for the extender note above.
   - Combinations: off for product, order, and shipping discounts.
   - Limit to one use per customer. No minimum purchase. No end date.
3. Tag the customer `creator-active`. Write the code and the payout method in the customer note.
4. If they want a piece, let them choose one piece from loose lab-grown diamonds, lab-grown diamond jewelry, or gold jewelry. Create a draft order, discount that line to zero, and write `creator gift` in the order note. Do not write what the house paid in the note or on the page. Do not gift the sterling silver hoops SKU `ERSLHPRD200P`. A code with no gift is allowed.
5. If the creator's own email uses the code, do not pay commission on that order.

## When you pay

Once a month, filter orders by that discount code.

- Skip an order still inside 7 days of delivery.
- Skip refunded eligible items.
- Commission is 10% of the discounted merchandise total on eligible lines only.
- Pay when the unpaid balance is at least $50.
- Write the payout date and amount in the customer note.

## Who to look for

Instagram and TikTok only. Search `lab grown diamond`, `gold chain`, and `gold jewelry`, and open the videos. Save accounts whose recent posts show lab-grown diamonds or gold on a person, with comments asking where to buy. Skip watch and estate accounts.

## What the page already does

The form requires a name, email, Instagram, a recent post, a note, and agreement to the terms. It copies those fields into the message so the notification email is complete, and it tags the email `creator-applicant`.
