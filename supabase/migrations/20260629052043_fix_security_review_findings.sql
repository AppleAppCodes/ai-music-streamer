-- Follow-up security fixes from the 2026-06-29 web security review.
--
-- 1) Artist banner/video storage ownership must use exact filename shapes, not
--    broad prefix matching. This keeps artist `a` from matching `abba...`.
-- 2) Public play counters must only increment after an atomic cooldown write.
-- 3) The player should not list the public ads bucket directly; expose a narrow
--    authenticated RPC with ad filenames and tighten bucket upload metadata.

-- ─────────────────────────────────────────────────────────────────────────────
-- Artist media Storage RLS: exact slug delimiter matching.
-- Allowed creator-managed filenames:
--   banners/<artist_slug>.<ext>
--   banners/<artist_slug>_video_<unix-ms-timestamp>.<ext>
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Creators upload own artist banners" on storage.objects;
drop policy if exists "Creators update own artist banners" on storage.objects;
drop policy if exists "Creators delete own artist banners" on storage.objects;

create policy "Creators upload own artist banners"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] = 'banners'
  and exists (
    select 1
    from public.songs s
    where s.creator_id = (select auth.uid())
      and s.artist_name is not null
      and length(trim(s.artist_name)) > 0
      and (
        lower(storage.filename(name)) ~ (
          '^' || regexp_replace(lower(s.artist_name), '[^a-z0-9]', '_', 'g') || '\.[a-z0-9]+$'
        )
        or lower(storage.filename(name)) ~ (
          '^' || regexp_replace(lower(s.artist_name), '[^a-z0-9]', '_', 'g') || '_video_[0-9]{10,}\.[a-z0-9]+$'
        )
      )
  )
);

create policy "Creators update own artist banners"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] = 'banners'
  and exists (
    select 1
    from public.songs s
    where s.creator_id = (select auth.uid())
      and s.artist_name is not null
      and length(trim(s.artist_name)) > 0
      and (
        lower(storage.filename(name)) ~ (
          '^' || regexp_replace(lower(s.artist_name), '[^a-z0-9]', '_', 'g') || '\.[a-z0-9]+$'
        )
        or lower(storage.filename(name)) ~ (
          '^' || regexp_replace(lower(s.artist_name), '[^a-z0-9]', '_', 'g') || '_video_[0-9]{10,}\.[a-z0-9]+$'
        )
      )
  )
)
with check (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] = 'banners'
  and exists (
    select 1
    from public.songs s
    where s.creator_id = (select auth.uid())
      and s.artist_name is not null
      and length(trim(s.artist_name)) > 0
      and (
        lower(storage.filename(name)) ~ (
          '^' || regexp_replace(lower(s.artist_name), '[^a-z0-9]', '_', 'g') || '\.[a-z0-9]+$'
        )
        or lower(storage.filename(name)) ~ (
          '^' || regexp_replace(lower(s.artist_name), '[^a-z0-9]', '_', 'g') || '_video_[0-9]{10,}\.[a-z0-9]+$'
        )
      )
  )
);

create policy "Creators delete own artist banners"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] = 'banners'
  and exists (
    select 1
    from public.songs s
    where s.creator_id = (select auth.uid())
      and s.artist_name is not null
      and length(trim(s.artist_name)) > 0
      and (
        lower(storage.filename(name)) ~ (
          '^' || regexp_replace(lower(s.artist_name), '[^a-z0-9]', '_', 'g') || '\.[a-z0-9]+$'
        )
        or lower(storage.filename(name)) ~ (
          '^' || regexp_replace(lower(s.artist_name), '[^a-z0-9]', '_', 'g') || '_video_[0-9]{10,}\.[a-z0-9]+$'
        )
      )
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Atomic authenticated play-count cooldown.
-- The conditional upsert serializes concurrent calls for the same
-- (user_id, song_id) row; only the transaction that inserts or moves the
-- cooldown window may increment public counters.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.increment_song_plays(target_song_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_plays bigint;
  listener_id uuid := auth.uid();
  should_count_public_play boolean := false;
begin
  if listener_id is null then
    return null;
  end if;

  insert into public.user_song_plays (user_id, song_id, play_count, last_played_at)
  values (listener_id, target_song_id, 1, timezone('utc'::text, now()))
  on conflict (user_id, song_id) do update
    set play_count = public.user_song_plays.play_count + 1,
        last_played_at = timezone('utc'::text, now())
    where public.user_song_plays.last_played_at <= timezone('utc'::text, now()) - interval '30 minutes'
  returning true into should_count_public_play;

  if not coalesce(should_count_public_play, false) then
    update public.user_song_plays
    set play_count = public.user_song_plays.play_count + 1
    where user_id = listener_id
      and song_id = target_song_id;

    select plays into updated_plays
    from public.songs
    where id = target_song_id;

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

revoke all on function public.increment_song_plays(uuid) from public, anon;
grant execute on function public.increment_song_plays(uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Ads bucket hardening.
-- The public player uses get_public_ad_files() instead of listing
-- storage.objects. Public object URLs still serve known public files.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Public Ad Access" on storage.objects;

create or replace function public.get_public_ad_files()
returns table(name text)
language sql
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where auth.uid() is not null
    and o.bucket_id = 'ads'
    and o.name <> '.emptyFolderPlaceholder'
    and lower(o.name) ~ '\.(mp3|m4a|wav|ogg|aac)$'
  order by o.created_at desc, o.name asc;
$$;

revoke all on function public.get_public_ad_files() from public, anon;
grant execute on function public.get_public_ad_files() to authenticated;

update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'audio/aac',
    'audio/m4a',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/x-m4a',
    'audio/x-wav'
  ]
where id = 'ads';
