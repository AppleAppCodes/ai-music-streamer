create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.feed_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (user_id, song_id)
);

create index if not exists feed_saves_song_id_idx
  on public.feed_saves (song_id);

create table if not exists public.feed_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists feed_comments_song_created_at_idx
  on public.feed_comments (song_id, created_at desc);

create table if not exists public.song_feed_stats (
  song_id uuid primary key references public.songs(id) on delete cascade,
  likes_count integer not null default 0 check (likes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  saves_count integer not null default 0 check (saves_count >= 0),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.feed_saves enable row level security;
alter table public.feed_comments enable row level security;
alter table public.song_feed_stats enable row level security;

revoke all on table public.feed_saves from public, anon, authenticated;
revoke all on table public.feed_comments from public, anon, authenticated;
revoke all on table public.song_feed_stats from public, anon, authenticated;

grant select, insert, delete on table public.feed_saves to authenticated;
grant select on table public.feed_comments to anon, authenticated;
grant insert, update, delete on table public.feed_comments to authenticated;
grant select on table public.song_feed_stats to anon, authenticated;

create policy "Users can view their own feed saves"
on public.feed_saves
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can save songs in their feed"
on public.feed_saves
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can remove their feed saves"
on public.feed_saves
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Feed comments are viewable by everyone"
on public.feed_comments
for select
to anon, authenticated
using (true);

create policy "Users can add their own feed comments"
on public.feed_comments
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own feed comments"
on public.feed_comments
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own feed comments"
on public.feed_comments
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Feed stats are viewable by everyone"
on public.song_feed_stats
for select
to anon, authenticated
using (true);

create or replace function private.refresh_song_feed_stats(target_song_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.song_feed_stats (
    song_id,
    likes_count,
    comments_count,
    saves_count,
    updated_at
  )
  values (
    target_song_id,
    (select count(*)::integer from public.liked_songs where song_id = target_song_id),
    (select count(*)::integer from public.feed_comments where song_id = target_song_id),
    (select count(*)::integer from public.feed_saves where song_id = target_song_id),
    timezone('utc'::text, now())
  )
  on conflict (song_id) do update
  set likes_count = excluded.likes_count,
      comments_count = excluded.comments_count,
      saves_count = excluded.saves_count,
      updated_at = excluded.updated_at;
$$;

create or replace function private.refresh_song_feed_stats_after_interaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.refresh_song_feed_stats(coalesce(new.song_id, old.song_id));
  return coalesce(new, old);
end;
$$;

create or replace function private.create_song_feed_stats()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.song_feed_stats (song_id)
  values (new.id)
  on conflict (song_id) do nothing;
  return new;
end;
$$;

drop trigger if exists refresh_song_feed_stats_after_like on public.liked_songs;
create trigger refresh_song_feed_stats_after_like
after insert or delete on public.liked_songs
for each row execute function private.refresh_song_feed_stats_after_interaction();

drop trigger if exists refresh_song_feed_stats_after_comment on public.feed_comments;
create trigger refresh_song_feed_stats_after_comment
after insert or delete on public.feed_comments
for each row execute function private.refresh_song_feed_stats_after_interaction();

drop trigger if exists refresh_song_feed_stats_after_save on public.feed_saves;
create trigger refresh_song_feed_stats_after_save
after insert or delete on public.feed_saves
for each row execute function private.refresh_song_feed_stats_after_interaction();

drop trigger if exists create_song_feed_stats_after_song on public.songs;
create trigger create_song_feed_stats_after_song
after insert on public.songs
for each row execute function private.create_song_feed_stats();

insert into public.song_feed_stats (
  song_id,
  likes_count,
  comments_count,
  saves_count
)
select
  songs.id,
  (select count(*)::integer from public.liked_songs where liked_songs.song_id = songs.id),
  (select count(*)::integer from public.feed_comments where feed_comments.song_id = songs.id),
  (select count(*)::integer from public.feed_saves where feed_saves.song_id = songs.id)
from public.songs
on conflict (song_id) do update
set likes_count = excluded.likes_count,
    comments_count = excluded.comments_count,
    saves_count = excluded.saves_count,
    updated_at = timezone('utc'::text, now());
