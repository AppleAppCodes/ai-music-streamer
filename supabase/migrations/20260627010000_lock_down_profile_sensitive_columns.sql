-- Critical hardening: the existing "Users can update own profile." RLS policy
-- on public.profiles is too permissive at the column level. It allows a
-- signed-in user to UPDATE their own row freely — which in turn lets them
-- flip privilege/billing/moderation columns on themselves:
--   * `subscription_tier`  → unlock Pro / Premium without paying
--   * `ad_free_until`      → silence ads
--   * `is_banned`          → un-ban themselves
--   * `role`               → pose as creator/mod/admin in the UI (the
--                            app authoritatively checks auth.app_metadata
--                            for privilege, but UI/badges read this column)
--   * `followers_count`    → fake popularity
--   * `early_access_bonus_claimed_at` → re-claim a one-shot bonus
--   * `email`              → identity-spoofing in admin lists
--
-- Postgres RLS does not support per-column WITH CHECK, so this trigger
-- snaps the protected columns back to their previous value for every
-- caller that is neither an admin (JWT `app_metadata.role = 'admin'`)
-- nor the service_role (Stripe webhook, Supabase admin client, RPC
-- callers that re-validate authorization themselves like set_user_role).

create or replace function public.profiles_guard_sensitive_columns()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_role text;
begin
  begin
    v_role := auth.role();
  exception when others then
    v_role := null;
  end;

  if v_role = 'service_role' or (select public.is_admin()) then
    return new;
  end if;

  new.subscription_tier := old.subscription_tier;
  new.ad_free_until := old.ad_free_until;
  new.is_banned := old.is_banned;
  new.role := old.role;
  new.followers_count := old.followers_count;
  new.early_access_bonus_claimed_at := old.early_access_bonus_claimed_at;
  new.email := old.email;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists profiles_guard_sensitive_columns_trigger on public.profiles;
create trigger profiles_guard_sensitive_columns_trigger
before update on public.profiles
for each row execute function public.profiles_guard_sensitive_columns();
