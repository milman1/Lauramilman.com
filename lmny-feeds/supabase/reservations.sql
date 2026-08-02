-- reservations for inquiry/reserve checkout (no Shopify product required)

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  stock_ref text not null references public.stones(stock_ref),
  kind text not null check (kind in ('natural', 'lab')),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'invoiced', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reservations_status_idx on public.reservations (status, created_at desc);
create index if not exists reservations_stock_ref_idx on public.reservations (stock_ref);

comment on table public.reservations is
  'Inquiry/reserve requests from the storefront. Staff follows up with a Shopify invoice.';

alter table public.reservations enable row level security;
-- No anon policies: inserts go through the reserve edge function (service role).
