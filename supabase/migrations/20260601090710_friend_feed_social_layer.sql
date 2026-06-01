CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CHECK (requester_id <> addressee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS friendships_unique_pair_idx
  ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

CREATE INDEX IF NOT EXISTS friendships_requester_status_idx
  ON public.friendships (requester_id, status);

CREATE INDEX IF NOT EXISTS friendships_addressee_status_idx
  ON public.friendships (addressee_id, status);

CREATE TABLE IF NOT EXISTS public.listening_activity (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  is_playing boolean NOT NULL DEFAULT false,
  progress_seconds integer NOT NULL DEFAULT 0 CHECK (progress_seconds >= 0),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS listening_activity_updated_at_idx
  ON public.listening_activity (updated_at DESC);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_activity ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON TABLE public.friendships TO authenticated;
GRANT UPDATE (status, updated_at) ON TABLE public.friendships TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.listening_activity TO authenticated;

CREATE POLICY "Users can view their friendships"
  ON public.friendships FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = requester_id
    OR (SELECT auth.uid()) = addressee_id
  );

CREATE POLICY "Users can send friend requests"
  ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = requester_id
    AND requester_id <> addressee_id
    AND status = 'pending'
  );

CREATE POLICY "Users can update received friend requests"
  ON public.friendships FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = addressee_id)
  WITH CHECK ((SELECT auth.uid()) = addressee_id);

CREATE POLICY "Users can remove their friendships"
  ON public.friendships FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = requester_id
    OR (SELECT auth.uid()) = addressee_id
  );

CREATE POLICY "Friends can view listening activity"
  ON public.listening_activity FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1
      FROM public.friendships
      WHERE status = 'accepted'
        AND (
          (requester_id = (SELECT auth.uid()) AND addressee_id = listening_activity.user_id)
          OR (addressee_id = (SELECT auth.uid()) AND requester_id = listening_activity.user_id)
        )
    )
  );

CREATE POLICY "Users can insert their listening activity"
  ON public.listening_activity FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their listening activity"
  ON public.listening_activity FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'listening_activity'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.listening_activity;
  END IF;
END
$$;
