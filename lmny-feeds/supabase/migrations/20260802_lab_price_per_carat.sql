-- Lab pricing audit columns. cost_usd is always the stone TOTAL;
-- price_per_carat_usd is the Belgium Dia Buy_Price (lab) or cost/carat (natural).
alter table public.stones
  add column if not exists price_per_carat_usd numeric(12, 2);

comment on column public.stones.cost_usd is
  'Total supplier cost USD. Lab = Buy_Price × carat; natural = Buy_Price or Rap×(1+disc).';
comment on column public.stones.price_per_carat_usd is
  'USD per carat. Lab: raw Buy_Price. Used to audit that cost_usd ≈ price_per_carat_usd × carat.';
