-- Follow-up to 20260627181500: close the second tier of the profiles email
-- exposure. The "Public profiles are viewable by everyone." RLS policy applies
-- to `authenticated` too, and the table-wide column grant let ANY signed-in
-- user read every other user's `email` (and account state) via the REST API.
--
-- The only legitimate reader of profile emails (the admin user list) now goes
-- through the service-role /api/admin/users route, so the browser-facing
-- `authenticated` role no longer needs `email` at all. Own-email is always
-- available from the auth session (auth.users), not from public.profiles.
--
-- Grant back every non-email column the authenticated app actually reads
-- (player Pro/ad-free checks, profile(username/avatar_url) embeds, social UI),
-- and leave `email` ungranted so it is no longer selectable by signed-in users.

REVOKE SELECT ON TABLE public.profiles FROM authenticated;

GRANT SELECT (
  id,
  username,
  bio,
  avatar_url,
  followers_count,
  created_at,
  subscription_tier,
  last_active_at,
  country,
  is_banned,
  role,
  ad_free_until,
  early_access_bonus_claimed_at
) ON TABLE public.profiles TO authenticated;
