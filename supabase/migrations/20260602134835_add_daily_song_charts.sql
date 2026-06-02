create table if not exists public.song_daily_plays (
  song_id uuid not null references public.songs(id) on delete cascade,
  play_date date not null default current_date,
  plays bigint not null default 0 check (plays >= 0),
  primary key (song_id, play_date)
);

create index if not exists song_daily_plays_date_plays_idx
on public.song_daily_plays (play_date, plays desc);

alter table public.song_daily_plays enable row level security;

revoke all on table public.song_daily_plays from public, anon, authenticated;
grant select on table public.song_daily_plays to anon, authenticated;

drop policy if exists "Daily song plays are viewable by everyone" on public.song_daily_plays;
create policy "Daily song plays are viewable by everyone"
on public.song_daily_plays
for select
to anon, authenticated
using (true);

create or replace function public.increment_song_plays(target_song_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_plays bigint;
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

  return updated_plays;
end;
$$;
