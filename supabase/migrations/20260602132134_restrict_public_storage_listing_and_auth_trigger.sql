-- The auth trigger runs from Postgres itself. It must not be exposed as a
-- callable RPC, and its lookup path should be fixed explicitly.
alter function public.handle_new_user() set search_path = '';
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Public buckets serve known object URLs without SELECT policies. Keep listing
-- available only where the UI discovers artist banners and background videos.
drop policy if exists "Public Read Access on covers" on storage.objects;
drop policy if exists "Public Read Access on songs" on storage.objects;
drop policy if exists "Public audio read" on storage.objects;
drop policy if exists "Public cover read" on storage.objects;

create policy "Public can list artist media"
on storage.objects
for select
to public
using (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] in ('banners', 'discover')
);
