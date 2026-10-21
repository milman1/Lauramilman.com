-- LMNY feed stones — queryable store for the storefront diamond filter.
--
-- TODAY: Shopify product records are the only live copy of this data
-- (see lmny-feeds/README.md). Do NOT bulk-delete tag:lmny-feed products
-- until this table is populated in production and the App Proxy / worker
-- endpoint is serving the filter.
--
-- Apply to a dedicated LMNY Supabase project (not Hours / lazrbeam).
-- Estimated new-project cost: $10/mo — confirm before create_project.

create table if not exists public.stones (
  stock_ref text primary key,
  kind text not null check (kind in ('natural', 'lab')),
  shape text not null,
  carat numeric(8, 3) not null check (carat > 0),
  color text not null,
  clarity text not null,
  cut text,
  polish text,
  symmetry text,
  fluorescence text,
  lab text not null,
  cert_number text,
  cert_url text,
  measurements text,
  table_pct numeric(6, 2),
  depth_pct numeric(6, 2),
  cost_usd numeric(12, 2) not null,
  /** Lab: Belgium Dia Buy_Price interpreted as USD/ct. Natural: cost/carat. */
  price_per_carat_usd numeric(12, 2),
  rap_price_usd numeric(12, 2),
  retail_usd numeric(12, 2) not null,
  image_urls text[] not null default '{}',
  video_urls text[] not null default '{}',
  content_hash text not null,
  synced_at timestamptz not null default now(),
  available boolean not null default true
);

create index if not exists stones_kind_available_idx
  on public.stones (kind, available)
  where available;

create index if not exists stones_filter_idx
  on public.stones (kind, shape, color, clarity, cut, carat, retail_usd)
  where available;

comment on table public.stones is
  'Belgium Dia stones dual-written by lmny-feeds sync. Source of truth for the App Proxy diamond filter once Shopify products are retired.';

-- Storefront reads via the anon key. Cost is not in the public select list.
-- Lab stones shown on the filter: available, a photo, 1 carat or larger,
-- color G or better, clarity VS2 or better (VS1 included), cut Very Good or
-- better when a cut is present, lab IGI / GIA / GCAL / HRD / AGS, and not a
-- novelty shape. Natural stones: available, with a photo.
alter table public.stones enable row level security;

drop policy if exists stones_public_read on public.stones;
create policy stones_public_read on public.stones
  for select
  to anon, authenticated
  using (
    available = true
    and cardinality(image_urls) > 0
    and (
      kind <> 'lab'
      or (
        color <= 'G'
        and clarity = any (array['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2'])
        and (cut is null or cut = any (array['Ideal', 'Excellent', 'Very Good']))
        and upper(lab) = any (array['IGI', 'GIA', 'GCAL', 'HRD', 'AGS'])
        and lower(shape) <> all (array[
          'baguette', 'trapezoid', 'bullet', 'halfmoon', 'shield', 'kite', 'kite step cut',
          'triangle', 'trilliant', 'hexagonal', 'hexagon step', 'hexagonal modified brill',
          'lozenge', 'lozenge step cut', 'capsule', 'pentagonal', 'pentagonal step',
          'pentagonal modified bril', 'octagonal', 'octagonal step cut', 'cadillac',
          'star', 'round star', 'horse head', 'lily', 'butterfly', 'briolette', 'lady heart'
        ])
        and carat >= 1
      )
    )
  );

-- Service role (sync) bypasses RLS; no insert/update policy for anon.
