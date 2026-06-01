REVOKE ALL PRIVILEGES ON TABLE public.friendships FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.listening_activity FROM anon, authenticated;

GRANT SELECT, INSERT, DELETE ON TABLE public.friendships TO authenticated;
GRANT UPDATE (status, updated_at) ON TABLE public.friendships TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.listening_activity TO authenticated;
