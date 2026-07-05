-- Adds plays_tracked_total (all-time honest plays from song_daily_plays)
-- to the admin song performance rollup. plays_total remains the public
-- display counter (songs.plays). Return type changes, so drop + recreate.
drop function if exists public.get_admin_song_performance();

create function public.get_admin_song_performance()
returns table (
  song_id uuid,
  plays_total bigint,
  plays_tracked_total bigint,
  plays_24h bigint,
  plays_7d bigint,
  plays_30d bigint,
  previous_7d bigint,
  trend_percent numeric,
  unique_listeners bigint,
  likes bigint,
  playlist_adds bigint,
  last_played_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Only admins can view song performance';
  end if;

  return query
    with daily as (
      select
        sdp.song_id,
        coalesce(sum(sdp.plays), 0)::bigint as plays_tracked_total,
        coalesce(sum(sdp.plays) filter (where sdp.play_date >= current_date), 0)::bigint as plays_24h,
        coalesce(sum(sdp.plays) filter (where sdp.play_date >= current_date - 6), 0)::bigint as plays_7d,
        coalesce(sum(sdp.plays) filter (where sdp.play_date >= current_date - 29), 0)::bigint as plays_30d,
        coalesce(sum(sdp.plays) filter (where sdp.play_date between current_date - 13 and current_date - 7), 0)::bigint as previous_7d,
        max(sdp.play_date) filter (where sdp.plays > 0) as last_play_date
      from public.song_daily_plays sdp
      group by sdp.song_id
    ),
    listeners as (
      select
        usp.song_id,
        count(*)::bigint as unique_listeners,
        max(usp.last_played_at) as last_played_at
      from public.user_song_plays usp
      group by usp.song_id
    ),
    likes as (
      select
        ls.song_id,
        count(*)::bigint as likes
      from public.liked_songs ls
      group by ls.song_id
    ),
    playlist_adds as (
      select
        ps.song_id,
        count(*)::bigint as playlist_adds
      from public.playlist_songs ps
      group by ps.song_id
    )
    select
      s.id as song_id,
      coalesce(s.plays, 0)::bigint as plays_total,
      coalesce(d.plays_tracked_total, 0)::bigint as plays_tracked_total,
      coalesce(d.plays_24h, 0)::bigint as plays_24h,
      coalesce(d.plays_7d, 0)::bigint as plays_7d,
      coalesce(d.plays_30d, 0)::bigint as plays_30d,
      coalesce(d.previous_7d, 0)::bigint as previous_7d,
      case
        when coalesce(d.previous_7d, 0) > 0
          then round(((coalesce(d.plays_7d, 0) - d.previous_7d)::numeric / d.previous_7d::numeric) * 100, 1)
        when coalesce(d.plays_7d, 0) > 0
          then 100::numeric
        else 0::numeric
      end as trend_percent,
      coalesce(l.unique_listeners, 0)::bigint as unique_listeners,
      coalesce(lk.likes, 0)::bigint as likes,
      coalesce(pa.playlist_adds, 0)::bigint as playlist_adds,
      coalesce(l.last_played_at, d.last_play_date::timestamptz) as last_played_at
    from public.songs s
    left join daily d on d.song_id = s.id
    left join listeners l on l.song_id = s.id
    left join likes lk on lk.song_id = s.id
    left join playlist_adds pa on pa.song_id = s.id;
end;
$$;

revoke all on function public.get_admin_song_performance() from public, anon;
grant execute on function public.get_admin_song_performance() to authenticated;
