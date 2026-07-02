-- Per-user engagement aggregates for the admin dashboard.
-- Admin-only SECURITY DEFINER (same pattern as get_admin_user_list).
create or replace function public.get_admin_user_engagement()
returns table (
  user_id uuid,
  songs_played bigint,
  total_plays bigint,
  last_played_at timestamptz,
  likes bigint,
  follows bigint,
  playlists bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Only admins can view engagement';
  end if;

  return query
    select
      p.id as user_id,
      coalesce(sp.songs_played, 0)::bigint as songs_played,
      coalesce(sp.total_plays, 0)::bigint as total_plays,
      sp.last_played_at,
      coalesce(lk.likes, 0)::bigint as likes,
      coalesce(fl.follows, 0)::bigint as follows,
      coalesce(pl.playlists, 0)::bigint as playlists
    from public.profiles p
    left join (
      select user_id,
             count(*) as songs_played,
             sum(play_count) as total_plays,
             max(last_played_at) as last_played_at
      from public.user_song_plays
      group by user_id
    ) sp on sp.user_id = p.id
    left join (
      select user_id, count(*) as likes from public.liked_songs group by user_id
    ) lk on lk.user_id = p.id
    left join (
      select user_id, count(*) as follows from public.follows group by user_id
    ) fl on fl.user_id = p.id
    left join (
      select user_id, count(*) as playlists from public.playlists group by user_id
    ) pl on pl.user_id = p.id;
end;
$$;

revoke all on function public.get_admin_user_engagement() from public, anon;
grant execute on function public.get_admin_user_engagement() to authenticated;
