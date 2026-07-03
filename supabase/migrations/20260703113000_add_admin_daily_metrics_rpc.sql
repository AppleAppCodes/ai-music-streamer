-- Admin-only read access to the daily metric snapshots (same pattern as
-- get_admin_user_list/engagement: SECURITY DEFINER + is_admin guard).
create or replace function public.get_admin_daily_metrics(days integer default 90)
returns setof public.metrics_daily
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Only admins can view metrics';
  end if;

  return query
    select * from public.metrics_daily m
    where m.day >= current_date - days
    order by m.day asc;
end;
$$;

revoke all on function public.get_admin_daily_metrics(integer) from public, anon;
grant execute on function public.get_admin_daily_metrics(integer) to authenticated;
