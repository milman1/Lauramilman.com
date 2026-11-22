# Midas mountings → ring settings: intake

Merchant decision 2026-11-22: Midas engagement mountings are sold as **ring settings**
(no center stone), priced with the settings rule, **cost × 2.25** (setting labor included).
Code: `lmny-feeds/config/pricing.ts` `MIDAS_SETTINGS`; row in `AGENTS.md`.

## What to export from the Midas trade account

One row per item and metal in `midas-settings-intake.csv`:

| Column | Why |
|---|---|
| item_number | Becomes SKU `MC-<item>` (sizes add `-<size>`) |
| style | Solitaire, Hidden Halo, Halo, Three-Stone, East-West… (drives the style tag) |
| center_shape | From the supplier record only; never guessed from the SKU |
| center_size_range_ct | Compatible center sizes; left blank if unknown, never guessed |
| metal | 14K / 18K / platinum and color |
| trade_cost_usd | Your cost for that metal. Retail = round(cost × 2.25) |
| accent_diamond_ct, accent_origin | Side-stone weight and natural or lab; origin defaults to natural unless stated lab |
| sizes_available, made_to_order | Ring size buttons and inventory tracking |
| product_page_url | Source evidence and photos |

## What happens next

1. Add each center shape to `lmny-feeds/src/settingCenterShape.ts`.
2. Create each setting as a **DRAFT** via `npm run jewelry:gate -- draft`: tag `ring-setting` + style + shape + `mc-import`, vendor Laura Milman New York, no supplier name anywhere.
3. Settings land in `ring-settings` (not the new style and shape collections, which exclude `ring-setting`).
4. Activation only through the jewelry gate, with the merchant's sign-off on each product.

Priority: East-West, Halo, Three-Stone (the thinnest styles).
