-- Admin-adjustable focal point for the playlist banner video (CSS
-- object-position, e.g. "50.0% 30.0%"), mirroring artist_profiles.video_position.
-- NULL = centered (50% 50%). playlists already has owner + admin UPDATE
-- policies, so no new policy is required.
alter table public.playlists add column if not exists video_position text;
