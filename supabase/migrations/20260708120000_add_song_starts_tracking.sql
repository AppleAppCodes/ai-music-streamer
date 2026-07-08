-- "Starts" (Anspielungen): every genuine song start, counted regardless of
-- duration — complements song_daily_plays (25s+ honest plays). The gap between
-- starts and plays is the tap-but-bounce signal. Starts do NOT touch the
-- honest play counter; this is a separate intent metric.
create table if not exists public.song_daily_starts (
  song_id uuid not null references public.songs(id) on delete cascade,
  start_date date not null,
  starts bigint not null default 0,
  primary key (song_id, start_date)
);
alter table public.song_daily_starts enable row level security;
revoke all on public.song_daily_starts from anon, authenticated;

create or replace function public.record_song_start(target_song_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.song_daily_starts (song_id, start_date, starts)
  values (target_song_id, current_date, 1)
  on conflict (song_id, start_date)
  do update set starts = public.song_daily_starts.starts + 1;
end;
$$;
revoke all on function public.record_song_start(uuid) from anon;
grant execute on function public.record_song_start(uuid) to authenticated;

create or replace function public.get_admin_daily_starts(days integer default 90)
returns table (day date, starts bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Only admins can view metrics';
  end if;
  return query
    select sds.start_date as day, sum(sds.starts)::bigint as starts
    from public.song_daily_starts sds
    where sds.start_date >= current_date - days
    group by sds.start_date
    order by sds.start_date asc;
end;
$$;
revoke all on function public.get_admin_daily_starts(integer) from anon;
grant execute on function public.get_admin_daily_starts(integer) to authenticated;

-- get_admin_song_performance gains starts_total (see migration
-- song_performance_add_starts applied via MCP for the full body).
