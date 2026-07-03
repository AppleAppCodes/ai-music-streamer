-- ── Retention: one row per user per active day (cohort/D7/D30 analyses) ─────
create table if not exists public.user_activity_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

alter table public.user_activity_days enable row level security;
revoke all on public.user_activity_days from anon, authenticated;

-- Fed from two sides: the play RPC (listening) and a trigger on
-- profiles.last_active_at (app/web opens).
create or replace function public.record_profile_activity_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.last_active_at is not null
     and (old.last_active_at is null or new.last_active_at > old.last_active_at) then
    insert into public.user_activity_days (user_id, day)
    values (new.id, (new.last_active_at at time zone 'utc')::date)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_record_activity_day on public.profiles;
create trigger profiles_record_activity_day
  after update of last_active_at on public.profiles
  for each row execute function public.record_profile_activity_day();

-- increment_song_plays additionally inserts (listener_id, current_date) into
-- user_activity_days; full function body applied in prod (see remote schema).

-- ── Daily metric snapshots (growth curves; DAU is null before 2026-07-03) ──
create table if not exists public.metrics_daily (
  day date primary key,
  total_users integer,
  new_users integer,
  dau integer,
  plays integer,
  total_plays bigint,
  new_likes integer,
  total_likes integer,
  new_songs integer,
  total_songs integer,
  active_creators integer,
  captured_at timestamptz not null default now()
);

alter table public.metrics_daily enable row level security;
revoke all on public.metrics_daily from anon, authenticated;

-- capture_daily_metrics(target_day) upserts one row per day; scheduled via
-- pg_cron ('capture-daily-metrics', 15 2 * * *). History since 2026-05-31 was
-- backfilled from profiles/song_daily_plays/liked_songs/songs at migration time.
