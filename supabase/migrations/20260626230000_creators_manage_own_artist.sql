-- Let creators manage banner / video / socials / position for any artist whose
-- catalogue contains at least one song they own (songs.creator_id = auth.uid()).
-- Existing admin policies stay untouched; these new policies are additive.

-- ─────────────────────────────────────────────────────────────────────────────
-- artist_profiles: creators can INSERT / UPDATE rows for their own artists.
-- The artist row is identified by the artist_name column matching (case
-- insensitive, trimmed) at least one song's artist_name owned by the user.
-- ─────────────────────────────────────────────────────────────────────────────

create policy "Creators insert own artist profile"
on public.artist_profiles
for insert
to authenticated
with check (
  artist_name is not null
  and length(trim(artist_name)) > 0
  and exists (
    select 1 from public.songs s
    where s.creator_id = (select auth.uid())
      and s.artist_name is not null
      and lower(trim(s.artist_name)) = lower(trim(artist_profiles.artist_name))
  )
);

create policy "Creators update own artist profile"
on public.artist_profiles
for update
to authenticated
using (
  artist_name is not null
  and length(trim(artist_name)) > 0
  and exists (
    select 1 from public.songs s
    where s.creator_id = (select auth.uid())
      and s.artist_name is not null
      and lower(trim(s.artist_name)) = lower(trim(artist_profiles.artist_name))
  )
)
with check (
  artist_name is not null
  and length(trim(artist_name)) > 0
  and exists (
    select 1 from public.songs s
    where s.creator_id = (select auth.uid())
      and s.artist_name is not null
      and lower(trim(s.artist_name)) = lower(trim(artist_profiles.artist_name))
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- storage.objects: creators can manage files in covers/banners/ whose filename
-- starts with the sanitized artist name of one of their own songs.
-- Sanitization mirrors the client (`replace(/[^a-z0-9]/gi, '_').toLowerCase()`):
--   regexp_replace(lower(artist_name), '[^a-z0-9]', '_', 'g')
-- Files include banner image (e.g. `nastyyy_blue.webp`) and video
-- (e.g. `nastyyy_blue_video.mp4`), both covered by the `<sanitized>%` LIKE.
-- ─────────────────────────────────────────────────────────────────────────────

create policy "Creators upload own artist banners"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] = 'banners'
  and exists (
    select 1 from public.songs s
    where s.creator_id = (select auth.uid())
      and s.artist_name is not null
      and length(trim(s.artist_name)) > 0
      and storage.filename(name) like
        (regexp_replace(lower(s.artist_name), '[^a-z0-9]', '_', 'g') || '%')
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
    select 1 from public.songs s
    where s.creator_id = (select auth.uid())
      and s.artist_name is not null
      and length(trim(s.artist_name)) > 0
      and storage.filename(name) like
        (regexp_replace(lower(s.artist_name), '[^a-z0-9]', '_', 'g') || '%')
  )
)
with check (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] = 'banners'
  and exists (
    select 1 from public.songs s
    where s.creator_id = (select auth.uid())
      and s.artist_name is not null
      and length(trim(s.artist_name)) > 0
      and storage.filename(name) like
        (regexp_replace(lower(s.artist_name), '[^a-z0-9]', '_', 'g') || '%')
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
    select 1 from public.songs s
    where s.creator_id = (select auth.uid())
      and s.artist_name is not null
      and length(trim(s.artist_name)) > 0
      and storage.filename(name) like
        (regexp_replace(lower(s.artist_name), '[^a-z0-9]', '_', 'g') || '%')
  )
);
