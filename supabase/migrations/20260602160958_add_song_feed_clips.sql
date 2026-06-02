create table if not exists public.song_feed_clips (
  song_id uuid primary key references public.songs(id) on delete cascade,
  video_url text,
  hook_start_seconds integer not null default 0 check (hook_start_seconds >= 0),
  hook_end_seconds integer not null default 20 check (hook_end_seconds > hook_start_seconds),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.song_feed_clips enable row level security;

revoke all on table public.song_feed_clips from public, anon, authenticated;
grant select on table public.song_feed_clips to anon, authenticated;
grant insert, update, delete on table public.song_feed_clips to authenticated;

create policy "Feed clips are viewable by everyone"
on public.song_feed_clips
for select
to anon, authenticated
using (true);

create policy "Admins can insert feed clips"
on public.song_feed_clips
for insert
to authenticated
with check ((select public.is_admin()));

create policy "Admins can update feed clips"
on public.song_feed_clips
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins can delete feed clips"
on public.song_feed_clips
for delete
to authenticated
using ((select public.is_admin()));
