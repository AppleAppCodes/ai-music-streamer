create table if not exists public.user_music_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  favorite_genres text[] not null default '{}',
  onboarding_skipped boolean not null default false,
  onboarding_completed_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint user_music_preferences_genre_limit
    check (cardinality(favorite_genres) <= 32)
);

alter table public.user_music_preferences enable row level security;

revoke all on table public.user_music_preferences from public, anon, authenticated;
grant select, insert, update, delete on table public.user_music_preferences to authenticated;
grant select, insert, update, delete on table public.user_music_preferences to service_role;

drop policy if exists "Users can view their own music preferences"
  on public.user_music_preferences;
create policy "Users can view their own music preferences"
  on public.user_music_preferences
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own music preferences"
  on public.user_music_preferences;
create policy "Users can create their own music preferences"
  on public.user_music_preferences
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own music preferences"
  on public.user_music_preferences;
create policy "Users can update their own music preferences"
  on public.user_music_preferences
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own music preferences"
  on public.user_music_preferences;
create policy "Users can delete their own music preferences"
  on public.user_music_preferences
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
