-- Admin-controllable ordering for the "Official YORIAX Playlists" row.
-- Mirrors the existing update_artist_order / update_viral_song_order pattern.

alter table public.playlists add column if not exists official_sort_order integer;

-- Backfill an initial order from the current display order (newest first),
-- only where not already set, so the row keeps its current sequence until edited.
with ordered as (
  select id, (row_number() over (order by created_at desc) - 1) as rn
  from public.playlists
  where is_official = true
)
update public.playlists p
set official_sort_order = ordered.rn
from ordered
where p.id = ordered.id and p.official_sort_order is null;

create or replace function public.update_official_playlist_order(order_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
begin
  if not public.is_admin() then
    raise exception 'Only admins can update official playlist ordering';
  end if;

  for item in
    select * from jsonb_to_recordset(order_data) as x(id uuid, official_sort_order integer)
  loop
    update public.playlists
    set official_sort_order = item.official_sort_order
    where id = item.id and is_official = true;
  end loop;
end;
$$;

revoke all on function public.update_official_playlist_order(jsonb) from public, anon;
grant execute on function public.update_official_playlist_order(jsonb) to authenticated;
