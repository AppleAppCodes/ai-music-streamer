-- Add `is_spotlight` flags to artist_profiles and playlists so the home
-- spotlight slider on the web can rotate between (1) a single song,
-- (2) an artist of the week, (3) a playlist of the week. Mirrors the
-- existing songs.is_spotlight column (added in the earlier
-- `add_single_home_spotlight_song` migration).

alter table public.artist_profiles
  add column if not exists is_spotlight boolean default false;

alter table public.playlists
  add column if not exists is_spotlight boolean default false;
