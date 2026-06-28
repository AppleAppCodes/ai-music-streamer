-- Admin user list as an admin-only SECURITY DEFINER RPC.
--
-- Background: profiles.email is no longer readable by the browser-facing
-- `authenticated` role (see 20260627182500). The admin dashboard was switched
-- to a service-role API route, but that route failed in production (500),
-- leaving the admin Users tab empty. Use the same proven pattern as
-- set_user_role instead: a SECURITY DEFINER function that self-authorizes via
-- is_admin() and is called through the normal authenticated client -- no
-- service-role key dependency.

create or replace function public.get_admin_user_list()
returns setof public.profiles
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Only admins can list users';
  end if;
  return query select * from public.profiles order by created_at desc;
end;
$$;

revoke all on function public.get_admin_user_list() from public, anon;
grant execute on function public.get_admin_user_list() to authenticated;

-- Ban toggle (the direct profiles UPDATE had no admin RLS policy and the
-- profiles_guard trigger protects is_banned; this self-authorizes via is_admin,
-- and the trigger permits the change because is_admin() is true for the caller).
create or replace function public.set_user_banned(target_user_id uuid, banned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Only admins can change ban status';
  end if;
  update public.profiles set is_banned = banned where id = target_user_id;
end;
$$;

revoke all on function public.set_user_banned(uuid, boolean) from public, anon;
grant execute on function public.set_user_banned(uuid, boolean) to authenticated;
