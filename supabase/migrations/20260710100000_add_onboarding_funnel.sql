-- First-session funnel (#messen-statt-raten): where do new users drop off
-- after onboarding? Four one-shot events per user — completed onboarding,
-- first auto-played song started, 25s of it heard (same threshold as the
-- honest play), and a second song started. The primary key (user_id, event)
-- makes every event once-per-user-ever, so the table is inherently
-- flood-safe: an authenticated user can create at most four tiny rows.
create table if not exists public.onboarding_funnel_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null check (event in (
    'onboarding_completed',
    'first_song_started',
    'first_song_25s',
    'second_song_started'
  )),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, event)
);
alter table public.onboarding_funnel_events enable row level security;
revoke all on public.onboarding_funnel_events from anon, authenticated;

create or replace function public.record_funnel_event(event_name text, event_meta jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return; end if;
  -- Unknown names bounce off the check constraint anyway; return quietly
  -- instead of throwing so a client typo can never surface as a user error.
  if event_name not in ('onboarding_completed', 'first_song_started', 'first_song_25s', 'second_song_started') then
    return;
  end if;
  if event_meta is null or pg_column_size(event_meta) > 2048 then
    event_meta := '{}'::jsonb;
  end if;
  insert into public.onboarding_funnel_events (user_id, event, meta)
  values (auth.uid(), event_name, event_meta)
  on conflict (user_id, event) do nothing;
end;
$$;
revoke all on function public.record_funnel_event(text, jsonb) from anon;
grant execute on function public.record_funnel_event(text, jsonb) to authenticated;

-- Admin readout: users per funnel step within the window, newest cohort logic
-- kept simple — filter is on when the event was recorded.
create or replace function public.get_admin_onboarding_funnel(days integer default 30)
returns table (event text, users bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Only admins can view metrics';
  end if;
  return query
    select ofe.event, count(*)::bigint as users
    from public.onboarding_funnel_events ofe
    where ofe.created_at >= now() - make_interval(days => days)
    group by ofe.event
    order by array_position(
      array['onboarding_completed', 'first_song_started', 'first_song_25s', 'second_song_started'],
      ofe.event
    );
end;
$$;
revoke all on function public.get_admin_onboarding_funnel(integer) from anon;
grant execute on function public.get_admin_onboarding_funnel(integer) to authenticated;
