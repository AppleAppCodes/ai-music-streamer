-- Device/version analytics on the profile (fed by the app's activity ping).
-- Low-sensitivity metadata: app version, OS version, device model. No raw IPs.
alter table public.profiles add column if not exists app_version text;
alter table public.profiles add column if not exists os_version text;
alter table public.profiles add column if not exists device_model text;

-- profiles uses column-level grants; mirror the country/last_active_at columns.
grant select (app_version, os_version, device_model) on public.profiles to authenticated;
grant update (app_version, os_version, device_model) on public.profiles to authenticated;
grant insert (app_version, os_version, device_model) on public.profiles to authenticated;
