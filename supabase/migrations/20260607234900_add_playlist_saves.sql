-- Create playlist_saves table to allow users to bookmark/save public playlists
CREATE TABLE IF NOT EXISTS public.playlist_saves (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (user_id, playlist_id)
);

-- Enable RLS
ALTER TABLE public.playlist_saves ENABLE ROW LEVEL SECURITY;

-- Policies for playlist_saves
DROP POLICY IF EXISTS "Users can view their own saved playlists" ON public.playlist_saves;
CREATE POLICY "Users can view their own saved playlists"
  ON public.playlist_saves FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can save playlists" ON public.playlist_saves;
CREATE POLICY "Users can save playlists"
  ON public.playlist_saves FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can unsave playlists" ON public.playlist_saves;
CREATE POLICY "Users can unsave playlists"
  ON public.playlist_saves FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- Insert system record for 'Daily New Releases' playlist so users can bookmark it
INSERT INTO public.playlists (id, user_id, title, description, cover_url, is_public, is_official, created_at)
VALUES (
  'da114eeb-ecea-5e55-9ee1-ea5e5da11111',
  NULL,
  'Daily New Releases',
  'The latest 20 songs on Yoriax. Updated daily.',
  NULL,
  true,
  true,
  timezone('utc'::text, now())
)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    is_official = EXCLUDED.is_official,
    is_public = EXCLUDED.is_public;
