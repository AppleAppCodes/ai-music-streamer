-- Exit-metrics batch (#3 listen time, #4 acquisition, #5 revenue events, #6 terms log).
-- Applied to prod via MCP; full definitions in the remote schema.

-- #3: listened seconds per user per day + auth-gated RPC (clamped 1..600s/call, 24h/day cap)
alter table public.user_activity_days add column if not exists listened_seconds integer not null default 0;
-- function public.record_listen_time(seconds integer) — security definer, authenticated only

-- #4: acquisition attribution on the profile (set once per install by the app)
alter table public.profiles add column if not exists acquisition_source text;
alter table public.profiles add column if not exists acquisition_campaign_id text;
alter table public.profiles add column if not exists acquisition_ad_group_id text;
alter table public.profiles add column if not exists acquisition_keyword_id text;
alter table public.profiles add column if not exists acquisition_attributed_at timestamptz;
-- column-level select/update/insert grants to authenticated (mirrors device columns)

-- #5: subscription events (fed by the Stripe webhook; source for MRR/churn series)
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  tier text,
  stripe_details jsonb,
  created_at timestamptz not null default now()
);

-- #6: terms/privacy acceptance log (unique per user+document+version)
create table if not exists public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document text not null,
  version text not null,
  source text,
  accepted_at timestamptz not null default now(),
  unique (user_id, document, version)
);

-- metrics_daily: minutes_streamed + pro_users columns; capture_daily_metrics extended.
alter table public.metrics_daily add column if not exists minutes_streamed integer;
alter table public.metrics_daily add column if not exists pro_users integer;
