-- Public song pages need enough approved-song metadata to render without
-- querying the songs table directly from the browser.
REVOKE SELECT ON TABLE public.songs FROM anon;

GRANT SELECT (
  id,
  creator_id,
  title,
  artist_name,
  cover_url,
  audio_url,
  genre,
  mood,
  language,
  description,
  ai_tool,
  human_edit,
  vocals_type,
  credits,
  duration,
  plays,
  created_at,
  album_id,
  track_number,
  viral_sort_order,
  is_spotlight,
  spotlight_copy
) ON TABLE public.songs TO anon;
