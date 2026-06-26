-- Adds CSS object-position values for the artist banner image and the artist video.
-- Stored as plain text (e.g. "50% 30%") so the frontend can apply them directly
-- via `style={{ objectPosition: ... }}`. Nullable; NULL means "center center".

alter table public.artist_profiles
  add column if not exists banner_position text,
  add column if not exists video_position text;
