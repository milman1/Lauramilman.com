-- Public lab search: 1 carat or larger. Clarity still includes VS1 and VS2.
-- Replaces the live 2-carat floor. Natural stones stay available-with-a-photo.

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
