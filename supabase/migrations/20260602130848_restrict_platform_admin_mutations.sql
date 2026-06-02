-- Authorization data belongs in app_metadata because users cannot change it
-- themselves. Existing JWTs pick this up after the next token refresh.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where lower(email) = 'heindavid91@gmail.com';

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- Artist pages are public, but only admins may maintain platform-managed data.
drop policy if exists "Anyone can insert artist profiles" on public.artist_profiles;
drop policy if exists "Anyone can update artist profiles" on public.artist_profiles;

create policy "Admins can insert artist profiles"
on public.artist_profiles
for insert
to authenticated
with check ((select public.is_admin()));

create policy "Admins can update artist profiles"
on public.artist_profiles
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins can delete artist profiles"
on public.artist_profiles
for delete
to authenticated
using ((select public.is_admin()));

-- Publishing is an admin operation. Personal playlists remain user-managed.
drop policy if exists "Users can insert their own songs." on public.songs;
drop policy if exists "Users can update their own songs." on public.songs;
drop policy if exists "Users can delete their own songs." on public.songs;

create policy "Admins can insert songs"
on public.songs
for insert
to authenticated
with check ((select public.is_admin()));

create policy "Admins can update songs"
on public.songs
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins can delete songs"
on public.songs
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "Users can insert their own albums" on public.albums;
drop policy if exists "Users can update their own albums" on public.albums;
drop policy if exists "Users can delete their own albums" on public.albums;

create policy "Admins can insert albums"
on public.albums
for insert
to authenticated
with check ((select public.is_admin()));

create policy "Admins can update albums"
on public.albums
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins can delete albums"
on public.albums
for delete
to authenticated
using ((select public.is_admin()));

-- Keep regular users' avatars and playlist covers writable while protecting
-- all platform-managed media such as song covers, banners, and videos.
drop policy if exists "Auth Insert Access on covers" on storage.objects;
drop policy if exists "Auth Update Access on covers" on storage.objects;
drop policy if exists "Auth Delete Access on covers" on storage.objects;
drop policy if exists "Auth Insert Access on songs" on storage.objects;
drop policy if exists "Auth users can upload audio" on storage.objects;
drop policy if exists "Auth users can upload covers" on storage.objects;

create policy "Admins and owners can insert covers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'covers'
  and (
    (select public.is_admin())
    or (
      (storage.foldername(name))[1] = 'avatars'
      and storage.filename(name) like (select auth.uid())::text || '-%'
    )
    or (
      (storage.foldername(name))[1] = 'playlists'
      and exists (
        select 1
        from public.playlists
        where playlists.user_id = (select auth.uid())
          and storage.filename(objects.name) like playlists.id::text || '-%'
      )
    )
  )
);

create policy "Admins and owners can update covers"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'covers'
  and (
    (select public.is_admin())
    or (
      (storage.foldername(name))[1] = 'avatars'
      and storage.filename(name) like (select auth.uid())::text || '-%'
    )
    or (
      (storage.foldername(name))[1] = 'playlists'
      and exists (
        select 1
        from public.playlists
        where playlists.user_id = (select auth.uid())
          and storage.filename(objects.name) like playlists.id::text || '-%'
      )
    )
  )
)
with check (
  bucket_id = 'covers'
  and (
    (select public.is_admin())
    or (
      (storage.foldername(name))[1] = 'avatars'
      and storage.filename(name) like (select auth.uid())::text || '-%'
    )
    or (
      (storage.foldername(name))[1] = 'playlists'
      and exists (
        select 1
        from public.playlists
        where playlists.user_id = (select auth.uid())
          and storage.filename(objects.name) like playlists.id::text || '-%'
      )
    )
  )
);

create policy "Admins and owners can delete covers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'covers'
  and (
    (select public.is_admin())
    or (
      (storage.foldername(name))[1] = 'avatars'
      and storage.filename(name) like (select auth.uid())::text || '-%'
    )
    or (
      (storage.foldername(name))[1] = 'playlists'
      and exists (
        select 1
        from public.playlists
        where playlists.user_id = (select auth.uid())
          and storage.filename(objects.name) like playlists.id::text || '-%'
      )
    )
  )
);

create policy "Admins can insert songs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'songs'
  and (select public.is_admin())
);

create policy "Admins can update songs"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'songs'
  and (select public.is_admin())
)
with check (
  bucket_id = 'songs'
  and (select public.is_admin())
);

create policy "Admins can delete songs"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'songs'
  and (select public.is_admin())
);

-- Play counts stay public, but callers can only perform one atomic increment.
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

  return updated_plays;
end;
$$;

revoke all on function public.increment_song_plays(uuid) from public;
grant execute on function public.increment_song_plays(uuid) to anon, authenticated;
