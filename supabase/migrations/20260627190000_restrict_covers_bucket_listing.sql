-- The `covers` public bucket had a broad SELECT (list) policy
-- "Public can select all covers" (bucket_id = 'covers') that let ANY anonymous
-- client list EVERY file in the bucket -- including per-user song-cover folders
-- (<userId>/...), avatars/ and playlists/ -- enabling enumeration of all
-- objects and inference of user IDs from folder names. Public object access via
-- getPublicUrl does NOT need a SELECT policy (public buckets serve known object
-- URLs directly), so listing was broader than required. (An earlier migration,
-- 20260602132134, tried to narrow this to banners/discover but the broad policy
-- is what is actually live.)
--
-- The app only ever calls storage.from('covers').list(<folder>) on a small set
-- of curated, publicly-displayed folders:
--   banners   - artist banners (public artist share pages + /artists)
--   discover  - discover videos (/artists)
--   charts    - viral chart videos (/charts/viral)
--   branding  - site logo (BrandLogo, shown on public/login pages)
-- Restrict public listing to exactly those folders; per-user covers, avatars
-- and playlist covers stay reachable by direct URL but are no longer
-- enumerable.

drop policy if exists "Public can select all covers" on storage.objects;
drop policy if exists "Public can list artist media" on storage.objects;

create policy "Public can list curated cover media"
on storage.objects
for select
to public
using (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] in ('banners', 'discover', 'charts', 'branding')
);
