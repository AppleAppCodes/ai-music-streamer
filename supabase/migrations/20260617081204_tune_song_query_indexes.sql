-- Align song indexes with the read-heavy query patterns used by Home, Charts and Genres.
-- The simple idx_songs_* indexes remain for broad lookups; the composites help limited ordered reads.

CREATE INDEX IF NOT EXISTS idx_songs_approved_plays
  ON public.songs (is_approved, plays DESC);

CREATE INDEX IF NOT EXISTS idx_songs_approved_created_at
  ON public.songs (is_approved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_songs_genre_plays
  ON public.songs (genre, plays DESC);

-- These older names duplicate the newer committed idx_songs_* indexes on production.
DROP INDEX IF EXISTS public.songs_plays_idx;
DROP INDEX IF EXISTS public.songs_created_at_idx;
DROP INDEX IF EXISTS public.songs_artist_name_idx;
