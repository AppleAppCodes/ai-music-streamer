-- Returns the distinct genre values (primary + secondary) that actually have
-- at least one approved song — so the onboarding can hide empty genres.
-- Public read; only exposes non-sensitive genre labels of public songs.
create or replace function public.get_active_genres()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct g order by g), '{}')
  from (
    select lower(trim(genre)) as g
    from public.songs
    where is_approved and genre is not null and trim(genre) <> ''
    union
    select lower(trim(secondary_genre))
    from public.songs
    where is_approved and secondary_genre is not null and trim(secondary_genre) <> ''
  ) x;
$$;
grant execute on function public.get_active_genres() to anon, authenticated;
