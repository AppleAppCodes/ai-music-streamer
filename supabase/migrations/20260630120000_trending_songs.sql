-- Admin-curated "Trending" row (up to 6 hand-picked songs).
-- When any song has trending_sort_order set, the home Trending row shows those
-- (ordered); otherwise it falls back to the daily algorithm. Mirrors the
-- viral_sort_order / update_viral_song_order pattern.

alter table public.songs add column if not exists trending_sort_order integer;

-- Replace the whole curated set in one call: clears the current selection, then
-- assigns positions 1..N (capped at 6) to the given ordered song ids.
create or replace function public.set_trending_songs(song_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can set trending songs';
  end if;

  update public.songs set trending_sort_order = null where trending_sort_order is not null;

  for i in 1 .. least(coalesce(array_length(song_ids, 1), 0), 6) loop
    update public.songs set trending_sort_order = i where id = song_ids[i];
  end loop;
end;
$$;

revoke all on function public.set_trending_songs(uuid[]) from public, anon;
grant execute on function public.set_trending_songs(uuid[]) to authenticated;
