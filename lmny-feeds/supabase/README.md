# LMNY stones — Supabase project notes

**Project:** `lmny-stones` (`smwdrjpmuvwosepphufj`)  
**Region:** us-east-1  
**URL:** https://smwdrjpmuvwosepphufj.supabase.co

## What is live

| Piece | Status |
|---|---|
| `public.stones` | Seeded from Shopify Ajax (~17.9k rows: ~15.4k lab, ~2.5k natural) |
| `public.reservations` | Ready for inquiry/reserve |
| Edge Function `diamonds` | Search + single-stone lookup (JWT verify off; RLS on read) |
| Edge Function `reserve-diamond` | Inquiry/reserve (service role insert) |

## GitHub Actions secrets to add

For ongoing dual-write from the hourly sync (authoritative costs/certs):

```
SUPABASE_URL=https://smwdrjpmuvwosepphufj.supabase.co
SUPABASE_SERVICE_KEY=<service_role key from project settings>
```

Until those are set, the Shopify seed is the working copy; the next live sync
with secrets will upsert richer rows (cost, cert URLs, exact hashes).

## App Proxy (optional hardening)

In the LMNY Shopify app, point:

```
/apps/diamonds  →  https://smwdrjpmuvwosepphufj.supabase.co/functions/v1/diamonds
```

Then set the theme section `api_base_url` to `/apps/diamonds` and clear
`api_anon_key` (proxy forwards without exposing the key in Liquid).

## Do not delete Shopify feed products yet

Confirm the filter on a theme preview first. Bulk-delete of `tag:lmny-feed`
stones + 410 responses is a separate, confirmed step after the API filter is
published and dual-write is running from sync.
