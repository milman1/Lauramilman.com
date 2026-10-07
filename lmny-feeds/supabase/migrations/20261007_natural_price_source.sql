-- Which tier priced a natural stone: cert | spec | rap | fallback.
-- Apply BEFORE the sync version that writes price_source (PostgREST rejects
-- an upsert that names an unknown column).
alter table public.stones add column if not exists price_source text
  check (price_source in ('cert', 'spec', 'rap', 'fallback'));
