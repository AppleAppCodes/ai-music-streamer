-- Admin-adjustable focal point for the home hero video (CSS object-position,
-- e.g. "50.0% 30.0%"). NULL = centered. Pairs with app_settings.hero_artist_name;
-- app_settings already has admin-only UPDATE + public read policies.
alter table public.app_settings add column if not exists hero_video_position text;
