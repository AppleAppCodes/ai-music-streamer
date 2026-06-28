-- The "Admins can manage ads" policy on storage.objects is FOR ALL and was
-- granted to role `public`, so it also applied to anonymous SELECTs. Its
-- predicate calls public.is_admin(), which `anon` is not allowed to EXECUTE
-- (revoked in 20260602131610_tighten_is_admin_execute_grant). In query plans
-- where the is_admin() branch gets evaluated, this makes otherwise-permitted
-- anonymous storage.objects SELECTs (e.g. listing public artist banners under
-- covers, or ads for guest playback) fail with
--   ERROR: permission denied for function is_admin
-- instead of returning rows.
--
-- Admins are always authenticated, so scope the policy to the `authenticated`
-- role. Anonymous callers then never evaluate is_admin(); their read access is
-- governed solely by the public read policies ("Public Ad Access" and
-- "Public can list curated cover media").

drop policy if exists "Admins can manage ads" on storage.objects;

create policy "Admins can manage ads"
on storage.objects
for all
to authenticated
using (bucket_id = 'ads' and is_admin())
with check (bucket_id = 'ads' and is_admin());
