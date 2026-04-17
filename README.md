# Laurel & Gold — Shopify Theme

A luxury Shopify theme inspired by the editorial aesthetic of peacefuldiamonds.com,
rendered in a palette of dark green, brown, gold, and beige.

## Palette

| Token | Hex | Role |
| --- | --- | --- |
| `color_primary` | `#2B4033` | Dark green (headings, buttons, accents) |
| `color_secondary` | `#5C4332` | Brown (footer, secondary surfaces) |
| `color_accent` | `#C9A961` | Gold (highlights, CTAs, dividers) |
| `color_background` | `#EDE4D0` | Beige (page background) |
| `color_surface` | `#F7F1E3` | Soft surface (cards, media placeholders) |

All colors are editable in Shopify admin under **Theme settings → Colors**.

## Typography

- **Headings:** Cormorant Garamond (serif)
- **Body:** Inter (sans)

Both loaded from Google Fonts in `layout/theme.liquid`.

## Structure

```
assets/           theme.css, theme.js
config/           settings_schema.json, settings_data.json
layout/           theme.liquid (base HTML)
locales/          en.default.json
sections/         announcement-bar, header, footer, hero, featured-collection,
                  image-with-text, rich-text, testimonials, newsletter,
                  main-product, main-collection, main-cart, main-page, main-404
snippets/         product-card, price, icon-*
templates/        index.json, product.json, collection.json, cart.json,
                  page.json, 404.json, search.liquid, blog.liquid,
                  article.liquid, list-collections.liquid
```

## Install

1. Zip the repo root (must contain `layout/`, `templates/`, etc. at the top level).
2. In Shopify admin: **Online Store → Themes → Add theme → Upload zip file**.
3. Preview, then customize copy, imagery, and menus in the theme editor.

## Local development

Use the [Shopify CLI](https://shopify.dev/docs/themes/tools/cli):

```bash
shopify theme dev --store your-store.myshopify.com
```

## Customizing

- **Homepage:** edit sections live in the Shopify theme editor, or edit
  `templates/index.json`.
- **Colors/fonts:** **Theme settings** in the editor.
- **Menus:** set navigation under **Online Store → Navigation**, then assign in
  the Header and Footer sections.

## Notes

- The cart uses the standard Shopify cart form and checkout flow.
- Product page renders variants as radio pills and includes a quantity stepper.
- All sections support the theme editor (`{% schema %}` blocks included).
