-- Critical hardening: the "Public profiles are viewable by everyone." SELECT
-- RLS policy on public.profiles (USING true, role public) combined with a
-- table-wide column SELECT grant exposed EVERY column of EVERY profile row to
-- the `anon` role -- including `email`. Because the anonymous Supabase key
-- ships in the browser bundle, anyone on the internet could dump every user's
-- email address (plus country, is_banned, subscription_tier, role,
-- ad_free_until, early_access_bonus_claimed_at, last_active_at) straight from
-- the public REST API, e.g.:
--   GET /rest/v1/profiles?select=email,username&apikey=<public anon key>
--
-- Anonymous visitors only ever need a small, public-safe subset of profile
-- columns: the public charts/playlists endpoints embed profiles(username) via
-- foreign keys and public pages render the avatar. Lock the `anon` grant down
-- to exactly that subset so the email and account-state columns are no longer
-- selectable anonymously, while the public username/avatar joins keep working.
--
-- NOTE: the `authenticated` role still has full column access here so the app
-- (player Pro/ad-free checks, settings) and the admin panel keep working. The
-- separate concern that any *signed-in* user can read other users' emails
-- should be addressed by moving the admin user list to the service-role admin
-- API and then narrowing the authenticated grant -- tracked separately.

REVOKE SELECT ON TABLE public.profiles FROM anon;

GRANT SELECT (
  id,
  username,
  avatar_url,
  bio,
  followers_count
) ON TABLE public.profiles TO anon;
