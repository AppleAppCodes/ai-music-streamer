-- Adds onboarding visibility (chosen genres + skip state) to the admin user
-- rollup so the Users tab can show the Install -> Onboarding -> first-play
-- funnel. onboarding_skipped stays nullable: null = never reached onboarding,
-- true = actively skipped, false = completed. Return type changes -> drop+recreate.
drop function if exists public.get_admin_user_engagement();

create function public.get_admin_user_engagement()
returns table (
  user_id uuid,
  songs_played bigint,
  total_plays bigint,
  last_played_at timestamptz,
  likes bigint,
  follows bigint,
  playlists bigint,
  favorite_genres text[],
  onboarding_skipped boolean
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
      coalesce(pl.playlists, 0)::bigint as playlists,
      ump.favorite_genres,
      ump.onboarding_skipped
    from public.profiles p
    left join (
      select usp.user_id,
             count(*) as songs_played,
             sum(usp.play_count) as total_plays,
             max(usp.last_played_at) as last_played_at
      from public.user_song_plays usp
      group by usp.user_id
    ) sp on sp.user_id = p.id
    left join (
      select ls.user_id, count(*) as likes from public.liked_songs ls group by ls.user_id
    ) lk on lk.user_id = p.id
    left join (
      select f.user_id, count(*) as follows from public.follows f group by f.user_id
    ) fl on fl.user_id = p.id
    left join (
      select pls.user_id, count(*) as playlists from public.playlists pls group by pls.user_id
    ) pl on pl.user_id = p.id
    left join public.user_music_preferences ump on ump.user_id = p.id;
end;
$$;
