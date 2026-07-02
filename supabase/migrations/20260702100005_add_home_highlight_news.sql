-- Optional fourth Home Spotlight slide for admin-written news / announcements.
-- app_settings already has public read and admin-only update policies in this
-- project, so the home page can read the enabled news payload while only admins
-- can change it from the dashboard.

alter table public.app_settings
  add column if not exists highlight_news_enabled boolean not null default false,
  add column if not exists highlight_news_title text,
  add column if not exists highlight_news_body text,
  add column if not exists highlight_news_cta_label text,
  add column if not exists highlight_news_cta_url text;
