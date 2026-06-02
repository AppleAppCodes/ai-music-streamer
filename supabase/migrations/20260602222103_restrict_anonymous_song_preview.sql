-- Guests only need metadata for the public home page and search previews.
-- Audio URLs and all song mutations remain available to authenticated users
-- according to the existing RLS policies.
revoke all privileges on table public.songs from anon;

grant select (id, title, artist_name, cover_url, plays)
  on table public.songs
  to anon;
