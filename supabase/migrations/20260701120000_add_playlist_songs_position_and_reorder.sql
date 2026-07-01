-- Ordering support for playlist_songs (drag & drop reordering).
ALTER TABLE public.playlist_songs ADD COLUMN IF NOT EXISTS position integer;

-- Backfill positions from the current display order (added_at DESC = newest first).
WITH ordered AS (
  SELECT playlist_id, song_id,
         (row_number() OVER (PARTITION BY playlist_id ORDER BY added_at DESC) - 1) AS rn
  FROM public.playlist_songs
)
UPDATE public.playlist_songs ps
SET position = o.rn
FROM ordered o
WHERE ps.playlist_id = o.playlist_id AND ps.song_id = o.song_id;

CREATE INDEX IF NOT EXISTS playlist_songs_playlist_position_idx
  ON public.playlist_songs (playlist_id, position);

-- Owner-scoped reorder via a controlled function. Avoids adding a broad UPDATE
-- policy on playlist_songs: owners can only reorder through this checked function,
-- not perform arbitrary row updates.
CREATE OR REPLACE FUNCTION public.reorder_playlist_songs(p_playlist_id uuid, p_song_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.playlists
    WHERE id = p_playlist_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to reorder this playlist';
  END IF;

  UPDATE public.playlist_songs ps
  SET position = idx.ord
  FROM (
    SELECT s.id AS song_id, (s.i - 1) AS ord
    FROM unnest(p_song_ids) WITH ORDINALITY AS s(id, i)
  ) idx
  WHERE ps.playlist_id = p_playlist_id AND ps.song_id = idx.song_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_playlist_songs(uuid, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.reorder_playlist_songs(uuid, uuid[]) TO authenticated;
