-- Harden the creator upload moderation policies after the initial approval
-- migration. Creator-submitted songs must remain pending and creator storage
-- writes must stay inside their own top-level folder.

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public songs are viewable by everyone." ON public.songs;
DROP POLICY IF EXISTS "Songs are viewable by everyone." ON public.songs;
DROP POLICY IF EXISTS "Anyone can view songs" ON public.songs;
DROP POLICY IF EXISTS "Public can view approved songs" ON public.songs;

CREATE POLICY "Public can view approved songs"
  ON public.songs FOR SELECT
  USING (
    is_approved = true
    OR creator_id = (select auth.uid())
    OR (select public.is_admin())
  );

DROP POLICY IF EXISTS "Admins can insert songs" ON public.songs;
DROP POLICY IF EXISTS "Admins and creators can insert songs" ON public.songs;

CREATE POLICY "Admins and creators can insert songs"
  ON public.songs FOR INSERT
  TO authenticated
  WITH CHECK (
    (select public.is_admin())
    OR (
      (select auth.jwt() -> 'app_metadata' ->> 'role') = 'creator'
      AND creator_id = (select auth.uid())
      AND coalesce(is_approved, false) = false
    )
  );

DROP POLICY IF EXISTS "Creators can insert own albums" ON public.albums;

CREATE POLICY "Creators can insert own albums"
  ON public.albums FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_id = (select auth.uid())
    AND (select auth.jwt() -> 'app_metadata' ->> 'role') = 'creator'
  );

DROP POLICY IF EXISTS "Auth Insert Access on songs" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload audio" ON storage.objects;
DROP POLICY IF EXISTS "Admins can insert songs" ON storage.objects;
DROP POLICY IF EXISTS "Admins and creators can insert songs" ON storage.objects;

CREATE POLICY "Admins and creators can insert songs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'songs'
    AND (
      (select public.is_admin())
      OR (
        (select auth.jwt() -> 'app_metadata' ->> 'role') = 'creator'
        AND (storage.foldername(name))[1] = (select auth.uid())::text
      )
    )
  );

DROP POLICY IF EXISTS "Creators can insert own song covers" ON storage.objects;

CREATE POLICY "Creators can insert own song covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'covers'
    AND (select auth.jwt() -> 'app_metadata' ->> 'role') = 'creator'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );
