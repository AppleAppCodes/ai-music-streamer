-- Public charts need metadata for ranking and display, but must not expose audio URLs.
GRANT SELECT (
  id,
  title,
  artist_name,
  cover_url,
  plays,
  created_at,
  genre,
  duration,
  viral_sort_order
) ON TABLE public.songs TO anon;
