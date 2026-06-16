-- Indexes to improve performance of the most common queries

-- 1. Index on plays (DESC) for popular / trending songs
CREATE INDEX IF NOT EXISTS idx_songs_plays ON public.songs (plays DESC);

-- 2. Index on created_at (DESC) for newest songs
CREATE INDEX IF NOT EXISTS idx_songs_created_at ON public.songs (created_at DESC);

-- 3. Index on artist_name for artist searches and grouping
CREATE INDEX IF NOT EXISTS idx_songs_artist_name ON public.songs (artist_name);

-- 4. Index on is_approved for RLS and filtering
CREATE INDEX IF NOT EXISTS idx_songs_is_approved ON public.songs (is_approved);
