-- Query-cost optimizations for hot YORIAX read paths.
--
-- Goals:
-- - keep indexes small by using partial indexes for curated/public feeds
-- - match the app's ORDER BY patterns so Postgres can avoid scans/sorts
-- - reduce RLS per-row function calls using Supabase's recommended
--   `(select auth.uid())` / `(select is_admin())` pattern
-- - remove one redundant playlist_songs SELECT policy that duplicated RLS work

create index if not exists songs_trending_sort_idx
  on public.songs (trending_sort_order asc, created_at desc)
  where is_approved = true and trending_sort_order is not null;

create index if not exists songs_viral_sort_idx
  on public.songs (viral_sort_order asc, plays desc, created_at desc)
  where viral_sort_order is not null;

create index if not exists songs_approved_artist_plays_idx
  on public.songs (artist_name, plays desc)
  where is_approved = true;

create index if not exists playlists_public_official_sort_idx
  on public.playlists (official_sort_order asc, created_at desc)
  where is_public = true;

create index if not exists playlists_public_spotlight_idx
  on public.playlists (created_at desc)
  where is_public = true and is_spotlight = true;

create index if not exists artist_profiles_spotlight_idx
  on public.artist_profiles (created_at desc)
  where is_spotlight = true;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where is_read = false;

drop policy if exists "Public playlist songs are viewable by everyone" on public.playlist_songs;

alter policy "Allow admin update app_settings" on public.app_settings
  using ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);

alter policy "Users can follow artists" on public.follows
  with check ((select auth.uid()) = user_id);

alter policy "Users can unfollow artists" on public.follows
  using ((select auth.uid()) = user_id);

alter policy "Users can view their own follows" on public.follows
  using ((select auth.uid()) = user_id);

alter policy "Users can like songs." on public.liked_songs
  with check ((select auth.uid()) = user_id);

alter policy "Users can unlike songs." on public.liked_songs
  using ((select auth.uid()) = user_id);

alter policy "Users can view their own liked songs." on public.liked_songs
  using ((select auth.uid()) = user_id);

alter policy "Users can update their own notifications" on public.notifications
  using ((select auth.uid()) = user_id);

alter policy "Users can view their own notifications" on public.notifications
  using ((select auth.uid()) = user_id);

alter policy "Admins can delete news posts" on public.news_posts
  using ((select is_admin()));

alter policy "Admins can insert news posts" on public.news_posts
  with check ((select is_admin()));

alter policy "Admins can update news posts" on public.news_posts
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy "Authenticated users can read published or admin news" on public.news_posts
  using ((is_published = true) or (select is_admin()));

alter policy "Anyone can view songs of public playlists" on public.playlist_songs
  using (
    exists (
      select 1
      from public.playlists
      where playlists.id = playlist_songs.playlist_id
        and (
          playlists.is_public = true
          or playlists.user_id = (select auth.uid())
        )
    )
  );

alter policy "Users can add songs to their own playlists" on public.playlist_songs
  with check (
    exists (
      select 1
      from public.playlists
      where playlists.id = playlist_songs.playlist_id
        and playlists.user_id = (select auth.uid())
    )
  );

alter policy "Users can remove songs from their own playlists" on public.playlist_songs
  using (
    exists (
      select 1
      from public.playlists
      where playlists.id = playlist_songs.playlist_id
        and playlists.user_id = (select auth.uid())
    )
  );

alter policy "Public playlists are viewable by everyone" on public.playlists
  using ((is_public = true) or (user_id = (select auth.uid())));

alter policy "Users can delete their own playlists" on public.playlists
  using (user_id = (select auth.uid()));

alter policy "Users can insert their own playlists" on public.playlists
  with check (user_id = (select auth.uid()));

alter policy "Users can update their own playlists" on public.playlists
  using (user_id = (select auth.uid()));

alter policy "Users can update own profile." on public.profiles
  using ((select auth.uid()) = id);

alter policy "Admins can update reports" on public.reports
  using ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);

alter policy "Admins can view all reports" on public.reports
  using ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);

alter policy "Users can create reports" on public.reports
  with check ((select auth.uid()) = reporter_id);

alter policy "Users can create their own welcome email record" on public.user_welcome_emails
  with check ((select auth.uid()) = user_id);

alter policy "Users can read their own welcome email record" on public.user_welcome_emails
  using ((select auth.uid()) = user_id);
