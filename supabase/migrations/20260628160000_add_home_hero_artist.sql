-- Admin-selectable home hero video: store which artist's banner video is shown
-- as the home hero background. NULL = fall back to a random artist video.
-- app_settings already has an admin-only UPDATE policy ("Allow admin update
-- app_settings") and a public read policy, so no new policy is required.
alter table public.app_settings add column if not exists hero_artist_name text;
