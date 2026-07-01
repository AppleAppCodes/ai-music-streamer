-- Protect play-count / viral-chart integrity.
--
-- Problem: increment_song_plays had EXECUTE granted to `anon`, and the anon key
-- ships in the browser bundle. Anyone could therefore call
--   POST /rest/v1/rpc/increment_song_plays { target_song_id }
-- directly (bypassing the auth-gated /api/songs/[id]/play route) in a loop and
-- inflate any song's play count -> manipulate the viral charts. Logged-in users
-- could likewise spam-replay to inflate.
--
-- Fix:
-- 1) Require authentication: revoke EXECUTE from anon. The API route already
--    requires login, so no legitimate play is lost.
-- 2) Per-user cooldown: the same user replaying the same song within 30 minutes
--    no longer bumps the public counter (still recorded in user_song_plays for
--    their own history). Stops trivial replay-inflation while genuine repeat
--    listens over time still count.

revoke execute on function public.increment_song_plays(uuid) from anon;

create or replace function public.increment_song_plays(target_song_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_plays bigint;
  listener_id uuid := auth.uid();
  played_recently boolean := false;
begin
  -- Only authenticated listeners may register plays.
  if listener_id is null then
    return null;
  end if;

  select (last_played_at > timezone('utc'::text, now()) - interval '30 minutes')
    into played_recently
  from public.user_song_plays
  where user_id = listener_id and song_id = target_song_id;

  -- Always record the user's own play history.
  insert into public.user_song_plays (user_id, song_id, play_count, last_played_at)
  values (listener_id, target_song_id, 1, timezone('utc'::text, now()))
  on conflict (user_id, song_id) do update
    set play_count = public.user_song_plays.play_count + 1,
        last_played_at = timezone('utc'::text, now());

  -- Within the cooldown window: do not inflate the public counter again.
  if played_recently then
    select plays into updated_plays from public.songs where id = target_song_id;
    return updated_plays;
  end if;

  update public.songs
  set plays = coalesce(plays, 0) + 1
  where id = target_song_id
  returning plays into updated_plays;

  if updated_plays is null then
    return null;
  end if;

  insert into public.song_daily_plays (song_id, play_date, plays)
  values (target_song_id, current_date, 1)
  on conflict (song_id, play_date)
  do update set plays = public.song_daily_plays.plays + 1;

  return updated_plays;
end;
$$;
