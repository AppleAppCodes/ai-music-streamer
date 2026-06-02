create table if not exists public.user_song_plays (
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  play_count bigint not null default 0 check (play_count >= 0),
  last_played_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, song_id)
);

create index if not exists user_song_plays_user_recent_idx
on public.user_song_plays (user_id, last_played_at desc);

create index if not exists user_song_plays_song_id_idx
on public.user_song_plays (song_id);

alter table public.user_song_plays enable row level security;

revoke all on table public.user_song_plays from public, anon, authenticated;
grant select on table public.user_song_plays to authenticated;

drop policy if exists "Users can view their own song play history" on public.user_song_plays;
create policy "Users can view their own song play history"
on public.user_song_plays
for select
to authenticated
using ((select auth.uid()) = user_id);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.increment_song_plays(target_song_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_plays bigint;
  listener_id uuid := auth.uid();
begin
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

  if listener_id is not null then
    insert into public.user_song_plays (user_id, song_id, play_count, last_played_at)
    values (listener_id, target_song_id, 1, timezone('utc'::text, now()))
    on conflict (user_id, song_id)
    do update set
      play_count = public.user_song_plays.play_count + 1,
      last_played_at = excluded.last_played_at;
  end if;

  return updated_plays;
end;
$$;

revoke all on function private.increment_song_plays(uuid) from public;
grant execute on function private.increment_song_plays(uuid) to authenticated, service_role;

create or replace function public.increment_song_plays(target_song_id uuid)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select private.increment_song_plays(target_song_id);
$$;

revoke all on function public.increment_song_plays(uuid) from public, anon;
grant execute on function public.increment_song_plays(uuid) to authenticated, service_role;
