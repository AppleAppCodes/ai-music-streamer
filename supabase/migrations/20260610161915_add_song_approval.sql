-- Add is_approved column
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- Approve songs that existed before the moderation flow. New creator uploads
-- stay pending unless an admin inserts them.
UPDATE public.songs SET is_approved = true WHERE is_approved IS DISTINCT FROM true;

-- Enable RLS
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- Drop old broad read policies before adding approval-gated reads.
DROP POLICY IF EXISTS "Public songs are viewable by everyone." ON public.songs;
DROP POLICY IF EXISTS "Songs are viewable by everyone." ON public.songs;
DROP POLICY IF EXISTS "Anyone can view songs" ON public.songs;
DROP POLICY IF EXISTS "Public can view approved songs" ON public.songs;

-- Create SELECT policy: Everyone can see approved songs, creators can see their own, admins can see all
CREATE POLICY "Public can view approved songs"
  ON public.songs FOR SELECT
  USING (
    is_approved = true
    OR creator_id = (select auth.uid())
    OR (select public.is_admin())
  );

-- Update INSERT policy for songs table to allow creators to submit only
-- their own pending songs. They must not be able to self-approve.
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

-- Allow creators to create album shells for their own pending releases.
-- Songs inside those albums still remain hidden until approved.
DROP POLICY IF EXISTS "Creators can insert own albums" ON public.albums;

CREATE POLICY "Creators can insert own albums"
  ON public.albums FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_id = (select auth.uid())
    AND (select auth.jwt() -> 'app_metadata' ->> 'role') = 'creator'
  );

-- Update storage insert policies to allow creators to upload only into their
-- own top-level folder. Admins retain full platform-media access.
DROP POLICY IF EXISTS "Auth Insert Access on songs" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload audio" ON storage.objects;
DROP POLICY IF EXISTS "Admins can insert songs" ON storage.objects;
DROP POLICY IF EXISTS "Admins and creators can insert songs" ON storage.objects;

CREATE POLICY "Admins and creators can insert songs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'songs' AND
    (
      (select public.is_admin()) OR
      (
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
    bucket_id = 'covers' AND
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'creator'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );
