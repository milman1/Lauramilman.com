# LMNY — Margin / mobile fix pass

Applied on top of `claude/session-stdgfv`, the branch the **published** theme
(`Lauramilman.com/claude/session-stdgfv`) tracks via Shopify's GitHub integration.

An earlier pass was mistakenly built on `main`, which is 15 commits and ~123k lines
behind the live branch. That work was discarded; everything here was re-derived
against the live code and measured in a headless Chromium.

## Root cause of the margin complaints

**Seven different container widths.** Header and footer sat at 1400px, the collection
and search grids at 1320px, six sections at 1280px, five at 1200px, plus 1120px and
1100px. Scrolling the homepage, the content edge stepped 1320 → 1280 → 1200 → 1280 →
1200 while the logo stayed at 1400.

Compounding it, nine sections applied their horizontal padding to the *outer* element
and then centred an inner `max-width` box. Because `.container` is border-box (padding
inside the max-width), those sections landed 32px further left than the header at wide
viewports even when the max-width matched.

**Fixed:** one `--container-max: 1320px` for every page-level container, and the gutter
moved inside the max-width box so every section resolves to the same content edge.

| Viewport | Logo | Section content edges (7 homepage sections) |
|---|---|---|
| 1440px | 92px | all 92px |
| 1280px | 32px | all 32px |
| 390px | 16px | all 16px |

## The fixed header under-reserved its own height

`--header-height` declared **84px** and drove `body { padding-top }`, but the bar
actually rendered **113px** (an 80px `.header__inner` plus `1rem` top/bottom padding on
`.header`). Every page was short by **29px** — the cart page's title sat behind the bar,
and the collection page cleared it by only 7px on mobile.

**Fixed:** `.header__inner { height: var(--header-height) }` and the vertical padding
removed, so the bar is exactly the height the token promises. Also removed the stale
light `border-bottom` from `theme.css` §5, which drew a pale hairline under the dark bar
and added the 1px that kept it off by one.

| | Before | After |
|---|---|---|
| Desktop bar | 113px actual vs 84px declared | 84px, matches |
| Mobile bar | 93px actual vs 64px declared | 64px, matches |
| Cart content hidden | 29px at every width | clear by 48px |

## Mobile

- **Wordmark wrapped to two lines on every phone** (320–429px) and spilled out of the
  header band. At 1.75rem it needs ~166px; the icon row plus burger left 68–138px.
  Now `white-space: nowrap`, 1.3rem on mobile, 40px icons with a tighter gap — one line
  from 320px up.
- **Header gutter was a hardcoded `2rem`** at every width, so the logo sat 16px further
  in than page content on phones. Now uses `--container-padding`.
- **With the drawer open, the icon row and burger rendered on top of it** (z-index 1003
  vs 1002), colliding with the "Menu" heading and stacking a second X beside the
  drawer's own close button. A `.header--nav-open` class now hides both; verified
  exactly one visible close control at 320/375/390px, and the open→close cycle restores
  the bar.
- Below 380px there is no room for three icons, so **Account** moves into the drawer.

## Cart page had no CSS at all

`templates/cart.liquid` referenced `.cart-page`, `.cart-layout`, `.cart-items`,
`.cart-item`, `.cart-summary`, `.cart-empty` and friends — none defined anywhere in the
theme. Added the stylesheet: grid line items, sticky order summary, and stacked cards
below 768px.

## Verified

Headless Chromium at 320 / 390 / 1280 / 1440px on the collection, cart and homepage
sections: header exactly 84/64px, positive clearance on every page, one content edge
shared with the logo at every width, no horizontal scroll. All JSON and section schemas
parse; Liquid tag pairs and CSS braces balance across 189 Liquid files.

## Not done here

- The other container widths (1120px on About, 1100px on newsletter / ring-builder /
  private-client) are narrower editorial measures on their own pages. They are
  internally consistent, so they were left alone rather than widened blind.
- `settings_data.json` still stores `logo_position`, `sticky_header`, `show_cart_count`,
  `show_social`, `show_newsletter`, `copyright_text` for the header and footer sections.
  None exist in either schema, so all six are ignored.
