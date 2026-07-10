-- D1/D7 retention cohorts (#messen-statt-raten, part 2): per signup week, how
-- many users listened again the day after signup (D1), exactly a week later
-- (D7), and at all within the first week (W1). "Active" = a row in
-- user_activity_days, i.e. actually listened — stricter than an app open, but
-- it is the retention that matters for a music app.
--
-- Caveat for readers: user_activity_days only exists since ~2026-07-02, so
-- cohorts before that week undercount. Young cohorts are not "mature" yet —
-- the admin UI greys them out (D1 needs signup+1, D7 needs signup+7 in the
-- past for every member; approximated per week in the UI).
create or replace function public.get_admin_retention_cohorts(weeks integer default 8)
returns table (cohort_week date, cohort_size bigint, d1 bigint, d7 bigint, w1 bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Only admins can view metrics';
  end if;
  return query
    select
      date_trunc('week', p.created_at)::date as cohort_week,
      count(*)::bigint as cohort_size,
      count(*) filter (where exists (
        select 1 from public.user_activity_days a
        where a.user_id = p.id and a.day = p.created_at::date + 1
      ))::bigint as d1,
      count(*) filter (where exists (
        select 1 from public.user_activity_days a
        where a.user_id = p.id and a.day = p.created_at::date + 7
      ))::bigint as d7,
      count(*) filter (where exists (
        select 1 from public.user_activity_days a
        where a.user_id = p.id and a.day between p.created_at::date + 1 and p.created_at::date + 7
      ))::bigint as w1
    from public.profiles p
    where p.created_at >= date_trunc('week', now()) - make_interval(weeks => weeks)
    group by 1
    order by 1 desc;
end;
$$;
revoke all on function public.get_admin_retention_cohorts(integer) from anon;
grant execute on function public.get_admin_retention_cohorts(integer) to authenticated;
