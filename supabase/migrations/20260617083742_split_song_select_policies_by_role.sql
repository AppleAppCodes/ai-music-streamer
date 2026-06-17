-- Avoid calling admin helper functions from anon SELECT policies.
DROP POLICY IF EXISTS "Public can view approved songs" ON public.songs;
DROP POLICY IF EXISTS "Anon can view approved song previews" ON public.songs;
DROP POLICY IF EXISTS "Authenticated can view available songs" ON public.songs;

CREATE POLICY "Anon can view approved song previews"
  ON public.songs FOR SELECT
  TO anon
  USING (is_approved = true);

CREATE POLICY "Authenticated can view available songs"
  ON public.songs FOR SELECT
  TO authenticated
  USING (
    is_approved = true
    OR creator_id = (select auth.uid())
    OR (select public.is_admin())
  );
