-- Admin-only per-artist rollup for the admin panel artist list.
-- display_plays = songs.plays (the public counter shown in the app);
-- plays_* come from the tracked layer (song_daily_plays, since 2026-05-31).
create or replace function public.get_admin_artist_performance()
returns table (
  artist_name text,
  songs_count integer,
  followers integer,
  display_plays bigint,
  plays_tracked_total bigint,
  plays_7d bigint,
  plays_30d bigint,
  unique_listeners bigint,
  likes bigint,
  last_played_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'admin only';
  end if;

  return query
  with song_stats as (
    select s.artist_name as a_name,
           count(*)::int as songs_count,
           coalesce(sum(s.plays), 0)::bigint as display_plays
    from public.songs s
    group by s.artist_name
  ),
  play_stats as (
    select s.artist_name as a_name,
           coalesce(sum(d.plays), 0)::bigint as plays_tracked_total,
           coalesce(sum(d.plays) filter (where d.play_date >= current_date - 6), 0)::bigint as plays_7d,
           coalesce(sum(d.plays) filter (where d.play_date >= current_date - 29), 0)::bigint as plays_30d
    from public.song_daily_plays d
    join public.songs s on s.id = d.song_id
    group by s.artist_name
  ),
  listener_stats as (
    select s.artist_name as a_name,
           count(distinct u.user_id)::bigint as unique_listeners,
           max(u.last_played_at) as last_played_at
    from public.user_song_plays u
    join public.songs s on s.id = u.song_id
    group by s.artist_name
  ),
  like_stats as (
    select s.artist_name as a_name,
           count(*)::bigint as likes
    from public.liked_songs l
    join public.songs s on s.id = l.song_id
    group by s.artist_name
  ),
  follow_stats as (
    select f.artist_name as a_name,
           count(*)::int as followers
    from public.follows f
    group by f.artist_name
  )
  select ss.a_name,
         ss.songs_count,
         coalesce(fs.followers, 0),
         ss.display_plays,
         coalesce(ps.plays_tracked_total, 0),
         coalesce(ps.plays_7d, 0),
         coalesce(ps.plays_30d, 0),
         coalesce(ls.unique_listeners, 0),
         coalesce(lk.likes, 0),
         ls.last_played_at
  from song_stats ss
  left join play_stats ps on ps.a_name = ss.a_name
  left join listener_stats ls on ls.a_name = ss.a_name
  left join like_stats lk on lk.a_name = ss.a_name
  left join follow_stats fs on fs.a_name = ss.a_name;
end;
$$;

revoke all on function public.get_admin_artist_performance() from anon;
grant execute on function public.get_admin_artist_performance() to authenticated;
